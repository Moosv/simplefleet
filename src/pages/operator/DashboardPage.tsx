import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'

function StatCard({ title, value, sub, color }: { title: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function OperatorDashboardPage() {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  const { data: monthlyStats } = useQuery({
    queryKey: ['dashboard_monthly', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('driving_records')
        .select('distance_traveled, fuel_amount')
        .gte('usage_date', monthStart)
        .lte('usage_date', today)
      return data ?? []
    },
  })

  const { data: totalRecords } = useQuery({
    queryKey: ['dashboard_total_records'],
    queryFn: async () => {
      const { count } = await supabase
        .from('driving_records')
        .select('*', { count: 'exact', head: true })
      return count ?? 0
    },
  })

  const { data: pendingCount } = useQuery({
    queryKey: ['pending_managers'],
    queryFn: async () => {
      const { count } = await supabase
        .from('admin_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      return count ?? 0
    },
  })

  const { data: recentRecords } = useQuery({
    queryKey: ['recent_records'],
    queryFn: async () => {
      const { data } = await supabase
        .from('driving_records')
        .select('*, vehicles(name, license_plate), departments(name)')
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  const monthlyDistance = monthlyStats?.reduce((sum, r) => sum + (r.distance_traveled ?? 0), 0) ?? 0
  const monthlyFuel = monthlyStats?.reduce((sum, r) => sum + (r.fuel_amount ?? 0), 0) ?? 0
  const monthlyCount = monthlyStats?.length ?? 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {now.getFullYear()}년 {now.getMonth() + 1}월 현황
        </p>
      </div>

      {/* 승인 대기 알림 */}
      {(pendingCount ?? 0) > 0 && (
        <Link to="/operator/users" className="block mb-5">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3 hover:bg-yellow-100 transition-colors">
            <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                부서관리자 승인 대기 {pendingCount}건
              </p>
              <p className="text-xs text-yellow-600">클릭하여 승인하기 →</p>
            </div>
          </div>
        </Link>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="이번달 운행 횟수"
          value={`${monthlyCount}회`}
          color="text-blue-600"
        />
        <StatCard
          title="이번달 주행거리"
          value={`${monthlyDistance.toLocaleString()}km`}
          color="text-green-600"
        />
        <StatCard
          title="이번달 주유량"
          value={`${monthlyFuel.toFixed(1)}L`}
          color="text-orange-600"
        />
        <StatCard
          title="총 운행 기록"
          value={`${totalRecords}건`}
          color="text-purple-600"
        />
      </div>

      {/* 최근 운행 기록 */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">최근 운행 기록</h2>
          <Link to="/operator/records" className="text-xs text-blue-600 hover:underline">
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
