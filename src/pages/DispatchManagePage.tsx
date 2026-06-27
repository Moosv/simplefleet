import { useState } from 'react'
import { useVehicles } from '@/hooks/useEmployees'
import { useDispatchRequests, useUpdateDispatchStatus, useDeleteDispatchRequest } from '@/hooks/useDispatch'
import { exportDispatchForms } from '@/utils/exportBaecha'

type DispatchRow = {
  id: string
  created_at: string
  usage_date: string
  end_date: string | null
  departure_time: string | null
  arrival_time: string | null
  driver_name: string
  destination: string
  waypoint: string | null
  purpose: string
  approver_name: string | null
  status: string
  vehicle_id: string | null
  vehicles?: { name: string; license_plate: string } | null
  departments?: { name: string } | null
  teams?: { name: string } | null
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  requested: { text: '접수', cls: 'bg-amber-100 text-amber-700' },
  printed:   { text: '출력완료', cls: 'bg-green-100 text-green-700' },
  linked:    { text: '운행연결', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { text: '취소', cls: 'bg-gray-100 text-gray-500' },
}

function fmtUsage(r: DispatchRow) {
  if (r.end_date && r.end_date !== r.usage_date) return `${r.usage_date} ~ ${r.end_date}`
  return r.usage_date
}
function fmtTime(r: DispatchRow) {
  const d = r.departure_time ?? '--:--'
  const a = r.arrival_time ?? '--:--'
  return `${d} ~ ${a}`
}

export default function DispatchManagePage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [status, setStatus] = useState('')

  const { data: records, isLoading } = useDispatchRequests({ startDate, endDate, vehicleId, status })
  const { data: vehicles } = useVehicles(false)
  const updateStatus = useUpdateDispatchStatus()
  const deleteReq = useDeleteDispatchRequest()

  const rows = (records ?? []) as unknown as DispatchRow[]

  function exportAll() {
    if (!rows.length) return
    const selectedVehicle = vehicles?.find(v => v.id === vehicleId)
    const dateTag = (startDate && endDate) ? `${startDate}~${endDate}` : new Date().toISOString().split('T')[0]
    exportDispatchForms(rows as unknown as Parameters<typeof exportDispatchForms>[0], {
      filename: `배차신청서_${selectedVehicle?.license_plate || '전체'}_${dateTag}`,
    })
  }

  function exportOne(r: DispatchRow) {
    exportDispatchForms([r] as unknown as Parameters<typeof exportDispatchForms>[0], {
      filename: `배차신청서_${r.driver_name}_${r.usage_date}`,
    })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">배차신청 관리</h1>
        <button onClick={exportAll} disabled={!rows.length}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          차량별 전체 출력
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">차량</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">전체</option>
              {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">전체</option>
              <option value="requested">접수</option>
              <option value="printed">출력완료</option>
              <option value="linked">운행연결</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['사용일자', '시간', '신청자', '소속', '차량', '행선지', '경유지', '용무', '결재자', '상태', '관리'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">배차신청 내역이 없습니다.</td></tr>
              )}
              {rows.map(r => {
                const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.requested
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">{fmtUsage(r)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-500 text-xs">{fmtTime(r)}</td>
                    <td className="px-3 py-3 whitespace-nowrap font-medium text-gray-800">{r.driver_name}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-500 text-xs">
                      {r.departments?.name ?? '-'}{r.teams?.name ? ` · ${r.teams.name}` : ''}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">{r.vehicles?.name ?? '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">{r.destination}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-500">{r.waypoint || '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">{r.purpose}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">{r.approver_name || '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.text}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { exportOne(r); if (r.status === 'requested') updateStatus.mutate({ id: r.id, status: 'printed' }) }}
                          className="text-xs px-2 py-1 bg-violet-50 text-violet-600 rounded-md hover:bg-violet-100 transition-colors font-medium">출력</button>
                        {r.status === 'printed' && (
                          <button onClick={() => updateStatus.mutate({ id: r.id, status: 'requested' })}
                            className="text-xs px-2 py-1 bg-gray-50 text-gray-500 rounded-md hover:bg-gray-100 transition-colors">접수로</button>
                        )}
                        <button onClick={() => { if (window.confirm(`'${r.driver_name}'의 배차신청을 삭제할까요?`)) deleteReq.mutate(r.id) }}
                          className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors">삭제</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
