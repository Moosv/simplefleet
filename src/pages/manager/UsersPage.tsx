import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useCreateEmployee, useUpdateEmployee, useEmployees, useDepartments, useTeams, useVehicles } from '@/hooks/useEmployees'
import type { AdminProfile } from '@/types'

type ManagerWithDept = AdminProfile & {
  departments?: { name: string } | null
  teams?: { id: string; name: string } | null
  vehicles?: { id: string; name: string } | null
}
type EmpWithJoins = {
  id: string; name: string; department_id: string | null; team_id: string | null
  default_vehicle_id: string | null; is_active: boolean; created_at: string
  departments?: { name: string } | null
  teams?: { id: string; name: string } | null
  vehicles?: { id: string; name: string } | null
}

function EmployeeEditModal({
  emp,
  departments,
  teams,
  vehicles,
  onClose,
  onSave,
}: {
  emp: EmpWithJoins
  departments: { id: string; name: string }[]
  teams: { id: string; name: string; department_id: string | null }[]
  vehicles: { id: string; name: string; license_plate: string }[]
  onClose: () => void
  onSave: (data: { name: string; department_id: string | null; team_id: string | null; default_vehicle_id: string | null }) => void
}) {
  const [name, setName] = useState(emp.name)
  const [deptId, setDeptId] = useState(emp.department_id ?? '')
  const [teamId, setTeamId] = useState(emp.team_id ?? '')
  const [vehicleId, setVehicleId] = useState(emp.default_vehicle_id ?? '')

  const filteredTeams = teams.filter(t => !deptId || t.department_id === deptId)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">직원 정보 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이름 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">소속 부서</label>
            <select value={deptId} onChange={e => { setDeptId(e.target.value); setTeamId('') }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">선택 안함</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {filteredTeams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">소속 실</label>
              <select value={teamId} onChange={e => setTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">선택 안함</option>
                {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주 사용 차량</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">선택 안함</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} · {v.license_plate}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={() => onSave({ name: name.trim(), department_id: deptId || null, team_id: teamId || null, default_vehicle_id: vehicleId || null })}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ManagerUsersPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'employees' | 'managers'>('employees')

  const { data: employees } = useEmployees(false)
  const { data: departments } = useDepartments()
  const { data: teams } = useTeams()
  const { data: vehicles } = useVehicles(false)
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })

  const { data: managers } = useQuery({
    queryKey: ['admin_profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_profiles')
        .select('*, departments(name), teams(id, name), vehicles(id, name)')
        .eq('role', 'department_manager')
        .order('created_at', { ascending: false })
      return (data as unknown as ManagerWithDept[]) ?? []
    },
  })

  // 운전자 추가 폼 (관리자 소속 팀에 추가)
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    await createEmployee.mutateAsync({
      name: newName.trim(),
      department_id: profile?.department_id ?? null,
      team_id: profile?.team_id ?? null,
    })
    setNewName('')
    setShowAddEmployee(false)
  }

  const [editingEmployee, setEditingEmployee] = useState<EmpWithJoins | null>(null)

  // 관리자 소속 실 여부 확인 (수정/삭제 권한)
  function canEditEmployee(emp: EmpWithJoins) {
    return profile?.team_id != null && emp.team_id === profile.team_id
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {editingEmployee && departments && teams && (
        <EmployeeEditModal
          emp={editingEmployee}
          departments={departments}
          teams={teams}
          vehicles={vehicles ?? []}
          onClose={() => setEditingEmployee(null)}
          onSave={data => {
            updateEmployee.mutate({ id: editingEmployee.id, data }, { onSuccess: () => setEditingEmployee(null) })
          }}
        />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-6">사용자 관리</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'employees' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          운전자 명단
        </button>
        <button
          onClick={() => setActiveTab('managers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'managers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          관리자 명단
        </button>
      </div>

      {/* 운전자 탭 */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {profile?.team_id && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddEmployee(!showAddEmployee)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                운전자 추가
              </button>
            </div>
          )}

          {showAddEmployee && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">새 운전자 등록</h3>
              <p className="text-xs text-gray-500 mb-3">
                {teams?.find(t => t.id === profile?.team_id)?.name ?? '소속 실'}에 등록됩니다.
              </p>
              <form onSubmit={handleAddEmployee} className="flex gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">이름 *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                    placeholder="홍길동"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={createEmployee.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {createEmployee.isPending ? '저장 중...' : '추가'}
                  </button>
                  <button type="button" onClick={() => setShowAddEmployee(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">
                    취소
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">소속 부서</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">소속 실</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">주 사용 차량</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(employees as EmpWithJoins[] | undefined)?.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.departments?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.teams?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.vehicles?.name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {emp.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canEditEmployee(emp) ? (
                        <div className="flex items-center gap-3">
                          <button onClick={() => setEditingEmployee(emp)}
                            className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                            수정
                          </button>
                          <button
                            onClick={() => { if (confirm(`'${emp.name}'을(를) 삭제하시겠습니까?`)) deleteEmployee.mutate(emp.id) }}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors">
                            삭제
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">조회만</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!employees || employees.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">직원이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 관리자 탭 — 조회 전용 */}
      {activeTab === 'managers' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">소속 부서</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">소속 실</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">주 사용 차량</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {managers?.filter(m => m.status !== 'pending').map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.departments?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.teams?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.vehicles?.name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.status === 'active' ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.created_at.split('T')[0]}</td>
                </tr>
              ))}
              {(!managers || managers.filter(m => m.status !== 'pending').length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">관리자가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
