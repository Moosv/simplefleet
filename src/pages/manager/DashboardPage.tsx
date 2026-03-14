import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export default function ManagerDashboardPage() {
  const { profile } = useAuth()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  const { data: records } = useQuery({
    queryKey: ['manager_dashboard', profile?.department_id, monthStart],
    enabled: !!profile,
    queryFn: async () => {
      let query = supabase
        .from('driving_records')
        .select('*, employees(name)')
        .gte('usage_date', monthStart)
        .lte('usage_date', today)
      if (profile?.department_id) query = query.eq('department_id', profile.department_id)
      const { data } = await query
      return data ?? []
    },
  })

  const { data: recentRecords } = useQuery({
    queryKey: ['manager_recent', profile?.department_id],
    enabled: !!profile,
    queryFn: async () => {
      let query = supabase
        .from('driving_records')
        .select('*, vehicles(name, license_plate)')
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5)
      if (profile?.department_id) query = query.eq('department_id', profile.department_id)
      const { data } = await query
      return data ?? []
    },
  })

  const totalDistance = records?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const totalCount = records?.length ?? 0

  // 운전자별 집계
  const driverStats = records?.reduce<Record<string, number>>((acc, r) => {
    acc[r.driver_name] = (acc[r.driver_name] ?? 0) + 1
    return acc
  }, {})
  const chartData = Object.entries(driverStats ?? {}).map(([name, 건수]) => ({ name, 건수 }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">부서 현황</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {now.getFullYear()}년 {now.getMonth() + 1}월 · {profile?.full_name}
        </p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500 mb-1">이번달 운행 횟수</p>
          <p className="text-2xl font-bold text-blue-600">{totalCount}회</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500 mb-1">이번달 주행거리</p>
          <p className="text-2xl font-bold text-green-600">{totalDistance.toLocaleString()}km</p>
        </div>
      </div>

      {/* 운전자별 차트 */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">운전자별 운행 횟수 (이번달)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="건수" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 최근 기록 */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">최근 운행 기록</h2>
          <Link to="/manager/records" className="text-xs text-blue-600 hover:underline">전체 보기 →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentRecords?.map(r => (
            <div key={r.id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.driver_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.destination} · {r.purpose}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{r.usage_date}</p>
                {r.distance_traveled != null && (
                  <p className="text-xs text-blue-600 font-medium">{r.distance_traveled}km</p>
                )}
              </div>
            </div>
          ))}
          {(!recentRecords || recentRecords.length === 0) && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">운행 기록이 없습니다</div>
          )}
        </div>
      </div>
    </div>
  )
}
