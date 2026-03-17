import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EMP_SESSION_KEY } from './EmployeeLoginPage'
import type { EmpSession } from './EmployeeLoginPage'

type EmpRecord = {
  id: string
  usage_date: string
  end_date: string | null
  vehicle_id: string | null
  driver_name: string
  purpose: string
  waypoint: string | null
  destination: string
  distance_traveled: number | null
  cumulative_distance: number
  fuel_amount: number | null
  duration_hours: number | null
  departure_time: string | null
  arrival_time: string | null
  created_at: string
}

function formatDateRange(r: EmpRecord) {
  if (r.end_date && r.end_date !== r.usage_date) {
    return `${r.usage_date} ~ ${r.end_date}`
  }
  return r.usage_date
}

export default function EmployeeDashboardPage() {
  const navigate = useNavigate()

  const empSession: EmpSession | null = (() => {
    try { return JSON.parse(localStorage.getItem(EMP_SESSION_KEY) ?? 'null') } catch { return null }
  })()

  useEffect(() => {
    if (!empSession) navigate('/employee', { replace: true })
  }, [])

  if (!empSession) return null

  function handleLogout() {
    localStorage.removeItem(EMP_SESSION_KEY)
    navigate('/employee', { replace: true })
  }

  const { data: records, isLoading } = useQuery({
    queryKey: ['emp_records', empSession.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employee_records', {
        p_employee_id: empSession!.id,
      })
      if (error) throw error
      return (data ?? []) as EmpRecord[]
    },
  })

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle_single', empSession.default_vehicle_id],
    queryFn: async () => {
      if (!empSession.default_vehicle_id) return null
      const { data } = await supabase
        .from('vehicles')
        .select('name, license_plate')
        .eq('id', empSession.default_vehicle_id)
        .single()
      return data
    },
    enabled: !!empSession.default_vehicle_id,
  })

  // 이번 달 통계
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthRecords = (records ?? []).filter(r => r.usage_date.startsWith(thisMonth))
  const monthDistance = monthRecords.reduce((s, r) => s + (r.distance_traveled ?? 0), 0)
  const monthFuel = monthRecords.reduce((s, r) => s + (r.fuel_amount ?? 0), 0)
  const totalDistance = (records ?? []).reduce((s, r) => s + (r.distance_traveled ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">내 운행 기록</h1>
              <p className="text-xs text-blue-600 font-medium">{empSession.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* 내 정보 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-blue-600">{empSession.name.charAt(0)}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{empSession.name}</p>
            {vehicle && (
              <p className="text-xs text-gray-500 mt-0.5">
                주 사용 차량: {vehicle.name} · {vehicle.license_plate}
              </p>
            )}
          </div>
        </div>

        {/* 이번 달 통계 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 px-1 mb-2">
            {now.getFullYear()}년 {now.getMonth() + 1}월 현황
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '운행 횟수', value: `${monthRecords.length}회` },
              { label: '이번 달 주행', value: `${monthDistance.toLocaleString()}km` },
              { label: '주유량', value: monthFuel > 0 ? `${monthFuel.toFixed(1)}L` : '-' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 누적 주행거리 */}
        {totalDistance > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-700">총 누적 주행거리 (기록 기준)</span>
            <span className="text-sm font-bold text-blue-800">{totalDistance.toLocaleString()}km</span>
          </div>
        )}

        {/* 새 기록 추가 버튼 */}
        <button
          onClick={() => navigate('/employee/record')}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 운행 기록 추가
        </button>

        {/* 최근 기록 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 px-1 mb-2">최근 운행 기록</p>
          {isLoading && (
            <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">
              불러오는 중...
            </div>
          )}
          {!isLoading && (!records || records.length === 0) && (
            <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">
              아직 운행 기록이 없습니다
            </div>
          )}
          {!isLoading && records && records.length > 0 && (
            <div className="space-y-2">
              {records.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.destination}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateRange(r)}</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0 ml-2">
                      {r.purpose}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {r.distance_traveled != null && (
                      <span>주행 <span className="font-medium text-gray-700">{r.distance_traveled.toLocaleString()}km</span></span>
                    )}
                    <span>누적 <span className="font-medium text-gray-700">{r.cumulative_distance.toLocaleString()}km</span></span>
                    {r.departure_time && r.arrival_time && (
                      <span>{r.departure_time} ~ {r.arrival_time}</span>
                    )}
                    {r.fuel_amount != null && (
                      <span>주유 <span className="font-medium text-gray-700">{r.fuel_amount}L</span></span>
                    )}
                    {r.duration_hours != null && (
                      <span>운행시간 <span className="font-medium text-gray-700">{r.duration_hours}h</span></span>
                    )}
                  </div>
                  {r.waypoint && (
                    <p className="text-xs text-gray-400 mt-1">경유: {r.waypoint}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
