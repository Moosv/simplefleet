import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type YearValue = number | 'all'
type MonthValue = number | 'all'

export default function StatsPage() {
  const [year, setYear] = useState<YearValue>('all')
  const [month, setMonth] = useState<MonthValue>('all')

  // 연도가 'all'로 바뀌면 월도 초기화
  useEffect(() => {
    if (year === 'all') setMonth('all')
  }, [year])

  const dateFilter = (() => {
    if (year === 'all') return null
    if (month === 'all') return { start: `${year}-01-01`, end: `${year}-12-31` }
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    return { start, end }
  })()

  const periodLabel = year === 'all'
    ? '전체 기간'
    : month === 'all'
      ? `${year}년`
      : `${year}년 ${month}월`

  const { data: records } = useQuery({
    queryKey: ['stats_records', year, month],
    queryFn: async () => {
      let query = supabase
        .from('driving_records')
        .select('*, departments(name), employees(name, teams(name))')

      if (dateFilter) {
        query = query
          .gte('usage_date', dateFilter.start)
          .lte('usage_date', dateFilter.end)
      }

      const { data } = await query
      return data ?? []
    },
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

  // 실별 집계
  type RecordWithTeam = typeof records extends (infer T)[] | undefined ? T : never
  const teamStats = records?.reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
    const teamName = ((r as RecordWithTeam & { employees?: { teams?: { name: string } | null } | null })
      .employees?.teams?.name) ?? null
    if (!teamName) return acc
    if (!acc[teamName]) acc[teamName] = { 건수: 0, 거리: 0 }
    acc[teamName].건수 += 1
    acc[teamName].거리 += r.distance_traveled ?? 0
    return acc
  }, {})
  const teamChartData = Object.entries(teamStats ?? {}).map(([name, v]) => ({ name, ...v }))

  const totalDistance = records?.reduce((s, r) => s + (r.distance_traveled ?? 0), 0) ?? 0
  const totalFuel = records?.reduce((s, r) => s + (r.fuel_amount ?? 0), 0) ?? 0
  const avgFuelEff = totalFuel > 0 ? (totalDistance / totalFuel).toFixed(1) : '-'

  function exportStats() {
    if (!records) return
    const rows = records.map(r => ({
      '사용일자': r.usage_date,
      '소속': (r as typeof r & { departments?: { name: string } | null }).departments?.name ?? '',
      '운전자': r.driver_name,
      '용무': r.purpose,
      '목적지': r.destination,
      '주행거리': r.distance_traveled ?? '',
      '누적거리': r.cumulative_distance,
      '주유량': r.fuel_amount ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, periodLabel)
    XLSX.writeFile(wb, `통계_${periodLabel}.xlsx`)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900">통계 리포트</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">전체 기간</option>
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={month}
              onChange={e => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={year === 'all'}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="all">전체</option>
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

      {/* 실별 차트 (데이터 있을 때만 표시) */}
      {teamChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">실별 운행 현황</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={teamChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="건수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="거리" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 용무별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">용무별 운행 횟수</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={purposeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="건수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 운전자별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">운전자별 운행 현황</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={driverChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="건수" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="거리" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
