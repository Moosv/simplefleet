import { useState } from 'react'
import { useRecords } from '@/hooks/useRecords'
import { useAuth } from '@/hooks/useAuth'
import { useEmployees } from '@/hooks/useEmployees'
import * as XLSX from 'xlsx'

export default function ManagerRecordsPage() {
  const { profile } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [employeeId, setEmployeeId] = useState('')

  const { data: records, isLoading } = useRecords({
    startDate,
    endDate,
    departmentId: profile?.department_id ?? undefined,
    employeeId,
  })
  const { data: employees } = useEmployees(false)

  function exportToExcel() {
    if (!records) return
    const rows = records.map(r => ({
      '사용일자': r.usage_date,
      '운전자': r.driver_name,
      '용무': r.purpose,
      '목적지': r.destination,
      '당일거리(km)': r.distance_traveled ?? '',
      '누적거리(km)': r.cumulative_distance,
      '주유량(L)': r.fuel_amount ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '운행기록')
    XLSX.writeFile(wb, `부서운행기록_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">운행 기록 조회</h1>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          엑셀 다운로드
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">운전자</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">전체</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['사용일자', '운전자', '용무', '목적지', '당일거리', '누적거리', '주유량'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              )}
              {!isLoading && records?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">기록이 없습니다</td></tr>
              )}
              {records?.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.usage_date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.driver_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.purpose}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-32 truncate">{r.destination}</td>
                  <td className="px-4 py-3 text-blue-600 font-medium">
                    {r.distance_traveled != null ? `${r.distance_traveled}km` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.cumulative_distance.toLocaleString()}km</td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.fuel_amount != null ? `${r.fuel_amount}L` : '-'}
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
