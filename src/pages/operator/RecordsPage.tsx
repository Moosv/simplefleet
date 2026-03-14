import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useRecords } from '@/hooks/useRecords'
import { useDepartments, useEmployees, useVehicles } from '@/hooks/useEmployees'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export default function RecordsPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  const { data: records, isLoading } = useRecords({ startDate, endDate, departmentId, employeeId, vehicleId })
  const { data: departments } = useDepartments()
  const { data: employees } = useEmployees(false)
  const { data: vehicles } = useVehicles(false)
  const queryClient = useQueryClient()

  async function handleDelete(id: string) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('driving_records').delete().eq('id', id)
    if (!error) queryClient.invalidateQueries({ queryKey: ['driving_records'] })
  }

  function exportToExcel() {
    if (!records) return
    const rows = records.map(r => ({
      '사용일자': r.usage_date,
      '소속': (r as typeof r & { departments?: { name: string } | null }).departments?.name ?? '',
      '운전자': r.driver_name,
      '용무': r.purpose,
      '경유지': r.waypoint ?? '',
      '목적지': r.destination,
      '운행시간(h)': r.duration_hours ?? '',
      '당일주행거리(km)': r.distance_traveled ?? '',
      '누적주행거리(km)': r.cumulative_distance,
      '주유량(L)': r.fuel_amount ?? '',
      '차량': (r as typeof r & { vehicles?: { name: string; license_plate: string } | null }).vehicles
        ? `${(r as typeof r & { vehicles?: { name: string; license_plate: string } | null }).vehicles!.name} (${(r as typeof r & { vehicles?: { name: string; license_plate: string } | null }).vehicles!.license_plate})`
        : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '운행기록')
    XLSX.writeFile(wb, `운행기록_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">운행 기록 관리</h1>
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

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">부서</label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">전체</option>
              {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">운전자</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">전체</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">차량</label>
            <select
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">전체</option>
              {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['사용일자', '소속', '운전자', '용무', '목적지', '당일거리', '누적거리', '주유량', '차량', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              )}
              {!isLoading && records?.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">기록이 없습니다</td></tr>
              )}
              {records?.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.usage_date}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {(r as typeof r & { departments?: { name: string } | null }).departments?.name ?? '-'}
                  </td>
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
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {(r as typeof r & { vehicles?: { name: string; license_plate: string } | null }).vehicles?.license_plate ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      삭제
                    </button>
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
