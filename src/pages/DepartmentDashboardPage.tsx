import { useState, useEffect, type ReactNode } from 'react'

type MonthValue = number | 'all'

const TEAM_ORDER = ['숲푸드자원연구실', '스마트재배푸드테크연구실', '조경밀원자원연구실']
const VEHICLE_ORDER = ['숲푸드트럭', '스마트달구지', '꿀벌붕붕카', '꿀벌 붕붕카']

function sortByOrder<T extends { name: string }>(data: T[], order: string[]): T[] {
  return [...data].sort((a, b) => {
    const ai = order.findIndex(o => a.name === o || a.name.replace(/\s/g, '') === o.replace(/\s/g, ''))
    const bi = order.findIndex(o => b.name === o || b.name.replace(/\s/g, '') === o.replace(/\s/g, ''))
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { usePurposes, useEmployees } from '@/hooks/useEmployees'
import { calcDistanceTraveled } from '@/utils/distanceCalc'
import { EMP_SESSION_KEY } from './EmployeeLoginPage'
import type { EmpSession } from './EmployeeLoginPage'

type Tab = 'dashboard' | 'records' | 'stats'

// ─── 24시간 시/분 셀렉트 ────────────────────────────────────────────────────
const TS_H = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const TS_M = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(':') : ['', '']
  return (
    <div className="flex gap-2">
      <select value={h} onChange={e => onChange(`${e.target.value}:${m || '00'}`)}
        className="flex-1 px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">시</option>
        {TS_H.map(hh => <option key={hh} value={hh}>{hh}시</option>)}
      </select>
      <select value={m} onChange={e => onChange(`${h || '00'}:${e.target.value}`)}
        className="flex-1 px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">분</option>
        {TS_M.map(mm => <option key={mm} value={mm}>{mm}분</option>)}
      </select>
    </div>
  )
}

// ─── 운행기록 수정 모달 ──────────────────────────────────────────────────────
type EditableRecord = {
  id: string
  vehicle_id: string | null
  employee_id: string | null
  driver_name: string
  usage_date: string
  end_date: string | null
  departure_time: string | null
  arrival_time: string | null
  purpose: string
  waypoint: string | null
  destination: string
  cumulative_distance: number
  distance_traveled: number | null
  fuel_amount: number | null
  duration_hours: number | null
}

function EditRecordModal({
  record,
  onClose,
  onSave,
}: {
  record: EditableRecord
  onClose: () => void
  onSave: () => void
}) {
  const { data: purposes } = usePurposes()
  const { data: employees } = useEmployees(true)
  const [form, setForm] = useState({
    driver_name: record.driver_name,
    employee_id: record.employee_id ?? '',
    purpose: record.purpose,
    waypoint: record.waypoint ?? '',
    destination: record.destination,
    departure_time: record.departure_time ?? '',
    arrival_time: record.arrival_time ?? '',
    cumulative_distance: record.cumulative_distance.toString(),
    distance_traveled: record.distance_traveled?.toString() ?? '',
    fuel_amount: record.fuel_amount?.toString() ?? '',
  })

  function handleDriverChange(name: string) {
    const matched = employees?.find(e => e.name === name)
    setForm(f => ({ ...f, driver_name: name, employee_id: matched?.id ?? '' }))
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [distInfo, setDistInfo] = useState<{ distance: number | null; prev: number | null }>({ distance: null, prev: null })

  const purposeNames = purposes?.map(p => p.name) ?? []
  const isCustomPurpose = purposeNames.length > 0 && !purposeNames.includes(form.purpose)
  const selectPurposeValue = isCustomPurpose ? '기타' : form.purpose

  function calcDuration(): number | null {
    if (!record.usage_date || !form.departure_time || !form.arrival_time) return null
    const dep = new Date(`${record.usage_date}T${form.departure_time}`)
    const arr = new Date(`${record.end_date || record.usage_date}T${form.arrival_time}`)
    const diff = (arr.getTime() - dep.getTime()) / (1000 * 60 * 60)
    return diff > 0 ? Math.round(diff * 100) / 100 : null
  }

  useEffect(() => {
    if (!record.vehicle_id || !form.cumulative_distance || isNaN(Number(form.cumulative_distance))) return
    const t = setTimeout(async () => {
      const result = await calcDistanceTraveled(record.vehicle_id!, Number(form.cumulative_distance), record.id, record.usage_date)
      setDistInfo({ distance: result.distance, prev: result.prevOdometer ?? null })
    }, 600)
    return () => clearTimeout(t)
  }, [form.cumulative_distance, record.vehicle_id, record.id, record.usage_date])

  async function handleSave() {
    setSaving(true)
    const newCumulative = Number(form.cumulative_distance)
    const distResult = record.vehicle_id
      ? await calcDistanceTraveled(record.vehicle_id, newCumulative, record.id, record.usage_date)
      : { distance: null }
    const finalDistance = form.distance_traveled !== '' ? Number(form.distance_traveled) : distResult.distance
    const { error } = await supabase.from('driving_records').update({
      driver_name: form.driver_name,
      employee_id: form.employee_id || null,
      purpose: form.purpose,
      waypoint: form.waypoint || null,
      destination: form.destination,
      departure_time: form.departure_time || null,
      arrival_time: form.arrival_time || null,
      duration_hours: calcDuration(),
      cumulative_distance: newCumulative,
      distance_traveled: finalDistance,
      fuel_amount: form.fuel_amount ? Number(form.fuel_amount) : null,
    }).eq('id', record.id)
    setSaving(false)
    if (error) {
      setSaveError('저장에 실패했습니다. 관리자에게 문의하세요.')
    } else {
      onSave()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">운행 기록 수정</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{record.usage_date}</span>
            {record.end_date && record.end_date !== record.usage_date && (
              <span> ~ {record.end_date}</span>
            )}
          </div>

          {/* 운전자 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">운전자</label>
            <input
              type="text"
              list="dd-edit-employee-names"
              value={form.driver_name}
              onChange={e => handleDriverChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="dd-edit-employee-names">
              {employees?.map(e => <option key={e.id} value={e.name} />)}
            </datalist>
            {form.employee_id && (
              <p className="text-xs text-blue-500 mt-1">✓ 등록된 직원 — 다음 수정 권한이 이 직원에게 부여됩니다</p>
            )}
          </div>

          {/* 용무 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">용무</label>
            <select value={selectPurposeValue}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value === '기타' ? '' : e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {purposes?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="기타">기타 (직접입력)</option>
            </select>
            {(isCustomPurpose || selectPurposeValue === '기타') && (
              <input type="text" value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                placeholder="용무를 직접 입력하세요"
                className="w-full mt-2 px-4 py-3 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>

          {/* 경유지 / 목적지 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">경유지</label>
              <input type="text" value={form.waypoint}
                onChange={e => setForm(f => ({ ...f, waypoint: e.target.value }))}
                placeholder="선택사항"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">목적지</label>
              <input type="text" value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* 출발 / 도착 시각 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">출발시각</label>
              <TimeSelect value={form.departure_time} onChange={v => setForm(f => ({ ...f, departure_time: v }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">도착시각</label>
              <TimeSelect value={form.arrival_time} onChange={v => setForm(f => ({ ...f, arrival_time: v }))} />
            </div>
          </div>
          {calcDuration() !== null && (
            <p className="text-xs text-purple-600 -mt-1">운행시간 자동계산: {calcDuration()}시간</p>
          )}

          {/* 누적거리 / 운행거리 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">당시 계기판(km)</label>
              <input type="number" step="0.1" value={form.cumulative_distance}
                onChange={e => setForm(f => ({ ...f, cumulative_distance: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {distInfo.distance !== null && (
                <p className="text-xs text-blue-500 mt-1">→ 운행거리 {distInfo.distance}km</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">운행거리(km)</label>
              <input type="number" step="0.1" value={form.distance_traveled}
                onChange={e => setForm(f => ({ ...f, distance_traveled: e.target.value }))}
                placeholder=""
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* 주유량 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">주유량(L)</label>
            <input type="number" step="0.01" value={form.fuel_amount}
              onChange={e => setForm(f => ({ ...f, fuel_amount: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="px-5 pb-6 pt-2">
          {saveError && (
            <p className="text-xs text-red-500 text-center mb-3 bg-red-50 rounded-lg py-2">{saveError}</p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              취소
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export default function DepartmentDashboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const departmentId = searchParams.get('department') ?? ''
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editingRecord, setEditingRecord] = useState<EditableRecord | null>(null)
  const queryClient = useQueryClient()

  const empSession: EmpSession | null = (() => {
    try { return JSON.parse(localStorage.getItem(EMP_SESSION_KEY) ?? 'null') } catch { return null }
  })()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<MonthValue>('all')

  const TABS: { key: Tab; label: ReactNode }[] = [
    { key: 'dashboard', label: '대시보드' },
    { key: 'records', label: <><div>운행기록</div><div className="text-[10px] font-normal">(수정가능)</div></> },
    { key: 'stats', label: '통계' },
  ]

  // 부서 정보
  const { data: department } = useQuery({
    queryKey: ['dept_info', departmentId],
    queryFn: async () => {
      if (!departmentId) return null
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('id', departmentId)
        .single()
      return data
    },
    enabled: !!departmentId,
    staleTime: 0,
  })

  // 전체 운행 기록
  const { data: allRecords, isLoading: loadingRecords } = useQuery({
    queryKey: ['dept_all_records', departmentId],
    queryFn: async () => {
      if (!departmentId) return []
      const { data } = await supabase
        .from('driving_records')
        .select('id, vehicle_id, usage_date, end_date, driver_name, employee_id, purpose, waypoint, destination, distance_traveled, cumulative_distance, fuel_amount, duration_hours, departure_time, arrival_time, created_at, vehicles(name, license_plate)')
        .eq('department_id', departmentId)
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })
      return (data ?? []) as (typeof data extends (infer T)[] | null ? T : never)[]
    },
    enabled: !!departmentId,
    staleTime: 0,
  })

  // 통계용 데이터 (연도 전체 or 월별)
  const statsStart = month === 'all' ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`
  const statsEnd = month === 'all' ? `${year}-12-31` : new Date(year, month as number, 0).toISOString().split('T')[0]

  const { data: monthRecords } = useQuery({
    queryKey: ['dept_month_records', departmentId, year, month],
    queryFn: async () => {
      if (!departmentId) return []
      const { data } = await supabase
        .from('driving_records')
        .select('driver_name, purpose, distance_traveled, fuel_amount, vehicles(name), employees(name, teams(name))')
        .eq('department_id', departmentId)
        .gte('usage_date', statsStart)
        .lte('usage_date', statsEnd)
      return data ?? []
    },
    enabled: !!departmentId,
    staleTime: 0,
  })

  // 누적 전체 통계
  const totalCountAll = allRecords?.length ?? 0
  const totalDistanceAll = allRecords?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const totalHoursAll = allRecords?.reduce((s, r) => s + (r.duration_hours ?? 0), 0) ?? 0
  const totalFuelAll = allRecords?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0

  // 베스트 드라이버 집계
  const driverMap = new Map<string, { trips: number; distance: number }>()
  for (const r of allRecords ?? []) {
    const key = r.driver_name
    if (!driverMap.has(key)) driverMap.set(key, { trips: 0, distance: 0 })
    const d = driverMap.get(key)!
    d.trips += 1
    d.distance += r.distance_traveled ?? 0
  }
  const driverEntries = [...driverMap.entries()]
  const bestCheckinPerson = driverEntries.length
    ? driverEntries.reduce((a, b) => (b[1].trips > a[1].trips ? b : a))
    : null
  const bestMileagePerson = driverEntries.length
    ? driverEntries.reduce((a, b) => (b[1].distance > a[1].distance ? b : a))
    : null

  const vehicleMap2 = new Map<string, { trips: number; distance: number }>()
  for (const r of allRecords ?? []) {
    const veh = (r as typeof r & { vehicles?: { name: string } | null }).vehicles
    const key = veh?.name ?? '(차량 미상)'
    if (!vehicleMap2.has(key)) vehicleMap2.set(key, { trips: 0, distance: 0 })
    const v = vehicleMap2.get(key)!
    v.trips += 1
    v.distance += r.distance_traveled ?? 0
  }
  const vehicleEntries = [...vehicleMap2.entries()]
  const bestCheckinVehicle = vehicleEntries.length
    ? vehicleEntries.reduce((a, b) => (b[1].trips > a[1].trips ? b : a))
    : null
  const bestMileageVehicle = vehicleEntries.length
    ? vehicleEntries.reduce((a, b) => (b[1].distance > a[1].distance ? b : a))
    : null

  // 통계 집계
  type MR = NonNullable<typeof monthRecords>[number]

  const totalDistance = monthRecords?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const totalFuel = monthRecords?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0
  const avgFuelEff = totalFuel > 0 ? (totalDistance / totalFuel).toFixed(1) : '-'

  // 실별
  const teamChartData = sortByOrder(
    Object.entries(
      (monthRecords ?? []).reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
        const name = ((r as MR & { employees?: { teams?: { name: string } | null } | null }).employees?.teams?.name) ?? null
        if (!name) return acc
        if (!acc[name]) acc[name] = { 건수: 0, 거리: 0 }
        acc[name].건수 += 1
        acc[name].거리 += r.distance_traveled ?? 0
        return acc
      }, {})
    ).map(([name, v]) => ({ name, ...v })),
    TEAM_ORDER
  )

  // 차량별
  const vehicleChartData = sortByOrder(
    Object.entries(
      (monthRecords ?? []).reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
        const name = ((r as MR & { vehicles?: { name: string } | null }).vehicles?.name) ?? null
        if (!name) return acc
        if (!acc[name]) acc[name] = { 건수: 0, 거리: 0 }
        acc[name].건수 += 1
        acc[name].거리 += r.distance_traveled ?? 0
        return acc
      }, {})
    ).map(([name, v]) => ({ name, ...v })),
    VEHICLE_ORDER
  )

  // 운전자별
  const driverChartData = Object.entries(
    (monthRecords ?? []).reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
      if (!acc[r.driver_name]) acc[r.driver_name] = { 건수: 0, 거리: 0 }
      acc[r.driver_name].건수 += 1
      acc[r.driver_name].거리 += r.distance_traveled ?? 0
      return acc
    }, {})
  ).map(([name, v]) => ({ name, ...v }))

  // 용무별
  const purposeChartData = Object.entries(
    (monthRecords ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.purpose] = (acc[r.purpose] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, 건수]) => ({ name, 건수 })).sort((a, b) => b.건수 - a.건수)

  function formatDateRange(r: { usage_date: string; end_date?: string | null }) {
    if (r.end_date && r.end_date !== r.usage_date) return `${r.usage_date} ~ ${r.end_date}`
    return r.usage_date
  }

  function vehicleColor(name: string | undefined): string {
    if (!name) return 'text-gray-500 bg-gray-50 border-gray-200'
    const n = name.replace(/\s/g, '')
    if (n.includes('숲푸드트럭')) return 'text-green-700 bg-green-50 border-green-200'
    if (n.includes('스마트달구지')) return 'text-blue-700 bg-blue-50 border-blue-200'
    if (n.includes('꿀벌붕붕카')) return 'text-amber-700 bg-amber-50 border-amber-200'
    return 'text-gray-500 bg-gray-50 border-gray-200'
  }

  type RecordItem = NonNullable<typeof allRecords>[number]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="text-sm font-bold text-gray-900">{department?.name ?? '부서 현황'}</p>
          <p className="text-xs text-gray-400">전체 누적 현황</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">

        {/* ── 대시보드 탭 ── */}
        {tab === 'dashboard' && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">베스트 드라이버</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    emoji: '🏁',
                    title: '최다 체크이너',
                    name: bestCheckinPerson?.[0] ?? null,
                    stat: bestCheckinPerson ? `총 ${bestCheckinPerson[1].trips}회 운행` : '데이터 없음',
                    bg: 'border-blue-100 bg-blue-50',
                    text: 'text-blue-600',
                  },
                  {
                    emoji: '🚗',
                    title: '최다 체크인',
                    name: bestCheckinVehicle?.[0] ?? null,
                    stat: bestCheckinVehicle ? `총 ${bestCheckinVehicle[1].trips}회 운행` : '데이터 없음',
                    bg: 'border-sky-100 bg-sky-50',
                    text: 'text-sky-600',
                  },
                  {
                    emoji: '🛣️',
                    title: '최장 마일리저',
                    name: bestMileagePerson?.[0] ?? null,
                    stat: bestMileagePerson ? `총 ${bestMileagePerson[1].distance.toLocaleString()}km` : '데이터 없음',
                    bg: 'border-violet-100 bg-violet-50',
                    text: 'text-violet-600',
                  },
                  {
                    emoji: '🚙',
                    title: '최장 마일리지',
                    name: bestMileageVehicle?.[0] ?? null,
                    stat: bestMileageVehicle ? `총 ${bestMileageVehicle[1].distance.toLocaleString()}km` : '데이터 없음',
                    bg: 'border-indigo-100 bg-indigo-50',
                    text: 'text-indigo-600',
                  },
                ].map(c => (
                  <div key={c.title} className={`rounded-xl border p-4 ${c.bg}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">{c.emoji}</span>
                      <p className={`text-xs font-semibold ${c.text}`}>{c.title}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 truncate">{c.name ?? '-'}</p>
                    <p className={`text-xs mt-0.5 ${c.text}`}>{c.stat}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">전체 누적 현황</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '누적 운행 횟수', value: `${totalCountAll}회`, color: 'text-blue-600' },
                  { label: '누적 주행거리', value: `${totalDistanceAll.toLocaleString()}km`, color: 'text-green-600' },
                  { label: '누적 주유량', value: `${totalFuelAll.toFixed(1)}L`, color: 'text-orange-500' },
                  { label: '총 운행 시간', value: `${totalHoursAll.toFixed(1)}h`, color: 'text-purple-600' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 운행기록 탭 ── */}
        {tab === 'records' && (
          <div>
            {loadingRecords ? (
              <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : !allRecords || allRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">운행 기록이 없습니다</div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-3">총 {allRecords.length}건</p>
                {allRecords.map((r: RecordItem) => {
                  const veh = (r as typeof r & { vehicles?: { name: string; license_plate: string } | null }).vehicles
                  const empId = (r as typeof r & { employee_id?: string | null }).employee_id
                  const canEdit = empSession && empId === empSession.id
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs text-gray-400">{formatDateRange(r)}</span>
                          <p className="text-sm font-semibold text-gray-900">{r.driver_name}</p>
                          {veh && (
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${vehicleColor(veh.name)}`}>
                              {veh.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                            {r.purpose}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => setEditingRecord({
                                id: r.id,
                                vehicle_id: (r as typeof r & { vehicle_id?: string | null }).vehicle_id ?? null,
                                employee_id: empId ?? null,
                                driver_name: r.driver_name,
                                usage_date: r.usage_date,
                                end_date: r.end_date ?? null,
                                departure_time: (r as typeof r & { departure_time?: string | null }).departure_time ?? null,
                                arrival_time: (r as typeof r & { arrival_time?: string | null }).arrival_time ?? null,
                                purpose: r.purpose,
                                waypoint: r.waypoint ?? null,
                                destination: r.destination,
                                cumulative_distance: r.cumulative_distance,
                                distance_traveled: r.distance_traveled ?? null,
                                fuel_amount: r.fuel_amount ?? null,
                                duration_hours: r.duration_hours ?? null,
                              })}
                              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1 rounded-lg transition-colors shadow-sm"
                            >
                              ✏️ 수정
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                        {r.waypoint && <span>경유: {r.waypoint} →</span>}
                        <span>{r.destination}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        {r.distance_traveled != null && (
                          <span className="text-blue-600 font-medium">{r.distance_traveled}km</span>
                        )}
                        <span className="text-gray-400">누적 {r.cumulative_distance.toLocaleString()}km</span>
                        {r.fuel_amount != null && (
                          <span className="text-orange-500">{r.fuel_amount}L 주유</span>
                        )}
                        {r.duration_hours != null && (
                          <span className="text-gray-400">{r.duration_hours}시간</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 통계 탭 ── */}
        {tab === 'stats' && (() => {
          const noData = <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: 160 }}>데이터 없음</div>
          const selectClass = "px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

          function Chart({ data, dataKey, color, unit, formatter }: {
            data: object[]
            dataKey: string
            color: string
            unit?: string
            formatter?: (v: unknown) => [string, string]
          }) {
            return (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data} margin={{ top: 4, right: 10, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit={unit} allowDecimals={false} />
                  <Tooltip formatter={formatter} />
                  <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }

          function Section({ title, data, distColor, cntColor }: {
            title: string
            data: { name: string; 거리: number; 건수: number }[]
            distColor: string
            cntColor: string
          }) {
            if (data.length === 0) return null
            return (
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
                <p className="text-xs text-gray-400 mb-2">거리 (km)</p>
                <Chart data={data} dataKey="거리" color={distColor} unit="km"
                  formatter={(v) => [`${Number(v).toLocaleString()}km`, '거리']} />
                <p className="text-xs text-gray-400 mt-3 mb-2">건수 (회)</p>
                <Chart data={data} dataKey="건수" color={cntColor}
                  formatter={(v) => [`${v}회`, '건수']} />
              </div>
            )
          }

          return (
            <div>
              {/* 연도/월 선택 */}
              <div className="flex items-center gap-2 mb-4">
                <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectClass}>
                  {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select value={month} onChange={e => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={selectClass}>
                  <option value="all">전체</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
              </div>

              {/* 요약 카드 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: '총 운행 횟수', value: `${monthRecords?.length ?? 0}회`, color: 'text-blue-600' },
                  { label: '총 주행거리', value: `${totalDistance.toLocaleString()}km`, color: 'text-green-600' },
                  { label: '총 주유량', value: `${totalFuel.toFixed(1)}L`, color: 'text-orange-500' },
                  { label: '평균 연비', value: avgFuelEff !== '-' ? `${avgFuelEff}km/L` : '-', color: 'text-purple-600' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* 실별 사용 현황 */}
              <Section title="실별 사용 현황" data={teamChartData} distColor="#ec4899" cntColor="#8b5cf6" />

              {/* 차량별 운행 현황 */}
              <Section title="차량별 운행 현황" data={vehicleChartData} distColor="#06b6d4" cntColor="#f59e0b" />

              {/* 용무별 운행 횟수 */}
              {purposeChartData.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">용무별 운행 횟수</h3>
                  {noData && purposeChartData.length > 0
                    ? <Chart data={purposeChartData} dataKey="건수" color="#8b5cf6" formatter={(v) => [`${v}회`, '건수']} />
                    : noData}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">용무별 운행 횟수</h3>
                  {noData}
                </div>
              )}

              {/* 운전자별 운행 현황 */}
              {driverChartData.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">운전자별 운행 현황</h3>
                  <p className="text-xs text-gray-400 mb-2">거리 (km)</p>
                  <Chart data={driverChartData} dataKey="거리" color="#06b6d4" unit="km"
                    formatter={(v) => [`${Number(v).toLocaleString()}km`, '거리']} />
                  <p className="text-xs text-gray-400 mt-3 mb-2">건수 (회)</p>
                  <Chart data={driverChartData} dataKey="건수" color="#f59e0b"
                    formatter={(v) => [`${v}회`, '건수']} />
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">운전자별 운행 현황</h3>
                  {noData}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      <div className="text-center py-4 space-y-1">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-500 border border-blue-100">SimpleFleet v1.3.0</span>
        <p className="text-xs text-gray-400">© 2026 MSKIM, All rights reserved.</p>
      </div>

      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={() => {
            setEditingRecord(null)
            queryClient.invalidateQueries({ queryKey: ['dept_all_records', departmentId] })
          }}
        />
      )}
    </div>
  )
}
