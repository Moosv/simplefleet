import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type YearValue = number | 'all'
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

export default function StatsPage() {
  const [year, setYear] = useState<YearValue>(new Date().getFullYear())
  const [month, setMonth] = useState<MonthValue>('all')

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
    : month === 'all' ? `${year}년` : `${year}년 ${month}월`

  const { data: records } = useQuery({
    queryKey: ['stats_records', year, month],
    queryFn: async () => {
      let query = supabase
        .from('driving_records')
        .select('*, departments(name), employees(name, teams(name)), vehicles(name, license_plate)')
      if (dateFilter) {
        query = query.gte('usage_date', dateFilter.start).lte('usage_date', dateFilter.end)
      }
      const { data } = await query
      return data ?? []
    },
  })

  type R = NonNullable<typeof records>[number]

  // 실별
  const teamChartData = sortByOrder(
    Object.entries(
      (records ?? []).reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
        const name = ((r as R & { employees?: { teams?: { name: string } | null } | null })
          .employees?.teams?.name) ?? null
        if (!name) return acc
        if (!acc[name]) acc[name] = { 건수: 0, 거리: 0 }
        acc[name].건수 += 1
        acc[name].거리 += r.distance_traveled ?? 0
        return acc
      }, {})
    ).map(([name, v]) => ({ name, ...v })),
    TEAM_ORDER
  )

  // 용무별
  const purposeChartData = Object.entries(
    (records ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.purpose] = (acc[r.purpose] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, 건수]) => ({ name, 건수 }))
    .sort((a, b) => b.건수 - a.건수)

  // 운전자별
  const driverChartData = Object.entries(
    (records ?? []).reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
      const name = r.driver_name
      if (!acc[name]) acc[name] = { 건수: 0, 거리: 0 }
      acc[name].건수 += 1
      acc[name].거리 += r.distance_traveled ?? 0
      return acc
    }, {})
  ).map(([name, v]) => ({ name, ...v }))

  // 차량별
  const vehicleChartData = sortByOrder(
    Object.entries(
      (records ?? []).reduce<Record<string, { 건수: number; 거리: number }>>((acc, r) => {
        const veh = r as R & { vehicles?: { name: string; license_plate: string } | null }
        const name = veh.vehicles?.name ?? veh.vehicles?.license_plate ?? null
        if (!name) return acc
        if (!acc[name]) acc[name] = { 건수: 0, 거리: 0 }
        acc[name].건수 += 1
        acc[name].거리 += r.distance_traveled ?? 0
        return acc
      }, {})
    ).map(([name, v]) => ({ name, ...v })),
    VEHICLE_ORDER
  )

  const totalDistance = (records ?? []).reduce((s, r) => s + (r.distance_traveled ?? 0), 0)
  const totalFuel = (records ?? []).reduce((s, r) => s + (r.fuel_amount ?? 0), 0)
  const avgFuelEff = totalFuel > 0 ? (totalDistance / totalFuel).toFixed(1) : '-'

  function exportStats() {
    if (!records) return
    const rows = records.map(r => ({
      '사용일자': r.usage_date,
      '소속': (r as R & { departments?: { name: string } | null }).departments?.name ?? '',
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

  const selectClass = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  const noData = <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: 240 }}>데이터 없음</div>

  const dualAxisChart = (data: { name: string; 거리: number; 건수: number }[], h = 240, distColor = '#ec4899', cntColor = '#8b5cf6') => (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 5, right: 45, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} unit="km" />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="회" allowDecimals={false} />
        <Tooltip formatter={(value, name) => name === '거리' ? [`${Number(value).toLocaleString()}km`, '거리'] : [`${value}회`, '건수']} />
        <Legend />
        <Bar yAxisId="left" dataKey="거리" fill={distColor} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="건수" fill={cntColor} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900">통계 리포트</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select value={year} onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={selectClass}>
              <option value="all">전체 기간</option>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={year === 'all'} className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}>
              <option value="all">전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>
          <button onClick={exportStats} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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

      {/* 실별 사용 현황 */}
      {teamChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">실별 사용 현황</h2>
          <p className="text-xs text-gray-400 mb-4">왼쪽 축: 거리(km) &nbsp;·&nbsp; 오른쪽 축: 건수(회)</p>
          {dualAxisChart(teamChartData, 240, '#ec4899', '#8b5cf6')}
        </div>
      )}

      {/* 차량별 운행 현황 */}
      {vehicleChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">차량별 운행 현황</h2>
          <p className="text-xs text-gray-400 mb-4">왼쪽 축: 거리(km) &nbsp;·&nbsp; 오른쪽 축: 건수(회)</p>
          {dualAxisChart(vehicleChartData, 240, '#06b6d4', '#f59e0b')}
        </div>
      )}

      {/* 용무별 운행 횟수 — 전체 너비 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">용무별 운행 횟수</h2>
        {purposeChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={purposeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="건수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : noData}
      </div>

      {/* 운전자별 운행 현황 — 전체 너비, 이중 Y축 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">운전자별 운행 현황</h2>
        <p className="text-xs text-gray-400 mb-4">왼쪽 축: 거리(km) &nbsp;·&nbsp; 오른쪽 축: 건수(회)</p>
        {driverChartData.length > 0
          ? dualAxisChart(driverChartData, 240, '#06b6d4', '#f59e0b')
          : noData}
      </div>
    </div>
  )
}
