import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useEmployees } from '@/hooks/useEmployees'

export const EMP_SESSION_KEY = 'sf_emp_session'

export type EmpSession = {
  id: string
  name: string
  department_id: string | null
  default_vehicle_id: string | null
  is_manager?: boolean
}

type PersonEntry = {
  id: string
  displayName: string
  department_id: string | null
  departmentName?: string
  default_vehicle_id: string | null
  licensePlate4: string | null  // 차량번호 끝 4자리
  vehicleName?: string
  is_manager: boolean
}

function extractLast4Digits(plate: string | null | undefined): string | null {
  if (!plate) return null
  const digits = plate.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

export default function EmployeeLoginPage() {
  const navigate = useNavigate()
  const { data: employees, isLoading: empLoading } = useEmployees(true)

  const { data: managers, isLoading: mgrLoading } = useQuery({
    queryKey: ['active_managers_portal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_profiles')
        .select('id, full_name, department_id, default_vehicle_id, departments(name), vehicles(id, name, license_plate)')
        .eq('role', 'department_manager')
        .eq('status', 'active')
      return (data as unknown as {
        id: string
        full_name: string
        department_id: string | null
        default_vehicle_id: string | null
        departments?: { name: string } | null
        vehicles?: { id: string; name: string; license_plate: string } | null
      }[]) ?? []
    },
  })

  const isLoading = empLoading || mgrLoading

  // 통합 목록 생성
  const persons: PersonEntry[] = [
    ...(employees ?? []).map(e => {
      const v = (e as typeof e & { vehicles?: { id: string; name: string; license_plate: string } | null }).vehicles
      return {
        id: e.id,
        displayName: e.name,
        department_id: e.department_id,
        departmentName: (e as typeof e & { departments?: { name: string } | null }).departments?.name,
        default_vehicle_id: e.default_vehicle_id,
        licensePlate4: extractLast4Digits(v?.license_plate),
        vehicleName: v?.name,
        is_manager: false,
      }
    }),
    ...(managers ?? []).map(m => ({
      id: m.id,
      displayName: m.full_name,
      department_id: m.department_id,
      departmentName: m.departments?.name,
      default_vehicle_id: m.default_vehicle_id,
      licensePlate4: extractLast4Digits(m.vehicles?.license_plate),
      vehicleName: m.vehicles?.name,
      is_manager: true,
    })),
  ]

  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<PersonEntry | null>(null)
  const [plateInput, setPlateInput] = useState('')
  const [plateError, setPlateError] = useState('')

  const filtered = persons.filter(p =>
    p.displayName.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelectPerson(person: PersonEntry) {
    setSelectedPerson(person)
    setPlateInput('')
    setPlateError('')
  }

  const isVerified =
    !!selectedPerson?.default_vehicle_id &&
    !!selectedPerson?.licensePlate4 &&
    plateInput.length === 4 &&
    plateInput === selectedPerson.licensePlate4

  function saveSessionAndGo(path: string) {
    if (!selectedPerson) return
    if (!selectedPerson.default_vehicle_id || !selectedPerson.licensePlate4) {
      setPlateError('주 사용 차량이 등록되어 있지 않습니다. 관리자에게 문의하세요.')
      return
    }
    if (plateInput.length !== 4) {
      setPlateError('차량번호 끝 4자리를 입력하세요')
      return
    }
    if (plateInput !== selectedPerson.licensePlate4) {
      setPlateError('차량번호가 일치하지 않습니다')
      return
    }
    const session: EmpSession = {
      id: selectedPerson.id,
      name: selectedPerson.displayName,
      department_id: selectedPerson.department_id,
      default_vehicle_id: selectedPerson.default_vehicle_id,
      is_manager: selectedPerson.is_manager,
    }
    localStorage.setItem(EMP_SESSION_KEY, JSON.stringify(session))
    navigate(path)
  }

  function handleVerify() {
    saveSessionAndGo('/employee/record')
  }

  // ─── 차량번호 인증 화면 ────────────────────────────────────────────────────
  if (selectedPerson) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => setSelectedPerson(null)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-900">SimpleFleet</h1>
              <p className="text-xs text-gray-400">운행 기록 시스템</p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-8">
          {/* 선택된 사용자 */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-blue-600">{selectedPerson.displayName.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedPerson.displayName}</p>
              {selectedPerson.departmentName && (
                <p className="text-xs text-gray-400">{selectedPerson.departmentName}</p>
              )}
            </div>
            {selectedPerson.is_manager && (
              <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">관리자</span>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">차량번호를 입력하세요</h2>
            <p className="text-sm text-gray-500">
              {selectedPerson.vehicleName
                ? `등록된 주 사용 차량(${selectedPerson.vehicleName})의 번호 4자리를 입력하세요.`
                : '등록된 주 사용 차량의 번호 4자리를 입력하세요.'}
            </p>
          </div>

          <div className="mb-4">
            <input
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={plateInput}
              onChange={e => {
                setPlateInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                setPlateError('')
              }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="당신의 주 차량번호를 입력하세요 예) 146*"
              autoFocus
              className="w-full px-4 py-4 border border-gray-200 rounded-xl text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
            />
            {plateError && (
              <p className="mt-2 text-sm text-red-500 text-center">{plateError}</p>
            )}
          </div>

          {isVerified ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleVerify}
                className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors"
              >
                운행정보기록
              </button>
              <button
                onClick={() => saveSessionAndGo(`/vehicle/dashboard?vehicle=${selectedPerson!.default_vehicle_id}`)}
                className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors"
              >
                대시보드 보기
              </button>
            </div>
          ) : (
            <button
              onClick={handleVerify}
              disabled={plateInput.length !== 4}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              운행정보기록
            </button>
          )}
          <div className="mt-6 text-center">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-500 border border-blue-100">SimpleFleet v1.2.0</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── 이름 선택 화면 ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">SimpleFleet</h1>
            <p className="text-xs text-gray-400">운행 기록 시스템</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">이름을 선택하세요</h2>
          <p className="text-sm text-gray-500">이름 선택 후 차량번호 끝 4자리로 본인 확인을 합니다.</p>
        </div>

        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 검색..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">
                {search ? `'${search}'에 해당하는 사용자가 없습니다` : '등록된 사용자가 없습니다'}
              </p>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {filtered.map(person => (
              <button
                key={person.id}
                onClick={() => handleSelectPerson(person)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-blue-600">{person.displayName.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{person.displayName}</p>
                      {person.is_manager && (
                        <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">관리자</span>
                      )}
                    </div>
                    {person.departmentName && (
                      <p className="text-xs text-gray-400 mt-0.5">{person.departmentName}</p>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          이름이 목록에 없다면 관리자에게 등록을 요청하세요.
        </p>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-500 border border-blue-100">SimpleFleet v1.2.0</span>
        </div>
      </div>
    </div>
  )
}
