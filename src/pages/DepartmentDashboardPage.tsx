import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'

type Tab = 'dashboard' | 'records' | 'stats'

export default function DepartmentDashboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const departmentId = searchParams.get('department') ?? ''
  const [tab, setTab] = useState<Tab>('dashboard')

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '대시보드' },
    { key: 'records', label: '운행기록' },
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
        .select('id, usage_date, end_date, driver_name, purpose, waypoint, destination, distance_traveled, cumulative_distance, fuel_amount, duration_hours, created_at, vehicles(name, license_plate)')
        .eq('department_id', departmentId)
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })
      return (data ?? []) as (typeof data extends (infer T)[] | null ? T : never)[]
    },
    enabled: !!departmentId,
    staleTime: 0,
  })

  // 통계용 월별 데이터
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: monthRecords } = useQuery({
    queryKey: ['dept_month_records', departmentId, year, month],
    queryFn: async () => {
      if (!departmentId) return []
      const { data } = await supabase
        .from('driving_records')
        .select('driver_name, purpose, distance_traveled, fuel_amount')
        .eq('department_id', departmentId)
        .gte('usage_date', monthStart)
        .lte('usage_date', monthEnd)
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

  // 베스트 드라이버 집계 (전체 기록 기준)
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

  // 월별 통계
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

  function formatDateRange(r: { usage_date: string; end_date?: string | null }) {
    if (r.end_date && r.end_date !== r.usage_date) return `${r.usage_date} ~ ${r.end_date}`
    return r.usage_date
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
            {/* 베스트 드라이버 */}
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

            {/* 누적 전체 통계 4개 */}
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
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs text-gray-400">{formatDateRange(r)}</span>
                          <p className="text-sm font-semibold text-gray-900">{r.driver_name}</p>
                          {veh && (
                            <p className="text-xs text-gray-400 mt-0.5">{veh.name} · {veh.license_plate}</p>
                          )}
                        </div>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          {r.purpose}
                        </span>
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
        {tab === 'stats' && (
          <div>
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
      <div className="text-center py-4 space-y-1">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-500 border border-blue-100">SimpleFleet v1.2.5</span>
        <p className="text-xs text-gray-400">© 2026 MSKIM, All rights reserved.</p>
      </div>
    </div>
  )
}
