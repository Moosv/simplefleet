import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useVehicles } from '@/hooks/useEmployees'
import type { Vehicle } from '@/types'

const BASE_URL = window.location.origin

function VehicleEditModal({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(vehicle.name)
  const [plate, setPlate] = useState(vehicle.license_plate)

  const updateVehicle = useMutation({
    mutationFn: async (data: { name: string; license_plate: string }) => {
      const { error } = await supabase.from('vehicles').update(data).eq('id', vehicle.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">차량 수정</h2>
        <form
          onSubmit={e => {
            e.preventDefault()
            updateVehicle.mutate({ name: name.trim(), license_plate: plate.trim() })
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">차량명</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">차량번호</label>
            <input type="text" value={plate} onChange={e => setPlate(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={updateVehicle.isPending}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {updateVehicle.isPending ? '저장 중...' : '저장'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ManagerVehiclesPage() {
  const { profile } = useAuth()
  const { data: vehicles } = useVehicles(false)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [qrVehicle, setQrVehicle] = useState<Vehicle | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  // 관리자의 소유 차량 (default_vehicle_id)
  const ownVehicleId = profile?.default_vehicle_id

  // 관리자가 이미 차량을 보유하고 있는지 여부
  const hasOwnVehicle = !!ownVehicleId

  const createVehicle = useMutation({
    mutationFn: async (data: { name: string; license_plate: string }) => {
      // 차량 추가
      const { data: created, error } = await supabase
        .from('vehicles')
        .insert(data)
        .select('id')
        .single()
      if (error) throw error
      // 관리자 프로필의 default_vehicle_id 갱신
      const { error: updateError } = await supabase
        .from('admin_profiles')
        .update({ default_vehicle_id: created.id })
        .eq('id', profile!.id)
      if (updateError) throw updateError
      return created.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['admin_profiles'] })
      setName('')
      setPlate('')
      setShowForm(false)
    },
  })

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', id)
      if (error) throw error
      // default_vehicle_id 초기화
      await supabase
        .from('admin_profiles')
        .update({ default_vehicle_id: null })
        .eq('id', profile!.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['admin_profiles'] })
    },
  })

  function downloadQR(vehicle: Vehicle) {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `QR_${vehicle.name}_${vehicle.license_plate}.png`
    a.click()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">차량 관리</h1>
        {!hasOwnVehicle && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            차량 추가
          </button>
        )}
      </div>

      {showForm && !hasOwnVehicle && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">새 차량 등록</h3>
          <form
            onSubmit={e => { e.preventDefault(); createVehicle.mutate({ name: name.trim(), license_plate: plate.trim() }) }}
            className="flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">차량명 *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="예) 1호차"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">차량번호 *</label>
              <input type="text" value={plate} onChange={e => setPlate(e.target.value)} required
                placeholder="예) 12가 3456"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createVehicle.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {createVehicle.isPending ? '저장 중...' : '추가'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles?.map(vehicle => {
          const isOwn = vehicle.id === ownVehicleId
          return (
            <div key={vehicle.id} className={`bg-white rounded-xl border p-4 ${isOwn ? 'border-blue-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{vehicle.name}</p>
                    {isOwn && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">내 차량</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{vehicle.license_plate}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  vehicle.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {vehicle.is_active ? '운행중' : '비활성'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setQrVehicle(qrVehicle?.id === vehicle.id ? null : vehicle)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  QR 보기
                </button>
                {isOwn && (
                  <>
                    <button onClick={() => setEditingVehicle(vehicle)}
                      className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                      수정
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`'${vehicle.name}' 차량을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) {
                          deleteVehicle.mutate(vehicle.id)
                        }
                      }}
                      className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>

              {qrVehicle?.id === vehicle.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-col items-center gap-3" ref={qrRef}>
                    <QRCodeCanvas
                      value={`${BASE_URL}/record?vehicle=${vehicle.id}`}
                      size={160}
                      level="M"
                      includeMargin
                    />
                    <p className="text-xs text-gray-500 text-center break-all">
                      {`${BASE_URL}/record?vehicle=${vehicle.id}`}
                    </p>
                    <button
                      onClick={() => downloadQR(vehicle)}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      PNG 다운로드
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {(!vehicles || vehicles.length === 0) && (
          <div className="col-span-full bg-white rounded-xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            등록된 차량이 없습니다
          </div>
        )}
      </div>

      {editingVehicle && (
        <VehicleEditModal vehicle={editingVehicle} onClose={() => setEditingVehicle(null)} />
      )}
    </div>
  )
}
