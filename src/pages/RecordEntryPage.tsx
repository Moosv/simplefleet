import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useEmployees, useDepartments, usePurposes, useVehicles } from '@/hooks/useEmployees'
import { calcDistanceTraveled, toDateString } from '@/utils/distanceCalc'
import { cn } from '@/utils/cn'
import { EMP_SESSION_KEY } from './EmployeeLoginPage'
import type { EmpSession } from './EmployeeLoginPage'

const schema = z.object({
  vehicle_id: z.string().min(1, '차량을 선택하세요'),
  usage_date: z.string().min(1, '날짜를 선택하세요'),
  employee_id: z.string().min(1, '운전자를 선택하세요'),
  department_id: z.string().optional(),
  purpose_select: z.string().min(1, '용무를 선택하세요'),
  purpose_custom: z.string().optional(),
  destination: z.string().min(1, '목적지를 입력하세요'),
  waypoint: z.string().optional(),
  cumulative_distance: z.number().positive('0보다 커야 합니다'),
  duration_hours: z.number().nonnegative().optional(),
  fuel_amount: z.number().nonnegative().optional(),
}).refine(data => {
  if (data.purpose_select === '기타') {
    return data.purpose_custom && data.purpose_custom.trim().length > 0
  }
  return true
}, { message: '용무를 직접 입력해주세요', path: ['purpose_custom'] })

type FormData = z.infer<typeof schema>
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'
type TripType = 'none' | 'sameday' | 'overnight'

