import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { usePurposes } from '@/hooks/useEmployees'
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
  const [form, setForm] = useState({
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
      const result = await calcDistanceTraveled(record.vehicle_id!, Number(form.cumulative_distance), record.id)
      setDistInfo({ distance: result.distance, prev: result.prevOdometer ?? null })
    }, 600)
    return () => clearTimeout(t)
  }, [form.cumulative_distance, record.vehicle_id, record.id])

  async function handleSave() {
    setSaving(true)
    const newCumulative = Number(form.cumulative_distance)
    const distResult = record.vehicle_id
      ? await calcDistanceTraveled(record.vehicle_id, newCumulative, record.id)
      : { distance: null }
    const finalDistance = form.distance_traveled !== '' ? Number(form.distance_traveled) : distResult.distance
    const { error } = await supabase.from('driving_records').update({
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
    if (!error) onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        {/* 핸들 바 (모바일) */}
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
          {/* 날짜 표시 (읽기전용) */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{record.usage_date}</span>
            {record.end_date && record.end_date !== record.usage_date && (
              <span> ~ {record.end_date}</span>
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

        {/* 버튼 */}
        <div className="px-5 pb-6 pt-2 flex gap-3">
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
  )
}

export default function VehicleDashboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const vehicleId = searchParams.get('vehicle') ?? ''
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editingRecord, setEditingRecord] = useState<EditableRecord | null>(null)
  const queryClient = useQueryClient()

  const empSession: EmpSession | null = (() => {
    try { return JSON.parse(localStorage.getItem(EMP_SESSION_KEY) ?? 'null') } catch { return null }
  })()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // 차량 정보
  const { data: vehicle } = useQuery({
    queryKey: ['vehicle_info', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null
      const { data } = await supabase
        .from('vehicles')
        .select('id, name, license_plate')
        .eq('id', vehicleId)
        .single()
      return data
    },
    enabled: !!vehicleId,
  })

  // 전체 운행 기록
  const { data: allRecords, isLoading: loadingRecords } = useQuery({
    queryKey: ['vehicle_all_records', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return []
      const { data } = await supabase
        .from('driving_records')
        .select('id, vehicle_id, usage_date, end_date, driver_name, employee_id, purpose, waypoint, destination, distance_traveled, cumulative_distance, fuel_amount, duration_hours, departure_time, arrival_time, created_at')
        .eq('vehicle_id', vehicleId)
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!vehicleId,
    staleTime: 0,
  })

  // 통계용 월별 데이터
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: monthRecords } = useQuery({
    queryKey: ['vehicle_month_records', vehicleId, year, month],
    queryFn: async () => {
      if (!vehicleId) return []
      const { data } = await supabase
        .from('driving_records')
        .select('driver_name, purpose, distance_traveled, fuel_amount')
        .eq('vehicle_id', vehicleId)
        .gte('usage_date', monthStart)
        .lte('usage_date', monthEnd)
      return data ?? []
    },
    enabled: !!vehicleId,
    staleTime: 0,
  })

  // 이번 달 통계 (대시보드용 - 현재 월 고정)
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: thisMonthRecords } = useQuery({
    queryKey: ['vehicle_thismonth', vehicleId, thisMonthStart],
    queryFn: async () => {
      if (!vehicleId) return []
      const { data } = await supabase
        .from('driving_records')
        .select('driver_name, distance_traveled, fuel_amount, cumulative_distance')
        .eq('vehicle_id', vehicleId)
        .gte('usage_date', thisMonthStart)
        .lte('usage_date', thisMonthEnd)
      return data ?? []
    },
    enabled: !!vehicleId,
    staleTime: 0,
  })

  // 통계 계산
  const totalDistance = monthRecords?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const totalFuel = monthRecords?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0
  const avgFuelEff = totalFuel > 0 ? (totalDistance / totalFuel).toFixed(1) : '-'

  const driverStats = monthRecords?.reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
    if (!acc[r.driver_name]) acc[r.driver_name] = { 건수: 0, 거리: 0 }
    acc[r.driver_name].건수 += 1
    acc[r.driver_name].거리 += r.distance_traveled ?? 0
    return acc
  }, {})
  const driverChartData = Object.entries(driverStats ?? {}).map(([name, v]) => ({ name, ...v }))

  const purposeStats = monthRecords?.reduce<Record<string, number>>((acc, r) => {
    acc[r.purpose] = (acc[r.purpose] ?? 0) + 1
    return acc
  }, {})
  const purposeChartData = Object.entries(purposeStats ?? {}).map(([name, 건수]) => ({ name, 건수 }))

  // 이번 달 요약 (대시보드)
  const thisMonthDist = thisMonthRecords?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const thisMonthFuel = thisMonthRecords?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0
  const latestOdometer = allRecords?.[0]?.cumulative_distance ?? null

  function formatDateRange(r: { usage_date: string; end_date?: string | null }) {
    if (r.end_date && r.end_date !== r.usage_date) return `${r.usage_date} ~ ${r.end_date}`
    return r.usage_date
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '대시보드' },
    { key: 'records', label: '운행기록' },
    { key: 'stats', label: '통계' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-sm font-bold text-gray-900">{vehicle?.name ?? '차량 대시보드'}</p>
            {vehicle?.license_plate && (
              <p className="text-xs text-gray-400">{vehicle.license_plate}</p>
            )}
          </div>
        </div>
        {empSession?.department_id && (
          <button
            onClick={() => navigate(`/department/dashboard?department=${empSession.department_id}`)}
            className="flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
          >
            우리과 현황보기
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
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
          <div className="space-y-4">
            {/* 이번 달 요약 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">
                이번 달 ({now.getFullYear()}년 {now.getMonth() + 1}월)
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '총 운행 횟수', value: `${thisMonthRecords?.length ?? 0}회`, color: 'text-blue-600' },
                  { label: '총 주행거리', value: `${thisMonthDist.toLocaleString()}km`, color: 'text-green-600' },
                  { label: '총 주유량', value: `${thisMonthFuel.toFixed(1)}L`, color: 'text-orange-500' },
                  { label: '현재 계기판', value: latestOdometer != null ? `${latestOdometer.toLocaleString()}km` : '-', color: 'text-purple-600' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 최근 운행 기록 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">최근 운행 기록</p>
              {loadingRecords ? (
                <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
              ) : !allRecords || allRecords.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">운행 기록이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {allRecords.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <span className="text-xs text-gray-400">{formatDateRange(r)}</span>
                          <p className="text-sm font-semibold text-gray-900">{r.driver_name}</p>
                        </div>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          {r.purpose}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>→ {r.destination}</span>
                        {r.distance_traveled != null && (
                          <span className="text-blue-600 font-medium">{r.distance_traveled}km</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {allRecords.length > 5 && (
                    <button
                      onClick={() => setTab('records')}
                      className="w-full py-2.5 text-sm text-blue-600 font-medium bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      전체 {allRecords.length}건 보기 →
                    </button>
                  )}
                </div>
              )}
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
                {allRecords.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs text-gray-400">{formatDateRange(r)}</span>
                        {(r as any).departure_time && (r as any).arrival_time && (
                          <span className="text-xs text-gray-400 ml-2">{(r as any).departure_time} ~ {(r as any).arrival_time}</span>
                        )}
                        <p className="text-sm font-semibold text-gray-900">{r.driver_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          {r.purpose}
                        </span>
                        {(empSession && (r as any).employee_id === empSession.id) && (
                          <button
                            onClick={() => setEditingRecord({
                              id: r.id,
                              vehicle_id: (r as any).vehicle_id ?? vehicleId,
                              usage_date: r.usage_date,
                              end_date: r.end_date ?? null,
                              departure_time: (r as any).departure_time ?? null,
                              arrival_time: (r as any).arrival_time ?? null,
                              purpose: r.purpose,
                              waypoint: r.waypoint ?? null,
                              destination: r.destination,
                              cumulative_distance: r.cumulative_distance,
                              distance_traveled: r.distance_traveled ?? null,
                              fuel_amount: r.fuel_amount ?? null,
                              duration_hours: r.duration_hours ?? null,
                            })}
                            className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                          >
                            수정
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 통계 탭 ── */}
        {tab === 'stats' && (
          <div>
            {/* 월 선택 */}
            <div className="flex items-center gap-2 mb-5">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: '총 운행 횟수', value: `${monthRecords?.length ?? 0}회`, color: 'text-blue-600' },
                { label: '총 주행거리', value: `${totalDistance.toLocaleString()}km`, color: 'text-green-600' },
                { label: '총 주유량', value: `${totalFuel.toFixed(1)}L`, color: 'text-orange-500' },
                { label: '평균 연비', value: avgFuelEff !== '-' ? `${avgFuelEff}km/L` : '-', color: 'text-purple-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* 운전자별 운행 건수 */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">운전자별 운행 건수</h3>
              {driverChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={driverChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="건수" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
              )}
            </div>

            {/* 운전자별 운행거리 */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">운전자별 운행거리</h3>
              {driverChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={driverChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="km" />
                    <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}km`, '운행거리']} />
                    <Bar dataKey="거리" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
              )}
            </div>

            {/* 용무별 운행 횟수 */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">용무별 운행 횟수</h3>
              {purposeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={purposeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="건수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="text-center py-4">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-500 border border-blue-100">SimpleFleet v1.2.0</span>
      </div>

      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['vehicle_all_records', vehicleId] })
            queryClient.invalidateQueries({ queryKey: ['vehicle_thismonth', vehicleId] })
            setEditingRecord(null)
          }}
        />
      )}
    </div>
  )
}
