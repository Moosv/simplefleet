import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useVehicles } from '@/hooks/useEmployees'
import type { Vehicle } from '@/types'

const BASE_URL = window.location.origin

export default function VehiclesPage() {
  const { data: vehicles } = useVehicles(false)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [qrVehicle, setQrVehicle] = useState<Vehicle | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  const createVehicle = useMutation({
    mutationFn: async (data: { name: string; license_plate: string }) => {
      const { error } = await supabase.from('vehicles').insert(data)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      setName('')
      setPlate('')
      setShowForm(false)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('vehicles').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
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
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          차량 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">새 차량 등록</h3>
          <form
            onSubmit={e => { e.preventDefault(); createVehicle.mutate({ name: name.trim(), license_plate: plate.trim() }) }}
            className="flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">차량명 *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="예) 1호차"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">차량번호 *</label>
              <input
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value)}
                required
                placeholder="예) 12가 3456"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createVehicle.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {createVehicle.isPending ? '저장 중...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles?.map(vehicle => (
          <div key={vehicle.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{vehicle.name}</p>
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
              <button
                onClick={() => toggleActive.mutate({ id: vehicle.id, is_active: !vehicle.is_active })}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                {vehicle.is_active ? '비활성화' : '활성화'}
              </button>
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
        ))}
        {(!vehicles || vehicles.length === 0) && (
          <div className="col-span-full bg-white rounded-xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            등록된 차량이 없습니다
          </div>
        )}
      </div>
    </div>
  )
}