export default function RecordEntryPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const vehicleIdFromUrl = searchParams.get('vehicle')

  // 직원 포털 세션 감지 (/employee/record 진입 시)
  const empSession: EmpSession | null = (() => {
    try { return JSON.parse(localStorage.getItem(EMP_SESSION_KEY) ?? 'null') } catch { return null }
  })()
  const isEmployeePortal = window.location.pathname === '/employee/record'

  // 세션 없이 /employee/record 접근 시 로그인 페이지로
  if (isEmployeePortal && !empSession) {
    navigate('/employee', { replace: true })
    return null
  }

  function handleLogout() {
    localStorage.removeItem(EMP_SESSION_KEY)
    navigate('/employee', { replace: true })
  }

  const { data: vehicles } = useVehicles(true)
  const { data: employees } = useEmployees(true)
  const { data: departments } = useDepartments()
  const { data: purposes } = usePurposes()

  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number | null; prev: number | null; error: string | null }>({ distance: null, prev: null, error: null })
  const [distanceLoading, setDistanceLoading] = useState(false)

  const [tripType, setTripType] = useState<TripType>('none')
  const [tripEndDate, setTripEndDate] = useState('')
  const [tripStartTime, setTripStartTime] = useState('09:00')
  const [tripEndTime, setTripEndTime] = useState('18:00')
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null)
  const [tripError, setTripError] = useState('')
  const [defaultApplied, setDefaultApplied] = useState(false)
  const [submittedRecordId, setSubmittedRecordId] = useState<string | null>(null)
  const [successView, setSuccessView] = useState<'message' | 'detail' | 'edit'>('message')
  const [editSaved, setEditSaved] = useState(false)
  const [editForm, setEditForm] = useState<{
    purpose: string; destination: string; waypoint: string
    cumulative_distance: string; fuel_amount: string; duration_hours: string
  } | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: vehicleIdFromUrl ?? empSession?.default_vehicle_id ?? '',
      usage_date: toDateString(),
      employee_id: empSession?.id ?? '',
      department_id: empSession?.department_id ?? '',
    },
  })

  // 제출 완료된 기록 조회 (확인/수정용)
  const { data: submittedRecord, refetch: refetchSubmitted } = useQuery({
    queryKey: ['submitted_record', submittedRecordId],
    queryFn: async () => {
      if (!submittedRecordId) return null
      const { data } = await supabase
        .from('driving_records')
        .select('*, vehicles(name, license_plate)')
        .eq('id', submittedRecordId)
        .single()
      return data
    },
    enabled: !!submittedRecordId,
  })

  const selectedVehicleId = watch('vehicle_id')
  const selectedEmployeeId = watch('employee_id')
  const cumulativeDistance = watch('cumulative_distance')
  const purposeSelect = watch('purpose_select')
  const usageDate = watch('usage_date')

  // 숙박 출장 전환 시 도착일 초기값 설정
  useEffect(() => {
    if (tripType === 'overnight' && usageDate && !tripEndDate) {
      setTripEndDate(usageDate)
    }
  }, [tripType, usageDate, tripEndDate])

  // 운행시간 자동 계산 (당일/숙박 공통)
  useEffect(() => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (tripType === 'none' || !usageDate || !tripStartTime || !tripEndTime) {
      setCalculatedDuration(null)
      return
    }
    if (!timeRegex.test(tripStartTime) || !timeRegex.test(tripEndTime)) {
      setCalculatedDuration(null)
      return
    }
    const endDate = tripType === 'overnight' ? tripEndDate : usageDate
    if (!endDate) { setCalculatedDuration(null); return }
    const start = new Date(`${usageDate}T${tripStartTime}`)
    const end = new Date(`${endDate}T${tripEndTime}`)
    if (end <= start) { setCalculatedDuration(null); return }
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10
    setCalculatedDuration(hours)
  }, [tripType, usageDate, tripEndDate, tripStartTime, tripEndTime])

  // localStorage 기본 운전자 복원 (직원 포털 세션 없을 때만)
  useEffect(() => {
    if (!employees || defaultApplied) return
    if (!empSession) {
      const savedEmpId = localStorage.getItem('sf_employee_id')
      if (savedEmpId && employees.find(e => e.id === savedEmpId)) {
        setValue('employee_id', savedEmpId)
      }
    }
    setDefaultApplied(true)
  }, [employees, defaultApplied, setValue, empSession])

  useEffect(() => {
    if (selectedEmployeeId && !empSession) localStorage.setItem('sf_employee_id', selectedEmployeeId)
  }, [selectedEmployeeId, empSession])

  // 운전자 선택 시 부서 및 주 사용 차량 자동 설정 (비세션 경로)
  useEffect(() => {
    if (!selectedEmployeeId || !employees) return
    const emp = employees.find(e => e.id === selectedEmployeeId)
    if (emp?.department_id) setValue('department_id', emp.department_id)
    // URL 파라미터로 지정된 차량이 없으면 직원의 주 사용 차량을 기본값으로
    if (!vehicleIdFromUrl && emp?.default_vehicle_id) {
      setValue('vehicle_id', emp.default_vehicle_id)
    }
  }, [selectedEmployeeId, employees, setValue, vehicleIdFromUrl])

  // 계기판 입력 시 주행거리 자동 계산
  useEffect(() => {
    if (!selectedVehicleId || !cumulativeDistance || isNaN(Number(cumulativeDistance))) return
    const timeout = setTimeout(async () => {
      setDistanceLoading(true)
      const result = await calcDistanceTraveled(selectedVehicleId, Number(cumulativeDistance))
      setDistanceInfo({ distance: result.distance, prev: result.prevOdometer, error: result.error })
      setDistanceLoading(false)
    }, 600)
    return () => clearTimeout(timeout)
  }, [selectedVehicleId, cumulativeDistance])

  // 숙박 출장 박수 라벨
  const tripDayDiff = (() => {
    if (!usageDate || !tripEndDate) return 0
    const start = new Date(usageDate)
    const end = new Date(tripEndDate)
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  })()
  const overnightLabel = tripDayDiff === 1 ? '1박2일' : tripDayDiff > 1 ? `${tripDayDiff}박${tripDayDiff + 1}일` : ''

  async function onSubmit(data: FormData) {
    setTripError('')

    if (tripType === 'sameday') {
      const start = new Date(`${data.usage_date}T${tripStartTime}`)
      const end = new Date(`${data.usage_date}T${tripEndTime}`)
      if (end <= start) {
        setTripError('도착 시각은 출발 시각보다 이후여야 합니다')
        return
      }
    }

    if (tripType === 'overnight') {
      if (!tripEndDate) {
        setTripError('도착일을 입력해주세요')
        return
      }
      const start = new Date(`${data.usage_date}T${tripStartTime}`)
      const end = new Date(`${tripEndDate}T${tripEndTime}`)
      if (end <= start) {
        setTripError('도착 시각은 출발 시각보다 이후여야 합니다')
        return
      }
    }

    setSubmitState('submitting')

    const isManagerSession = empSession?.is_manager === true
    const selectedEmp = isManagerSession ? null : employees?.find(e => e.id === data.employee_id)
    const driverName = isManagerSession ? (empSession?.name ?? '') : (selectedEmp?.name ?? '')
    const purpose = data.purpose_select === '기타' ? (data.purpose_custom ?? '기타') : data.purpose_select
    const finalDuration: number | undefined =
      tripType !== 'none' ? (calculatedDuration ?? undefined) : undefined

    const newId = crypto.randomUUID()
    const { error } = await supabase.from('driving_records').insert({
      id: newId,
      usage_date: data.usage_date,
      end_date: tripType === 'overnight' ? tripEndDate : null,
      departure_time: tripType !== 'none' ? tripStartTime : null,
      arrival_time: tripType !== 'none' ? tripEndTime : null,
      vehicle_id: data.vehicle_id,
      department_id: data.department_id || null,
      employee_id: isManagerSession ? null : data.employee_id,
      driver_name: driverName,
      purpose,
      destination: data.destination,
      waypoint: data.waypoint || null,
      cumulative_distance: data.cumulative_distance,
      distance_traveled: distanceInfo.distance,
      duration_hours: finalDuration != null ? Number(finalDuration) : null,
      fuel_amount: data.fuel_amount ? Number(data.fuel_amount) : null,
    })

    if (error) {
      console.error(error)
      setSubmitState('error')
    } else {
      setSubmittedRecordId(newId)
      setSuccessView('message')
      setSubmitState('success')
    }
  }

  function handleReset() {
    reset({
      vehicle_id: vehicleIdFromUrl ?? empSession?.default_vehicle_id ?? '',
      usage_date: toDateString(),
      employee_id: empSession?.id ?? '',
      department_id: empSession?.department_id ?? '',
    })
    setSubmitState('idle')
    setDistanceInfo({ distance: null, prev: null, error: null })
    setTripType('none')
    setTripEndDate('')
    setTripStartTime('09:00')
    setTripEndTime('18:00')
    setCalculatedDuration(null)
    setTripError('')
    setDefaultApplied(false)
    setSubmittedRecordId(null)
    setSuccessView('message')
    setEditSaved(false)
    setEditForm(null)
  }

  if (submitState === 'success') {
    // 수정 폼 저장
    async function handleEditSave() {
      if (!submittedRecordId || !editForm) return
      const newCumulative = Number(editForm.cumulative_distance)
      const distResult = submittedRecord?.vehicle_id
        ? await calcDistanceTraveled(submittedRecord.vehicle_id, newCumulative, submittedRecordId)
        : { distance: null }
      await supabase.from('driving_records').update({
        purpose: editForm.purpose,
        destination: editForm.destination,
        waypoint: editForm.waypoint || null,
        cumulative_distance: newCumulative,
        distance_traveled: distResult.distance,
        fuel_amount: editForm.fuel_amount ? Number(editForm.fuel_amount) : null,
        duration_hours: editForm.duration_hours ? Number(editForm.duration_hours) : null,
      }).eq('id', submittedRecordId)
      await refetchSubmitted()
      setEditSaved(true)
      setSuccessView('detail')
    }

    const r = submittedRecord
    const vehicleName = (r as typeof r & { vehicles?: { name: string; license_plate: string } | null })?.vehicles

    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">운행 기록 완료</h1>
              {empSession && <p className="text-xs text-blue-600 font-medium">{empSession.name}</p>}
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-8">
          {/* 완료 메시지 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">운행 기록 완료!</h2>
            <p className="text-gray-500 text-sm">운행 기록이 저장되었습니다.</p>
            <p className="text-gray-400 text-sm mt-1">수고하셨습니다. 좋은 하루 되세요 😊</p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleReset}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              새 기록 추가
            </button>
            {successView === 'message' && (
              <button
                onClick={() => setSuccessView('detail')}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                방금 기록 확인하기
              </button>
            )}
          </div>

          {/* 기록 상세 / 수정 */}
          {successView === 'detail' && r && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {editSaved && (
                <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs text-green-700 font-medium">수정되어 저장되었습니다.</p>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-800">방금 기록한 내용</h3>
                <button
                  onClick={() => {
                    setEditSaved(false)
                    setEditForm({
                      purpose: r.purpose,
                      destination: r.destination,
                      waypoint: r.waypoint ?? '',
                      cumulative_distance: String(r.cumulative_distance),
                      fuel_amount: r.fuel_amount != null ? String(r.fuel_amount) : '',
                      duration_hours: r.duration_hours != null ? String(r.duration_hours) : '',
                    })
                    setSuccessView('edit')
                  }}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  수정
                </button>
              </div>
              <div className="divide-y divide-gray-50 text-sm">
                {[
                  { label: '운전자', value: r.driver_name },
                  { label: '차량', value: vehicleName ? `${vehicleName.name} · ${vehicleName.license_plate}` : '-' },
                  { label: '사용일자', value: r.end_date && r.end_date !== r.usage_date ? `${r.usage_date} ~ ${r.end_date}` : r.usage_date },
                  { label: '용무', value: r.purpose },
                  { label: '목적지', value: r.destination },
                  { label: '경유지', value: r.waypoint ?? '-' },
                  { label: '운행거리', value: r.distance_traveled != null ? `${r.distance_traveled}km` : '-' },
                  { label: '누적거리', value: `${r.cumulative_distance.toLocaleString()}km` },
                  { label: '주유량', value: r.fuel_amount != null ? `${r.fuel_amount}L` : '-' },
                  { label: '운행시간', value: r.duration_hours != null ? `${r.duration_hours}시간` : '-' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-gray-400 text-xs">{label}</span>
                    <span className="text-gray-800 font-medium text-xs text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 수정 폼 */}
          {successView === 'edit' && editForm && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-800">기록 수정</h3>
                <button onClick={() => setSuccessView('detail')} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { label: '용무', key: 'purpose' as const },
                  { label: '목적지', key: 'destination' as const },
                  { label: '경유지', key: 'waypoint' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={editForm[key]}
                      onChange={e => setEditForm(f => f ? { ...f, [key]: e.target.value } : f)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">누적거리(km)</label>
                    <input type="number" step="0.1" value={editForm.cumulative_distance}
                      onChange={e => setEditForm(f => f ? { ...f, cumulative_distance: e.target.value } : f)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">주유량(L)</label>
                    <input type="number" step="0.01" value={editForm.fuel_amount}
                      onChange={e => setEditForm(f => f ? { ...f, fuel_amount: e.target.value } : f)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">운행시간(h)</label>
                    <input type="number" step="0.5" value={editForm.duration_hours}
                      onChange={e => setEditForm(f => f ? { ...f, duration_hours: e.target.value } : f)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <button
                  onClick={handleEditSave}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">운행 기록 입력</h1>
              {empSession && (
                <p className="text-xs text-blue-600 font-medium">{empSession.name}</p>
              )}
            </div>
          </div>
          {empSession && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              로그아웃
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* 차량 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">차량 *</label>
            <select {...register('vehicle_id')} className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">차량을 선택하세요</option>
              {vehicles?.map(v => (
                <option key={v.id} value={v.id}>{v.name} · {v.license_plate}</option>
              ))}
            </select>
            {errors.vehicle_id && <p className="mt-1 text-xs text-red-500">{errors.vehicle_id.message}</p>}
          </div>

          {/* 운전자 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">운전자 *</label>
            {empSession ? (
              <div className="flex items-center gap-2 px-3 py-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{empSession.name.charAt(0)}</span>
                </div>
                <span className="text-sm font-semibold text-blue-700">{empSession.name}</span>
                <input type="hidden" {...register('employee_id')} />
              </div>
            ) : (
              <>
                <select {...register('employee_id')} className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">이름을 선택하세요</option>
                  {employees?.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                {errors.employee_id && <p className="mt-1 text-xs text-red-500">{errors.employee_id.message}</p>}
              </>
            )}
          </div>

          {/* 소속 */}
          {!empSession && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">소속 *</label>
              <select {...register('department_id')} className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">소속을 선택하세요</option>
                {departments?.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {errors.department_id && <p className="mt-1 text-xs text-red-500">{errors.department_id.message}</p>}
            </div>
          )}
          {empSession && <input type="hidden" {...register('department_id')} />}

          {/* 용무 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">용무 *</label>
            <select {...register('purpose_select')} className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">용무를 선택하세요</option>
              {purposes?.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name === '기타' ? '기타(직접입력하기)' : p.name}
                </option>
              ))}
            </select>
            {errors.purpose_select && <p className="mt-1 text-xs text-red-500">{errors.purpose_select.message}</p>}
            {purposeSelect === '기타' && (
              <div className="mt-3">
                <input
                  type="text"
                  {...register('purpose_custom')}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="용무를 직접 입력하세요"
                  autoFocus
                />
                {errors.purpose_custom && <p className="mt-1 text-xs text-red-500">{errors.purpose_custom.message}</p>}
              </div>
            )}
          </div>

          {/* 출장 유형 선택 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">출장 유형 *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTripType(tripType === 'sameday' ? 'none' : 'sameday')}
                className={cn(
                  'py-3 rounded-xl text-sm font-semibold border-2 transition-all',
                  tripType === 'sameday'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                )}
              >
                당일 출장
              </button>
              <button
                type="button"
                onClick={() => setTripType(tripType === 'overnight' ? 'none' : 'overnight')}
                className={cn(
                  'py-3 rounded-xl text-sm font-semibold border-2 transition-all',
                  tripType === 'overnight'
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                )}
              >
                숙박 출장
              </button>
            </div>
          </div>

          {/* ─── 당일 출장 세부 폼 ─── */}
          {tripType === 'sameday' && (
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4 space-y-4">
              <p className="text-xs font-bold text-blue-600 tracking-widest uppercase">당일 출장</p>

              {/* 출장일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">출장일 *</label>
                <input
                  type="date"
                  {...register('usage_date')}
                  className="w-full px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {errors.usage_date && <p className="mt-1 text-xs text-red-500">{errors.usage_date.message}</p>}
              </div>

              {/* 출발 시각 / 도착 시각 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">출발 시각</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={tripStartTime}
                    onChange={e => setTripStartTime(e.target.value)}
                    placeholder="예) 09:00"
                    className="w-full px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">도착 시각</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={tripEndTime}
                    onChange={e => setTripEndTime(e.target.value)}
                    placeholder="예) 18:00"
                    className="w-full px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* 자동 계산 운행시간 */}
              {calculatedDuration !== null && (
                <div className="bg-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-blue-700">총 운행 시간 (자동 계산)</span>
                  <span className="text-sm font-bold text-blue-800">{calculatedDuration}시간</span>
                </div>
              )}
              {tripError && tripType === 'sameday' && <p className="text-xs text-red-500">{tripError}</p>}

              {/* 목적지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">목적지 *</label>
                <input
                  type="text"
                  {...register('destination')}
                  className="w-full px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="예) 경기 수원"
                />
                {errors.destination && <p className="mt-1 text-xs text-red-500">{errors.destination.message}</p>}
              </div>

              {/* 경유지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">경유지 <span className="text-gray-400 font-normal">(선택)</span></label>
                <input
                  type="text"
                  {...register('waypoint')}
                  className="w-full px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* 현재 계기판 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">현재 계기판 (누적) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    {...register('cumulative_distance', { valueAsNumber: true })}
                    className="flex-1 px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="예) 15234"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">km</span>
                </div>
                {errors.cumulative_distance && <p className="mt-1 text-xs text-red-500">{errors.cumulative_distance.message}</p>}
                {distanceLoading && <p className="mt-2 text-xs text-gray-400">계산 중...</p>}
                {!distanceLoading && distanceInfo.error && <p className="mt-2 text-xs text-red-500">{distanceInfo.error}</p>}
                {!distanceLoading && distanceInfo.distance !== null && !distanceInfo.error && (
                  <div className="mt-2 bg-blue-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-700">
                      이전 누적: {distanceInfo.prev?.toLocaleString()}km →
                      <span className="font-semibold"> 당일 주행 {distanceInfo.distance.toLocaleString()}km</span>
                    </p>
                  </div>
                )}
                {!distanceLoading && distanceInfo.prev === null && distanceInfo.distance === null && !distanceInfo.error && cumulativeDistance > 0 && (
                  <p className="mt-2 text-xs text-gray-400">첫 번째 기록입니다. 당일 주행거리는 자동 계산되지 않습니다.</p>
                )}
              </div>

              {/* 주유량 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">주유량 <span className="text-gray-400 font-normal">(선택)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    {...register('fuel_amount', { setValueAs: v => v === '' ? undefined : Number(v) })}
                    className="flex-1 px-3 py-3 border border-blue-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="예) 30.5"
                  />
                  <span className="text-sm text-gray-500">L</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── 숙박 출장 세부 폼 ─── */}
          {tripType === 'overnight' && (
            <div className="bg-violet-50 rounded-xl border-2 border-violet-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-violet-600 tracking-widest uppercase">숙박 출장</p>
                {overnightLabel && (
                  <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">{overnightLabel}</span>
                )}
              </div>

              {/* 출발일 / 도착일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">출발일 *</label>
                  <input
                    type="date"
                    {...register('usage_date')}
                    className="w-full px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">도착일 *</label>
                  <input
                    type="date"
                    value={tripEndDate}
                    min={usageDate}
                    onChange={e => { setTripEndDate(e.target.value); setTripError('') }}
                    className="w-full px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                </div>
              </div>

              {/* 출발 시각 / 도착 시각 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">출발 시각</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={tripStartTime}
                    onChange={e => setTripStartTime(e.target.value)}
                    placeholder="예) 09:00"
                    className="w-full px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">도착 시각</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={tripEndTime}
                    onChange={e => { setTripEndTime(e.target.value); setTripError('') }}
                    placeholder="예) 18:00"
                    className="w-full px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                </div>
              </div>

              {/* 자동 계산 운행시간 */}
              {calculatedDuration !== null && (
                <div className="bg-violet-100 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-violet-700">총 운행 시간 (자동 계산)</span>
                  <span className="text-sm font-bold text-violet-800">{calculatedDuration}시간</span>
                </div>
              )}
              {tripError && <p className="text-xs text-red-500">{tripError}</p>}

              {/* 목적지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">목적지 *</label>
                <input
                  type="text"
                  {...register('destination')}
                  className="w-full px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  placeholder="예) 경기 수원"
                />
                {errors.destination && <p className="mt-1 text-xs text-red-500">{errors.destination.message}</p>}
              </div>

              {/* 경유지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">경유지 <span className="text-gray-400 font-normal">(선택)</span></label>
                <input
                  type="text"
                  {...register('waypoint')}
                  className="w-full px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                />
              </div>

              {/* 현재 계기판 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">현재 계기판 (누적) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    {...register('cumulative_distance', { valueAsNumber: true })}
                    className="flex-1 px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    placeholder="예) 15234"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">km</span>
                </div>
                {errors.cumulative_distance && <p className="mt-1 text-xs text-red-500">{errors.cumulative_distance.message}</p>}
                {distanceLoading && <p className="mt-2 text-xs text-gray-400">계산 중...</p>}
                {!distanceLoading && distanceInfo.error && <p className="mt-2 text-xs text-red-500">{distanceInfo.error}</p>}
                {!distanceLoading && distanceInfo.distance !== null && !distanceInfo.error && (
                  <div className="mt-2 bg-violet-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-violet-700">
                      이전 누적: {distanceInfo.prev?.toLocaleString()}km →
                      <span className="font-semibold"> 주행 {distanceInfo.distance.toLocaleString()}km</span>
                    </p>
                  </div>
                )}
                {!distanceLoading && distanceInfo.prev === null && distanceInfo.distance === null && !distanceInfo.error && cumulativeDistance > 0 && (
                  <p className="mt-2 text-xs text-gray-400">첫 번째 기록입니다. 주행거리는 자동 계산되지 않습니다.</p>
                )}
              </div>

              {/* 주유량 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">주유량 <span className="text-gray-400 font-normal">(선택)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    {...register('fuel_amount', { setValueAs: v => v === '' ? undefined : Number(v) })}
                    className="flex-1 px-3 py-3 border border-violet-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    placeholder="예) 30.5"
                  />
                  <span className="text-sm text-gray-500">L</span>
                </div>
              </div>
            </div>
          )}

          {submitState === 'error' && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-sm text-red-600">저장에 실패했습니다. 다시 시도해주세요.</p>
            </div>
          )}

          {tripType !== 'none' && (
            <button
              type="submit"
              disabled={submitState === 'submitting'}
              className={cn(
                'w-full text-white py-4 rounded-xl text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
                tripType === 'overnight'
                  ? 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              )}
            >
              {submitState === 'submitting' ? '저장 중...' : '운행 기록 저장'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
