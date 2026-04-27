import { useState, useEffect } from 'react'
import { useRecords } from '@/hooks/useRecords'
import { useAuth } from '@/hooks/useAuth'
import { useEmployees, useVehicles, usePurposes } from '@/hooks/useEmployees'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { calcDistanceTraveled, toDateString } from '@/utils/distanceCalc'
import { exportDrivingRecords, VEHICLE_MANAGER_MAP } from '@/utils/exportExcel'
import type { DrivingRecord } from '@/types'

type RecordWithJoins = DrivingRecord & {
  departments?: { name: string } | null
  vehicles?: { name: string; license_plate: string } | null
}

function formatDateRange(r: RecordWithJoins) {
  if (r.end_date && r.end_date !== r.usage_date) {
    return <>{r.usage_date}<br />{r.end_date}</>
  }
  return r.usage_date
}

function formatTripPeriod(r: RecordWithJoins) {
  if (r.end_date && r.end_date !== r.usage_date) {
    const start = new Date(r.usage_date)
    const end = new Date(r.end_date)
    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return nights === 1 ? '1박2일' : `${nights}박${nights + 1}일`
  }
  if (r.duration_hours != null) return `${r.duration_hours}시간`
  return '-'
}

function EditModal({
  record,
  onClose,
  onSave,
}: {
  record: RecordWithJoins
  onClose: () => void
  onSave: () => void
}) {
  const { data: purposes } = usePurposes()
  const { data: employees } = useEmployees(false)
  const [form, setForm] = useState({
    driver_name: record.driver_name,
    employee_id: record.employee_id ?? '',
    usage_date: record.usage_date,
    end_date: record.end_date ?? '',
    purpose: record.purpose,
    waypoint: record.waypoint ?? '',
    destination: record.destination,
    departure_time: record.departure_time ?? '',
    arrival_time: record.arrival_time ?? '',
    cumulative_distance: record.cumulative_distance.toString(),
    distance_traveled: record.distance_traveled?.toString() ?? '',
    fuel_amount: record.fuel_amount?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)

  function handleDriverChange(name: string) {
    const matched = employees?.find(e => e.name === name)
    setForm(f => ({ ...f, driver_name: name, employee_id: matched?.id ?? '' }))
  }

  const purposeNames = purposes?.map(p => p.name) ?? []
  const isCustomPurpose = purposeNames.length > 0 && !purposeNames.includes(form.purpose)
  const selectPurposeValue = isCustomPurpose ? '기타' : form.purpose

  function calcDuration(): number | null {
    if (!form.usage_date || !form.departure_time || !form.arrival_time) return null
    const dep = new Date(`${form.usage_date}T${form.departure_time}`)
    const arr = new Date(`${form.end_date || form.usage_date}T${form.arrival_time}`)
    const diff = (arr.getTime() - dep.getTime()) / (1000 * 60 * 60)
    return diff > 0 ? Math.round(diff * 100) / 100 : null
  }

  async function handleSave() {
    setSaving(true)
    const newCumulative = Number(form.cumulative_distance)
    const distResult = record.vehicle_id
      ? await calcDistanceTraveled(record.vehicle_id, newCumulative, record.id, form.usage_date || undefined)
      : { distance: null }
    const { error } = await supabase
      .from('driving_records')
      .update({
        driver_name: form.driver_name,
        employee_id: form.employee_id || null,
        usage_date: form.usage_date,
        end_date: form.end_date || null,
        purpose: form.purpose,
        waypoint: form.waypoint || null,
        destination: form.destination,
        departure_time: form.departure_time || null,
        arrival_time: form.arrival_time || null,
        duration_hours: calcDuration(),
        cumulative_distance: newCumulative,
        distance_traveled: form.distance_traveled !== '' ? Number(form.distance_traveled) : distResult.distance,
        fuel_amount: form.fuel_amount ? Number(form.fuel_amount) : null,
      })
      .eq('id', record.id)
    setSaving(false)
    if (!error) onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">운행 기록 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          {/* 운전자 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">운전자</label>
            <input
              type="text"
              list="mgr-edit-employee-names"
              value={form.driver_name}
              onChange={e => handleDriverChange(e.target.value)}
              placeholder="운전자 이름"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="mgr-edit-employee-names">
              {employees?.map(e => <option key={e.id} value={e.name} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">출발일</label>
              <input type="date" value={form.usage_date}
                onChange={e => setForm(f => ({ ...f, usage_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">도착일 <span className="text-gray-400 font-normal">(숙박 시)</span></label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">용무</label>
            <select
              value={selectPurposeValue}
              onChange={e => {
                if (e.target.value === '기타') {
                  setForm(f => ({ ...f, purpose: '' }))
                } else {
                  setForm(f => ({ ...f, purpose: e.target.value }))
                }
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {purposes?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="기타">기타 (직접입력)</option>
            </select>
            {(isCustomPurpose || selectPurposeValue === '기타') && (
              <input
                type="text"
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                placeholder="용무를 직접 입력하세요"
                className="w-full mt-2 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">경유지</label>
              <input type="text" value={form.waypoint}
                onChange={e => setForm(f => ({ ...f, waypoint: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">목적지</label>
              <input type="text" value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">출발시각</label>
              <TimeSelect value={form.departure_time} onChange={v => setForm(f => ({ ...f, departure_time: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">도착시각</label>
              <TimeSelect value={form.arrival_time} onChange={v => setForm(f => ({ ...f, arrival_time: v }))} />
            </div>
          </div>
          {calcDuration() !== null && (
            <p className="text-xs text-purple-600">운행시간 자동계산: {calcDuration()}시간</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">누적거리(km)</label>
              <input type="number" step="0.1" value={form.cumulative_distance}
                onChange={e => setForm(f => ({ ...f, cumulative_distance: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">운행거리(km)</label>
              <input type="number" step="0.1" value={form.distance_traveled}
                onChange={e => setForm(f => ({ ...f, distance_traveled: e.target.value }))}
                placeholder=""
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">주유량(L)</label>
              <input type="number" step="0.01" value={form.fuel_amount}
                onChange={e => setForm(f => ({ ...f, fuel_amount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(':') : ['', '']
  return (
    <div className="flex gap-1">
      <select value={h} onChange={e => onChange(`${e.target.value}:${m || '00'}`)}
        className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">시</option>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <select value={m} onChange={e => onChange(`${h || '00'}:${e.target.value}`)}
        className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">분</option>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  )
}

// 운행기록 추가 모달
function AddRecordModal({
  onClose,
  onSave,
  defaultDepartmentId,
  defaultVehicleId,
}: {
  onClose: () => void
  onSave: () => void
  defaultDepartmentId?: string
  defaultVehicleId?: string
}) {
  const { data: vehicles } = useVehicles(false)
  const { data: employees } = useEmployees(false)
  const { data: purposes } = usePurposes()
  const [form, setForm] = useState({
    vehicle_id: defaultVehicleId ?? '',
    employee_id: '',
    driver_name: '',
    department_id: defaultDepartmentId ?? '',
    usage_date: toDateString(),
    end_date: '',
    purpose: '',
    custom_purpose: '',
    waypoint: '',
    destination: '',
    cumulative_distance: '',
    fuel_amount: '',
    departure_time: '',
    arrival_time: '',
  })
  const [saving, setSaving] = useState(false)
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number | null; prev: number | null; err: string | null }>({ distance: null, prev: null, err: null })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function calcDuration(): number | null {
    if (!form.usage_date || !form.departure_time || !form.arrival_time) return null
    const dep = new Date(`${form.usage_date}T${form.departure_time}`)
    const arr = new Date(`${form.end_date || form.usage_date}T${form.arrival_time}`)
    const diff = (arr.getTime() - dep.getTime()) / (1000 * 60 * 60)
    return diff > 0 ? Math.round(diff * 100) / 100 : null
  }

  useEffect(() => {
    if (!form.vehicle_id || !form.cumulative_distance || isNaN(Number(form.cumulative_distance))) return
    const t = setTimeout(async () => {
      const result = await calcDistanceTraveled(form.vehicle_id, Number(form.cumulative_distance), undefined, form.usage_date || undefined)
      setDistanceInfo({ distance: result.distance, prev: result.prevOdometer, err: result.error })
    }, 600)
    return () => clearTimeout(t)
  }, [form.vehicle_id, form.cumulative_distance])

  function handleEmployeeChange(empId: string) {
    const emp = employees?.find(e => e.id === empId)
    setForm(f => ({
      ...f,
      employee_id: empId,
      driver_name: emp?.name ?? f.driver_name,
      department_id: emp?.department_id ?? f.department_id,
      vehicle_id: f.vehicle_id || ((emp as typeof emp & { default_vehicle_id?: string })?.default_vehicle_id ?? ''),
    }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.vehicle_id) e.vehicle_id = '차량을 선택하세요'
    if (!form.driver_name.trim()) e.driver_name = '운전자를 선택하세요'
    if (!form.usage_date) e.usage_date = '날짜를 선택하세요'
    if (!form.purpose) e.purpose = '용무를 선택하세요'
    if (form.purpose === '기타' && !form.custom_purpose.trim()) e.custom_purpose = '용무를 입력하세요'
    if (!form.destination.trim()) e.destination = '목적지를 입력하세요'
    if (!form.cumulative_distance || Number(form.cumulative_distance) <= 0) e.cumulative_distance = '누적거리를 입력하세요'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    const finalPurpose = form.purpose === '기타' ? form.custom_purpose : form.purpose
    const cumulative = Number(form.cumulative_distance)
    const distResult = await calcDistanceTraveled(form.vehicle_id, cumulative, undefined, form.usage_date || undefined)
    const { error } = await supabase.from('driving_records').insert({
      vehicle_id: form.vehicle_id,
      employee_id: form.employee_id || null,
      department_id: form.department_id || null,
      driver_name: form.driver_name,
      usage_date: form.usage_date,
      end_date: form.end_date || null,
      purpose: finalPurpose,
      waypoint: form.waypoint || null,
      destination: form.destination,
      cumulative_distance: cumulative,
      distance_traveled: distResult.distance,
      fuel_amount: form.fuel_amount ? Number(form.fuel_amount) : null,
      duration_hours: calcDuration(),
    })
    setSaving(false)
    if (!error) onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">운행 기록 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">차량 <span className="text-red-400">*</span></label>
              <select value={form.vehicle_id}
                onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.vehicle_id ? 'border-red-300' : 'border-gray-200'}`}>
                <option value="">차량 선택</option>
                {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {errors.vehicle_id && <p className="text-xs text-red-500 mt-0.5">{errors.vehicle_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">운전자 <span className="text-red-400">*</span></label>
              <select value={form.employee_id}
                onChange={e => handleEmployeeChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.driver_name ? 'border-red-300' : 'border-gray-200'}`}>
                <option value="">운전자 선택</option>
                {employees?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {errors.driver_name && <p className="text-xs text-red-500 mt-0.5">{errors.driver_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">출발일 <span className="text-red-400">*</span></label>
              <input type="date" value={form.usage_date}
                onChange={e => setForm(f => ({ ...f, usage_date: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.usage_date ? 'border-red-300' : 'border-gray-200'}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">출발시각</label>
              <TimeSelect value={form.departure_time} onChange={v => setForm(f => ({ ...f, departure_time: v }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">도착일 <span className="text-gray-400 font-normal">(숙박 시)</span></label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">도착시각</label>
              <TimeSelect value={form.arrival_time} onChange={v => setForm(f => ({ ...f, arrival_time: v }))} />
            </div>
          </div>
          {calcDuration() !== null && (
            <p className="text-xs text-purple-600">운행시간 자동계산: {calcDuration()}시간</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">용무 <span className="text-red-400">*</span></label>
            <select value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value, custom_purpose: '' }))}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.purpose ? 'border-red-300' : 'border-gray-200'}`}>
              <option value="">용무 선택</option>
              {purposes?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="기타">기타 (직접입력)</option>
            </select>
            {form.purpose === '기타' && (
              <input type="text" value={form.custom_purpose}
                onChange={e => setForm(f => ({ ...f, custom_purpose: e.target.value }))}
                placeholder="용무를 직접 입력하세요"
                className={`w-full mt-2 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.custom_purpose ? 'border-red-300' : 'border-blue-200'}`} />
            )}
            {(errors.purpose || errors.custom_purpose) && (
              <p className="text-xs text-red-500 mt-0.5">{errors.purpose || errors.custom_purpose}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">경유지</label>
              <input type="text" value={form.waypoint}
                onChange={e => setForm(f => ({ ...f, waypoint: e.target.value }))}
                placeholder="선택사항"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">목적지 <span className="text-red-400">*</span></label>
              <input type="text" value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.destination ? 'border-red-300' : 'border-gray-200'}`} />
              {errors.destination && <p className="text-xs text-red-500 mt-0.5">{errors.destination}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">누적거리(km) <span className="text-red-400">*</span></label>
            <input type="number" step="0.1" value={form.cumulative_distance}
              onChange={e => setForm(f => ({ ...f, cumulative_distance: e.target.value }))}
              placeholder="당시 계기판 숫자"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.cumulative_distance ? 'border-red-300' : 'border-gray-200'}`} />
            {errors.cumulative_distance && <p className="text-xs text-red-500 mt-0.5">{errors.cumulative_distance}</p>}
            {distanceInfo.distance !== null && (
              <p className="text-xs text-blue-600 mt-1">
                주행거리 {distanceInfo.distance}km
                {distanceInfo.prev !== null && <span className="text-gray-400 ml-1">(이전 {distanceInfo.prev.toLocaleString()}km)</span>}
              </p>
            )}
            {distanceInfo.err && <p className="text-xs text-orange-500 mt-1">{distanceInfo.err}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주유량(L)</label>
            <input type="number" step="0.01" min="0" value={form.fuel_amount}
              onChange={e => setForm(f => ({ ...f, fuel_amount: e.target.value }))}
              placeholder="선택사항"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? '저장 중...' : '운행기록 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 드롭다운 선택값: "emp:{id}" 또는 "name:{driver_name}"
const MANAGER_PREFIX = 'name:'
const EMP_PREFIX = 'emp:'

export default function ManagerRecordsPage() {
  const { profile } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [driverFilter, setDriverFilter] = useState('') // "emp:{id}" | "name:{name}" | ""
  const [vehicleId, setVehicleId] = useState('')
  const [editingRecord, setEditingRecord] = useState<RecordWithJoins | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingRecord, setAddingRecord] = useState(false)

  // 관리자의 주 사용 차량을 기본 필터로 설정
  useEffect(() => {
    if (profile?.default_vehicle_id && !vehicleId) {
      setVehicleId(profile.default_vehicle_id)
    }
  }, [profile?.default_vehicle_id])

  // driverFilter 파싱
  const employeeId = driverFilter.startsWith(EMP_PREFIX) ? driverFilter.slice(EMP_PREFIX.length) : undefined
  const driverName = driverFilter.startsWith(MANAGER_PREFIX) ? driverFilter.slice(MANAGER_PREFIX.length) : undefined

  const { data: records, isLoading } = useRecords({
    startDate,
    endDate,
    departmentId: profile?.department_id ?? undefined,
    employeeId,
    driverName,
    vehicleId,
  })
  const { data: allEmployees } = useEmployees(false)
  // 관리자 소속 실의 운전자만 표시
  const employees = allEmployees?.filter(e =>
    profile?.team_id ? e.team_id === profile.team_id : true
  )
  const { data: vehicles } = useVehicles(false)
  const queryClient = useQueryClient()

  function handleEditSaved() {
    queryClient.invalidateQueries({ queryKey: ['driving_records'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard_dept_records'] })
    queryClient.invalidateQueries({ queryKey: ['recent_records'] })
    setEditingRecord(null)
  }

  function handleAddSaved() {
    queryClient.invalidateQueries({ queryKey: ['driving_records'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard_dept_records'] })
    queryClient.invalidateQueries({ queryKey: ['recent_records'] })
    setAddingRecord(false)
  }

  async function handleDelete(id: string, driverName: string) {
    if (!window.confirm(`'${driverName}'의 운행 기록을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return
    setDeletingId(id)
    await supabase.from('driving_records').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['driving_records'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard_dept_records'] })
    queryClient.invalidateQueries({ queryKey: ['recent_records'] })
    setDeletingId(null)
  }

  function exportToExcel() {
    if (!records) return
    const selectedVehicle = vehicles?.find(v => v.id === vehicleId)
    const vehiclePlate = selectedVehicle?.license_plate ?? ''
    const managerName = selectedVehicle ? (VEHICLE_MANAGER_MAP[selectedVehicle.name] ?? profile?.full_name ?? '') : (profile?.full_name ?? '')
    const dateTag = (startDate && endDate) ? `${startDate}~${endDate}` : new Date().toISOString().split('T')[0]
    exportDrivingRecords(records as unknown as Parameters<typeof exportDrivingRecords>[0], {
      vehicleName: selectedVehicle?.name,
      vehiclePlate,
      managerName,
      filename: `운행기록_${vehiclePlate || '전체'}_${dateTag}.xlsx`,
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {editingRecord && (
        <EditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={handleEditSaved}
        />
      )}
      {addingRecord && (
        <AddRecordModal
          onClose={() => setAddingRecord(false)}
          onSave={handleAddSaved}
          defaultDepartmentId={profile?.department_id ?? undefined}
          defaultVehicleId={profile?.default_vehicle_id ?? undefined}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">운행 기록 조회</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddingRecord(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            운행기록 추가
          </button>
          <button onClick={exportToExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            차량운행일지 출력
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">차량</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">전체</option>
              {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">운전자</label>
            <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">전체</option>
              {profile?.full_name && (
                <option value={`${MANAGER_PREFIX}${profile.full_name}`}>
                  {profile.full_name} (관리자)
                </option>
              )}
              {employees?.map(e => (
                <option key={e.id} value={`${EMP_PREFIX}${e.id}`}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['사용일자', '출발/도착', '운전자', '용무', '경유지', '목적지', '운행기간', '운행거리', '누적거리', '주유량', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              )}
              {!isLoading && records?.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">기록이 없습니다</td></tr>
              )}
              {(records as unknown as RecordWithJoins[] | undefined)?.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">{formatDateRange(r)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-500 text-xs">
                    {r.departure_time && r.arrival_time
                      ? <>{r.departure_time}<br />{r.arrival_time}</>
                      : '-'}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">{r.driver_name}</td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{r.purpose}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs max-w-20 truncate">{r.waypoint ?? '-'}</td>
                  <td className="px-3 py-3 text-gray-600 text-xs max-w-28 truncate">{r.destination}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    {r.end_date && r.end_date !== r.usage_date ? (
                      <span className="text-violet-600 font-medium">{formatTripPeriod(r)}</span>
                    ) : (
                      <span className="text-blue-600">{formatTripPeriod(r)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-blue-600 font-medium text-xs whitespace-nowrap">
                    {r.distance_traveled != null ? `${r.distance_traveled}km` : '-'}
                  </td>
                  <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{r.cumulative_distance.toLocaleString()}km</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{r.fuel_amount != null ? `${r.fuel_amount}L` : '-'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingRecord(r)}
                        className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(r.id, r.driver_name)}
                        disabled={deletingId === r.id}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records && records.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50">
            <p className="text-xs text-gray-400">총 {records.length}건</p>
          </div>
        )}
      </div>
    </div>
  )
}
