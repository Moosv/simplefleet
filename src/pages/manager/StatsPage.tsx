import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTeams } from '@/hooks/useEmployees'

export default function ManagerStatsPage() {
  const { profile } = useAuth()
  const { data: teams } = useTeams()
  const teamName = teams?.find(t => t.id === profile?.team_id)?.name ?? ''
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: records } = useQuery({
    queryKey: ['manager_stats_records', year, month, profile?.team_id],
    queryFn: async () => {
      if (!profile?.team_id) return []

      // 관리자 연구실(팀) 소속 직원 ID 목록 조회
      const { data: teamEmps } = await supabase
        .from('employees')
        .select('id')
        .eq('team_id', profile.team_id)
      const teamEmpIds = teamEmps?.map(e => e.id) ?? []
      if (teamEmpIds.length === 0) return []

      const { data } = await supabase
        .from('driving_records')
        .select('*')
        .gte('usage_date', monthStart)
        .lte('usage_date', monthEnd)
        .in('employee_id', teamEmpIds)
      return data ?? []
    },
    enabled: !!profile?.team_id,
  })

  // 용무별 집계
  const purposeStats = records?.reduce<Record<string, number>>((acc, r) => {
    acc[r.purpose] = (acc[r.purpose] ?? 0) + 1
    return acc
  }, {})
  const purposeChartData = Object.entries(purposeStats ?? {}).map(([name, 건수]) => ({ name, 건수 }))

  // 운전자별 집계
  const driverStats = records?.reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
    const name = r.driver_name
    if (!acc[name]) acc[name] = { 건수: 0, 거리: 0 }
    acc[name].건수 += 1
    acc[name].거리 += r.distance_traveled ?? 0
    return acc
  }, {})
  const driverChartData = Object.entries(driverStats ?? {}).map(([name, v]) => ({ name, ...v }))

  const totalDistance = records?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const totalFuel = records?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0
  const avgFuelEff = totalFuel > 0 ? (totalDistance / totalFuel).toFixed(1) : '-'

  function exportStats() {
    if (!records) return
    const rows = records.map(r => ({
      '사용일자': r.usage_date,
      '운전자': r.driver_name,
      '용무': r.purpose,
      '목적지': r.destination,
      '주행거리': r.distance_traveled ?? '',
      '누적거리': r.cumulative_distance,
      '주유량': r.fuel_amount ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${year}년${month}월`)
    XLSX.writeFile(wb, `통계_${year}년${month}월.xlsx`)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          통계 리포트
          {teamName && <span className="ml-2 text-base font-normal text-gray-400">({teamName})</span>}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <button
            onClick={exportStats}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            엑셀
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: '총 운행 횟수', value: `${records?.length ?? 0}회`, color: 'text-blue-600' },
          { label: '총 주행거리', value: `${totalDistance.toLocaleString()}km`, color: 'text-green-600' },
          { label: '총 주유량', value: `${totalFuel.toFixed(1)}L`, color: 'text-orange-600' },
          { label: '평균 연비', value: avgFuelEff !== '-' ? `${avgFuelEff}km/L` : '-', color: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 용무별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">용무별 운행 횟수</h2>
          {purposeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={purposeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="건수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
          )}
        </div>

        {/* 운전자별 운행 건수 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">운전자별 운행 건수</h2>
          {driverChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={driverChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="건수" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
          )}
        </div>
      </div>

      {/* 운전자별 운행거리 */}
      <div className="mt-4 bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">운전자별 운행거리</h2>
        {driverChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={driverChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="km" />
              <Tooltip formatter={(value) => [`${Number(value).toLocaleString()}km`, '운행거리']} />
              <Bar dataKey="거리" name="운행거리" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
        )}
      </div>
    </div>
  )
}
