import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useDepartments, useTeams, useEmployees, useVehicles, usePurposes } from '@/hooks/useEmployees'
import { resolveApprover } from '@/utils/exportBaecha'
import { toDateString } from '@/utils/distanceCalc'
import { cn } from '@/utils/cn'

const TS_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const TS_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(':') : ['', '']
  return (
    <div className="flex gap-1">
      <select value={h} onChange={e => onChange(`${e.target.value}:${m || '00'}`)}
        className="flex-1 px-2 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
        <option value="">시</option>
        {TS_HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <select value={m} onChange={e => onChange(`${h || '00'}:${e.target.value}`)}
        className="flex-1 px-2 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
        <option value="">분</option>
        {TS_MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  )
}

const schema = z.object({
  department_id: z.string().min(1, '소속 과를 선택하세요'),
  team_id: z.string().optional(),
  employee_id: z.string().min(1, '신청자를 선택하세요'),
  vehicle_id: z.string().min(1, '차량을 선택하세요'),
  usage_date: z.string().min(1, '사용일자를 선택하세요'),
  purpose_select: z.string().min(1, '용무를 선택하세요'),
  purpose_custom: z.string().optional(),
  destination: z.string().min(1, '행선지를 입력하세요'),
  waypoint: z.string().optional(),
}).refine(d => d.purpose_select !== '기타' || (!!d.purpose_custom && d.purpose_custom.trim().length > 0),
  { message: '용무를 직접 입력하세요', path: ['purpose_custom'] })

type FormData = z.infer<typeof schema>
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function DispatchRequestPage() {
  const navigate = useNavigate()
  const { data: departments } = useDepartments()
  const { data: teams } = useTeams()
  const { data: employees } = useEmployees(true)
  const { data: vehicles } = useVehicles(true)
  const { data: purposes } = usePurposes()

  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [overnight, setOvernight] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { usage_date: toDateString() },
  })

  const departmentId = watch('department_id')
  const teamId = watch('team_id')
  const employeeId = watch('employee_id')
  const vehicleId = watch('vehicle_id')
  const usageDate = watch('usage_date')
  const purposeSelect = watch('purpose_select')

  // 과 → 실 → 운전자 캐스케이드 필터
  const filteredTeams = useMemo(
    () => (teams ?? []).filter(t => !departmentId || t.department_id === departmentId),
    [teams, departmentId],
  )
  const filteredEmployees = useMemo(() => {
    return (employees ?? []).filter(e => {
      if (departmentId && e.department_id !== departmentId) return false
      if (teamId && e.team_id !== teamId) return false
      return true
    })
  }, [employees, departmentId, teamId])

  const selectedEmployee = employees?.find(e => e.id === employeeId)
  const selectedVehicle = vehicles?.find(v => v.id === vehicleId)

  // 운전자 선택 시 주 사용 차량 자동 지정(미선택 시)
  useEffect(() => {
    if (selectedEmployee?.default_vehicle_id && !vehicleId) {
      setValue('vehicle_id', selectedEmployee.default_vehicle_id)
    }
  }, [selectedEmployee, vehicleId, setValue])

  // 숙박 토글 시 도착일 기본값
  useEffect(() => {
    if (overnight && usageDate && !endDate) setEndDate(usageDate)
  }, [overnight, usageDate, endDate])

  // 차량별 자동 결재자
  const approverInfo = useMemo(() => {
    if (!selectedVehicle) return null
    return resolveApprover(selectedVehicle.name, selectedEmployee?.name ?? '')
  }, [selectedVehicle, selectedEmployee])

  async function onSubmit(data: FormData) {
    setSubmitState('submitting')
    const purpose = data.purpose_select === '기타' ? (data.purpose_custom ?? '기타') : data.purpose_select
    const emp = employees?.find(e => e.id === data.employee_id)
    const veh = vehicles?.find(v => v.id === data.vehicle_id)
    const { approver } = resolveApprover(veh?.name, emp?.name ?? '')

    const { error } = await supabase.from('dispatch_requests').insert({
      id: crypto.randomUUID(),
      department_id: data.department_id || null,
      team_id: data.team_id || null,
      employee_id: data.employee_id || null,
      driver_name: emp?.name ?? '',
      vehicle_id: data.vehicle_id || null,
      usage_date: data.usage_date,
      end_date: overnight ? (endDate || null) : null,
      departure_time: startTime || null,
      arrival_time: endTime || null,
      destination: data.destination,
      waypoint: data.waypoint || null,
      purpose,
      approver_name: approver || null,
      status: 'requested',
    })

    if (error) {
      console.error(error)
      setSubmitState('error')
    } else {
      setSubmitState('success')
    }
  }

  function handleNewRequest() {
    reset({ usage_date: toDateString() })
    setOvernight(false)
    setEndDate('')
    setStartTime('09:00')
    setEndTime('18:00')
    setSubmitState('idle')
  }

  // ─── 완료 화면 ───────────────────────────────────────────────
  if (submitState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-sm font-bold text-gray-900">배차신청 완료</h1>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pt-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">배차신청이 접수되었습니다</h2>
          <p className="text-gray-500 text-sm">관리자가 배차신청서/승인서를 출력합니다.</p>
          <div className="flex flex-col gap-2 mt-8">
            <button onClick={handleNewRequest}
              className="w-full bg-violet-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
              새 배차신청 작성
            </button>
            <button onClick={() => navigate('/employee')}
              className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              처음으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── 신청 폼 ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/employee')}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">배차신청서 작성</h1>
            <p className="text-xs text-gray-400">차량 배차를 신청합니다</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 신청자: 과 → 실 → 이름 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <label className="block text-sm font-semibold text-gray-700">신청자 *</label>
            <div>
              <span className="block text-xs text-gray-400 mb-1">소속 과</span>
              <select {...register('department_id')}
                onChange={e => { setValue('department_id', e.target.value); setValue('team_id', ''); setValue('employee_id', '') }}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                <option value="">과를 선택하세요</option>
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.department_id && <p className="mt-1 text-xs text-red-500">{errors.department_id.message}</p>}
            </div>
            <div>
              <span className="block text-xs text-gray-400 mb-1">소속 실 <span className="text-gray-300">(선택)</span></span>
              <select {...register('team_id')}
                onChange={e => { setValue('team_id', e.target.value); setValue('employee_id', '') }}
                disabled={!departmentId}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">실 전체</option>
                {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-xs text-gray-400 mb-1">신청자(운전자)</span>
              <select {...register('employee_id')} disabled={!departmentId}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">이름을 선택하세요</option>
                {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {errors.employee_id && <p className="mt-1 text-xs text-red-500">{errors.employee_id.message}</p>}
            </div>
          </div>

          {/* 차량 + 자동 결재자 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">차량 *</label>
            <select {...register('vehicle_id')}
              className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">차량을 선택하세요</option>
              {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name} · {v.license_plate}</option>)}
            </select>
            {errors.vehicle_id && <p className="mt-1 text-xs text-red-500">{errors.vehicle_id.message}</p>}
            {approverInfo && (
              <div className="mt-3 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                <p className="text-xs text-violet-700">
                  결재자(자동): <span className="font-semibold">{approverInfo.approver || '미지정'}</span>
                  <span className="text-violet-400"> · {approverInfo.ownerDept}</span>
                </p>
              </div>
            )}
          </div>

          {/* 사용일자 / 시간 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">사용일시 *</label>
              <button type="button" onClick={() => { setOvernight(!overnight); if (overnight) setEndDate('') }}
                className={cn('text-xs font-semibold px-3 py-1.5 rounded-lg border-2 transition-all',
                  overnight ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300')}>
                숙박(여러 날)
              </button>
            </div>
            <div className={cn('grid gap-3', overnight ? 'grid-cols-2' : 'grid-cols-1')}>
              <div>
                <span className="block text-xs text-gray-400 mb-1">{overnight ? '출발일' : '사용일'}</span>
                <input type="date" {...register('usage_date')}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                {errors.usage_date && <p className="mt-1 text-xs text-red-500">{errors.usage_date.message}</p>}
              </div>
              {overnight && (
                <div>
                  <span className="block text-xs text-gray-400 mb-1">도착일</span>
                  <input type="date" value={endDate} min={usageDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs text-gray-400 mb-1">출발 시각</span>
                <TimeSelect value={startTime} onChange={setStartTime} />
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">도착 시각</span>
                <TimeSelect value={endTime} onChange={setEndTime} />
              </div>
            </div>
          </div>

          {/* 용무 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">용무 *</label>
            <select {...register('purpose_select')}
              className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">용무를 선택하세요</option>
              {purposes?.map(p => (
                <option key={p.id} value={p.name}>{p.name === '기타' ? '기타(직접입력하기)' : p.name}</option>
              ))}
            </select>
            {errors.purpose_select && <p className="mt-1 text-xs text-red-500">{errors.purpose_select.message}</p>}
            {purposeSelect === '기타' && (
              <input type="text" {...register('purpose_custom')} autoFocus placeholder="용무를 직접 입력하세요"
                className="mt-3 w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500" />
            )}
            {errors.purpose_custom && <p className="mt-1 text-xs text-red-500">{errors.purpose_custom.message}</p>}
          </div>

          {/* 행선지 / 경유지 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">행선지 *</label>
              <input type="text" {...register('destination')} placeholder="예) 경기 수원"
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {errors.destination && <p className="mt-1 text-xs text-red-500">{errors.destination.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">경유지 <span className="text-gray-400 font-normal">(선택)</span></label>
              <input type="text" {...register('waypoint')}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          {submitState === 'error' && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-sm text-red-600">접수에 실패했습니다. 다시 시도해주세요.</p>
            </div>
          )}

          <button type="submit" disabled={submitState === 'submitting'}
            className="w-full bg-violet-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-violet-700 active:bg-violet-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            {submitState === 'submitting' ? '접수 중...' : '배차신청 접수'}
          </button>
        </form>
      </div>
    </div>
  )
}
