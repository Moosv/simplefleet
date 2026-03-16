import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDepartments } from '@/hooks/useEmployees'

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function AwardCard({
  emoji,
  title,
  name,
  stat,
  bgColor,
  textColor,
}: {
  emoji: string
  title: string
  name: string | null
  stat: string
  bgColor: string
  textColor: string
}) {
  return (
    <div className={`rounded-xl border p-5 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <p className={`text-xs font-semibold ${textColor}`}>{title}</p>
      </div>
      <p className="text-lg font-bold text-gray-900 truncate">{name ?? '-'}</p>
      <p className={`text-sm mt-0.5 ${textColor}`}>{stat}</p>
    </div>
  )
}

export default function ManagerDashboardPage() {
  const { profile } = useAuth()
  const { data: departments } = useDepartments()

  const deptName = departments?.find(d => d.id === profile?.department_id)?.name ?? ''

  // 부서 전체 운행 기록 (랭킹 계산 포함)
  const { data: deptRecords } = useQuery({
    queryKey: ['dashboard_dept_records', profile?.department_id],
    queryFn: async () => {
      if (!profile?.department_id) return []
      const { data } = await supabase
        .from('driving_records')
        .select('driver_name, distance_traveled, fuel_amount, duration_hours')
        .eq('department_id', profile.department_id)
      return data ?? []
    },
    enabled: !!profile?.department_id,
  })

  const { data: recentRecords } = useQuery({
    queryKey: ['recent_records', profile?.department_id],
    queryFn: async () => {
      if (!profile?.department_id) return []
      const { data } = await supabase
        .from('driving_records')
        .select('*, vehicles(name, license_plate), departments(name)')
        .eq('department_id', profile.department_id)
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!profile?.department_id,
  })

  // 부서 누적 합산
  const deptCount = deptRecords?.length ?? 0
  const deptDistance = deptRecords?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const deptHours = deptRecords?.reduce((s, r) => s + (r.duration_hours ?? 0), 0) ?? 0
  const deptFuel = deptRecords?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0

  // 운전자별 집계
  const driverMap = new Map<string, { trips: number; distance: number; fuel: number }>()
  for (const r of deptRecords ?? []) {
    const key = r.driver_name
    if (!driverMap.has(key)) driverMap.set(key, { trips: 0, distance: 0, fuel: 0 })
    const d = driverMap.get(key)!
    d.trips += 1
    d.distance += r.distance_traveled ?? 0
    d.fuel += r.fuel_amount ?? 0
  }
  const drivers = [...driverMap.entries()]

  // 최다 체크인
  const mostTripsDriver = drivers.length
    ? drivers.reduce((a, b) => (b[1].trips > a[1].trips ? b : a))
    : null

  // 최장 마일리지
  const longestDriver = drivers.length
    ? drivers.reduce((a, b) => (b[1].distance > a[1].distance ? b : a))
    : null

  // 연비 계산 대상: 주유량 & 주행거리 모두 있는 운전자
  const fuelDrivers = drivers.filter(([, v]) => v.fuel > 0 && v.distance > 0)
  const sortedByFuel = [...fuelDrivers].sort(
    (a, b) => b[1].distance / b[1].fuel - a[1].distance / a[1].fuel
  )
  const bestFuelDriver = sortedByFuel[0] ?? null
  const worstFuelDriver = sortedByFuel[sortedByFuel.length - 1] ?? null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          전체 누적 현황
          {deptName && <span className="ml-1 text-gray-400">({deptName})</span>}
        </p>
      </div>

      {/* 누적 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="누적 운행 횟수" value={`${deptCount}회`} color="text-blue-600" />
        <StatCard title="누적 주행거리" value={`${deptDistance.toLocaleString()}km`} color="text-green-600" />
        <StatCard title="누적 운행시간" value={`${deptHours.toFixed(1)}h`} color="text-purple-600" />
        <StatCard title="누적 주유량" value={`${deptFuel.toFixed(1)}L`} color="text-orange-600" />
      </div>

      {/* 운전자 어워드 */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">이달의 드라이버</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AwardCard
            emoji="⛽"
            title="연비의 신"
            name={bestFuelDriver ? bestFuelDriver[0] : null}
            stat={bestFuelDriver
              ? `${(bestFuelDriver[1].distance / bestFuelDriver[1].fuel).toFixed(1)} km/L`
              : '데이터 없음'}
            bgColor="border-emerald-100 bg-emerald-50"
            textColor="text-emerald-600"
          />
          <AwardCard
            emoji="🔥"
            title="연비 파괴자"
            name={worstFuelDriver && worstFuelDriver[0] !== bestFuelDriver?.[0] ? worstFuelDriver[0] : null}
            stat={worstFuelDriver && worstFuelDriver[0] !== bestFuelDriver?.[0]
              ? `${(worstFuelDriver[1].distance / worstFuelDriver[1].fuel).toFixed(1)} km/L`
              : '데이터 없음'}
            bgColor="border-red-100 bg-red-50"
            textColor="text-red-500"
          />
          <AwardCard
            emoji="🏁"
            title="최다 체크인"
            name={mostTripsDriver ? mostTripsDriver[0] : null}
            stat={mostTripsDriver ? `총 ${mostTripsDriver[1].trips}회 운행` : '데이터 없음'}
            bgColor="border-blue-100 bg-blue-50"
            textColor="text-blue-600"
          />
          <AwardCard
            emoji="🛣️"
            title="최장 마일리지"
            name={longestDriver ? longestDriver[0] : null}
            stat={longestDriver ? `총 ${longestDriver[1].distance.toLocaleString()}km` : '데이터 없음'}
            bgColor="border-violet-100 bg-violet-50"
            textColor="text-violet-600"
          />
        </div>
      </div>

      {/* 최근 운행 기록 */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">최근 운행 기록</h2>
          <Link to="/manager/records" className="text-xs text-blue-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentRecords?.map(record => (
            <div key={record.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {record.driver_name}
                    <span className="text-gray-400 font-normal ml-1.5 text-xs">
                      {(record as typeof record & { departments?: { name: string } | null }).departments?.name}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {record.destination} · {record.purpose}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{record.usage_date}</p>
                  {record.distance_traveled != null && (
                    <p className="text-xs text-blue-600 font-medium">{record.distance_traveled}km</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!recentRecords || recentRecords.length === 0) && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              운행 기록이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
