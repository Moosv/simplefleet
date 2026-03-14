import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useEmployees, useDepartments, usePurposes, useVehicles } from '@/hooks/useEmployees'
import { calcDistanceTraveled, toDateString } from '@/utils/distanceCalc'
import { cn } from '@/utils/cn'

const schema = z.object({
  vehicle_id: z.string().min(1, '차량을 선택하세요'),
  usage_date: z.string().min(1, '출발일을 선택하세요'),
  employee_id: z.string().min(1, '운전자를 선택하세요'),
  department_id: z.string().min(1, '소속을 선택하세요'),
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

export default function RecordEntryPage() {
  const [searchParams] = useSearchParams()
  const vehicleIdFromUrl = searchParams.get('vehicle')

  const { data: vehicles } = useVehicles(true)
  const { data: employees } = useEmployees(true)
  const { data: departments } = useDepartments()
  const { data: purposes } = usePurposes()

  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number | null; prev: number | null; error: string | null }>({ distance: null, prev: null, error: null })
  const [distanceLoading, setDistanceLoading] = useState(false)

  // 날짜 관련
  const [tripEndDate, setTripEndDate] = useState('')       // 도착일
  const [tripStartTime, setTripStartTime] = useState('09:00')
  const [tripEndTime, setTripEndTime] = useState('18:00')
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null)
  const [tripError, setTripError] = useState('')

  // 당일 출장 pill 상태
  const [sameDayActive, setSameDayActive] = useState(false)

  const [defaultApplied, setDefaultApplied] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: vehicleIdFromUrl ?? '',
      usage_date: toDateString(),
    },
  })

  const selectedVehicleId = watch('vehicle_id')
  const selectedEmployeeId = watch('employee_id')
  const cumulativeDistance = watch('cumulative_distance')
  const purposeSelect = watch('purpose_select')
  const usageDate = watch('usage_date')

  // 출발일 기반 도착일 초기값
  useEffect(() => {
    if (usageDate && !tripEndDate) {
      setTripEndDate(usageDate)
    }
  }, [usageDate, tripEndDate])

  // 날짜로 출장 유형 계산
  const tripDayDiff = (() => {
    if (!usageDate || !tripEndDate) return 0
    const start = new Date(usageDate)
    const end = new Date(tripEndDate)
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  })()
  const tripTypeLabel = tripDayDiff === 0 ? '당일' : tripDayDiff === 1 ? '1박2일' : `${tripDayDiff}박${tripDayDiff + 1}일`
  const isMultiDay = tripDayDiff > 0

  // 다박 출장 운행 시간 자동 계산
  useEffect(() => {
    if (!isMultiDay || !usageDate || !tripEndDate || !tripStartTime || !tripEndTime) {
      setCalculatedDuration(null)
      return
    }
    const start = new Date(`${usageDate}T${tripStartTime}`)
    const end = new Date(`${tripEndDate}T${tripEndTime}`)
    if (end <= start) { setCalculatedDuration(null); return }
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10
    setCalculatedDuration(hours)
  }, [usageDate, tripEndDate, tripStartTime, tripEndTime, isMultiDay])

  // 당일 출장 pill → 기본 운행 시간 4시간
  useEffect(() => {
    if (sameDayActive && !isMultiDay) {
      setValue('duration_hours', 4)
    }
  }, [sameDayActive, isMultiDay, setValue])

  // 다박 출장 감지 시 상세 필드 자동 펼침
  useEffect(() => {
    if (isMultiDay) setSameDayActive(true)
  }, [isMultiDay])

  // localStorage 기본 운전자 복원
  useEffect(() => {
    if (!employees || defaultApplied) return
    const savedEmpId = localStorage.getItem('sf_employee_id')
    if (savedEmpId && employees.find(e => e.id === savedEmpId)) {
      setValue('employee_id', savedEmpId)
    }
    setDefaultApplied(true)
  }, [employees, defaultApplied, setValue])

  useEffect(() => {
    if (selectedEmployeeId) {
      localStorage.setItem('sf_employee_id', selectedEmployeeId)
    }
  }, [selectedEmployeeId])

  useEffect(() => {
    if (!selectedEmployeeId || !employees) return
    const emp = employees.find(e => e.id === selectedEmployeeId)
    if (emp?.department_id) setValue('department_id', emp.department_id)
  }, [selectedEmployeeId, employees, setValue])

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

  async function onSubmit(data: FormData) {
    if (sameDayActive && isMultiDay) {
      if (!tripStartTime || !tripEndTime) {
        setTripError('출발 시각과 도착 시각을 입력해주세요')
        return
      }
      const start = new Date(`${data.usage_date}T${tripStartTime}`)
      const end = new Date(`${tripEndDate}T${tripEndTime}`)
      if (end <= start) {
        setTripError('도착 시각은 출발 시각보다 이후여야 합니다')
        return
      }
    }
    setTripError('')
    setSubmitState('submitting')

    const selectedEmp = employees?.find(e => e.id === data.employee_id)
    const purpose =
      data.purpose_select === '기타'
        ? (data.purpose_custom ?? '기타')
        : data.purpose_select

    const finalDuration: number | undefined =
      isMultiDay ? (calculatedDuration ?? undefined) : data.duration_hours

    const { error } = await supabase.from('driving_records').insert({
      usage_date: data.usage_date,
      vehicle_id: data.vehicle_id,
      department_id: data.department_id,
      employee_id: data.employee_id,
      driver_name: selectedEmp?.name ?? '',
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
      setSubmitState('success')
    }
  }

  function handleReset() {
    reset({ vehicle_id: vehicleIdFromUrl ?? '', usage_date: toDateString() })
    setSubmitState('idle')
    setDistanceInfo({ distance: null, prev: null, error: null })
    setTripEndDate('')
    setTripStartTime('09:00')
    setTripEndTime('18:00')
    setCalculatedDuration(null)
    setTripError('')
    setSameDayActive(false)
    setDefaultApplied(false)
  }

  if (submitState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">운행 기록 완료!</h2>
          <p className="text-gray-500 text-sm mb-6">운행 기록이 저장되었습니다.</p>
          <button onClick={handleReset} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            새 기록 추가
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h1 className="text-sm font-bold text-gray-900">운행 기록 입력</h1>
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
            <select {...register('employee_id')} className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">이름을 선택하세요</option>
              {employees?.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            {errors.employee_id && <p className="mt-1 text-xs text-red-500">{errors.employee_id.message}</p>}
          </div>

          {/* 소속 */}
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

            {/* 당일 출장 pill */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setSameDayActive(prev => !prev)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                  sameDayActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                )}
              >
                당일 출장
              </button>
            </div>
          </div>

          {/* 출발일 + 도착일 (항상 표시) */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">출발일 *</label>
                <input
                  type="date"
                  {...register('usage_date')}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.usage_date && <p className="mt-1 text-xs text-red-500">{errors.usage_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">도착일</label>
                <input
                  type="date"
                  value={tripEndDate}
                  min={usageDate}
                  onChange={e => { setTripEndDate(e.target.value); setTripError('') }}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 자동 계산 결과만 표시 (레이블 없이) */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-700">{tripTypeLabel}</span>
            </div>

            {/* 당일 출장 상세: 출발 시각 + 운행 시간 */}
            {sameDayActive && !isMultiDay && (
              <div className="mt-3 space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">출발 시각</label>
                  <input
                    type="time"
                    value={tripStartTime}
                    onChange={e => setTripStartTime(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">운행 시간</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      inputMode="decimal"
                      {...register('duration_hours', { valueAsNumber: true })}
                      className="flex-1 px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">시간</span>
                  </div>
                </div>
              </div>
            )}

            {/* 다박 출장: 출발/도착 시각 + 자동 계산 */}
            {isMultiDay && (
              <div className="mt-3 space-y-3 pt-3 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">출발 시각</label>
                    <input
                      type="time"
                      value={tripStartTime}
                      onChange={e => setTripStartTime(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">도착 시각</label>
                    <input
                      type="time"
                      value={tripEndTime}
                      onChange={e => { setTripEndTime(e.target.value); setTripError('') }}
                      className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {calculatedDuration !== null && (
                  <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-blue-700">총 운행 시간</span>
                    <span className="text-sm font-bold text-blue-800">{calculatedDuration}시간</span>
                  </div>
                )}
                {tripError && <p className="text-xs text-red-500">{tripError}</p>}
              </div>
            )}
          </div>

          {/* 상세 필드 — 당일 출장 pill 또는 다박 출장 시 표시 */}
          {sameDayActive && (
            <>
              {/* 목적지 / 경유지 */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">목적지 *</label>
                  <input
                    type="text"
                    {...register('destination')}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예) 경기 수원"
                  />
                  {errors.destination && <p className="mt-1 text-xs text-red-500">{errors.destination.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    경유지 <span className="text-gray-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    {...register('waypoint')}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 현재 계기판 */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">현재 계기판 (누적) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    {...register('cumulative_distance', { valueAsNumber: true })}
                    className="flex-1 px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예) 15234"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">km</span>
                </div>
                {errors.cumulative_distance && <p className="mt-1 text-xs text-red-500">{errors.cumulative_distance.message}</p>}
                {distanceLoading && <p className="mt-2 text-xs text-gray-400">계산 중...</p>}
                {!distanceLoading && distanceInfo.error && (
                  <p className="mt-2 text-xs text-red-500">{distanceInfo.error}</p>
                )}
                {!distanceLoading && distanceInfo.distance !== null && !distanceInfo.error && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
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

              {/* 운행 시간 (다박이면 이미 자동 계산) + 주유량 */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                {!isMultiDay && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">운행 시간</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        {...register('duration_hours', { valueAsNumber: true })}
                        className="flex-1 px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예) 2.5"
                      />
                      <span className="text-sm text-gray-500">시간</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    주유량 <span className="text-gray-400 font-normal">(선택)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      {...register('fuel_amount', { valueAsNumber: true })}
                      className="flex-1 px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예) 30.5"
                    />
                    <span className="text-sm text-gray-500">L</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {submitState === 'error' && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-sm text-red-600">저장에 실패했습니다. 다시 시도해주세요.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitState === 'submitting'}
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {submitState === 'submitting' ? '저장 중...' : '운행 기록 저장'}
          </button>
        </form>
      </div>
    </div>
  )
}
