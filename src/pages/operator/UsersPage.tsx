import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCreateEmployee, useUpdateEmployee, useEmployees, useDepartments, useTeams, useVehicles } from '@/hooks/useEmployees'
import type { AdminProfile } from '@/types'

type ManagerWithDept = AdminProfile & {
  departments?: { name: string } | null
  teams?: { id: string; name: string } | null
  vehicles?: { id: string; name: string } | null
  team_id?: string | null
  default_vehicle_id?: string | null
}
type EmpWithJoins = {
  id: string; name: string; department_id: string | null; team_id: string | null
  default_vehicle_id: string | null; is_active: boolean; created_at: string
  departments?: { name: string } | null
  teams?: { id: string; name: string } | null
  vehicles?: { id: string; name: string } | null
}

// ─── 직원 수정 모달 ────────────────────────────────────────────────────────────
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

  function handleDeptChange(val: string) {
    setDeptId(val)
    setTeamId('')
  }

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
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">소속 부서</label>
            <select
              value={deptId}
              onChange={e => handleDeptChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">선택 안함</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {filteredTeams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">소속 실</label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">선택 안함</option>
                {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주 사용 차량</label>
            <select
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
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

// ─── 관리자 수정 모달 ─────────────────────────────────────────────────────
function ManagerEditModal({
  manager,
  departments,
  teams,
  vehicles,
  onClose,
  onSave,
}: {
  manager: ManagerWithDept
  departments: { id: string; name: string }[]
  teams: { id: string; name: string; department_id: string | null }[]
  vehicles: { id: string; name: string; license_plate: string }[]
  onClose: () => void
  onSave: (data: { full_name: string; department_id: string | null; team_id: string | null; default_vehicle_id: string | null }) => void
}) {
  const [fullName, setFullName] = useState(manager.full_name)
  const [deptId, setDeptId] = useState(manager.department_id ?? '')
  const [teamId, setTeamId] = useState(manager.team_id ?? '')
  const [vehicleId, setVehicleId] = useState(manager.default_vehicle_id ?? '')

  const filteredTeams = teams.filter(t => !deptId || t.department_id === deptId)

  function handleDeptChange(val: string) {
    setDeptId(val)
    setTeamId('')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">관리자 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이름 *</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">소속 부서</label>
            <select
              value={deptId}
              onChange={e => handleDeptChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">선택 안함</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {filteredTeams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">소속 실</label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">선택 안함</option>
                {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주 사용 차량</label>
            <select
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">선택 안함</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} · {v.license_plate}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
            <div className="px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-500">
              {manager.status === 'active' ? '활성' : manager.status === 'pending' ? '승인 대기' : '비활성'}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={() => onSave({ full_name: fullName.trim(), department_id: deptId || null, team_id: teamId || null, default_vehicle_id: vehicleId || null })}
            disabled={!fullName.trim()}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function UsersPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'employees' | 'managers'>('employees')

  // 직원
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

  // 관리자
  const { data: managers } = useQuery({
    queryKey: ['admin_profiles'],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*, departments(name), teams(id, name), vehicles(id, name)')
        .eq('role', 'department_manager')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as ManagerWithDept[]) ?? []
    },
  })

  const approveManager = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_profiles').update({ status: 'active' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_profiles'] }),
  })

  const updateManager = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { full_name: string; department_id: string | null; team_id: string | null; default_vehicle_id: string | null } }) => {
      const { error } = await supabase.from('admin_profiles').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_profiles'] }); setEditingManager(null) },
  })

  const deleteManager = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_profiles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_profiles'] }),
  })

  // 운전자 추가 폼
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDeptId, setNewDeptId] = useState('')
  const [newTeamId, setNewTeamId] = useState('')
  const filteredTeams = teams?.filter(t => !newDeptId || t.department_id === newDeptId) ?? []

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    await createEmployee.mutateAsync({ name: newName.trim(), department_id: newDeptId || null, team_id: newTeamId || null })
    setNewName(''); setNewDeptId(''); setNewTeamId(''); setShowAddEmployee(false)
  }

  // 수정 모달 상태
  const [editingEmployee, setEditingEmployee] = useState<EmpWithJoins | null>(null)
  const [editingManager, setEditingManager] = useState<ManagerWithDept | null>(null)

  const pendingManagers = managers?.filter(m => m.status === 'pending') ?? []
  const activeManagers = managers?.filter(m => m.status !== 'pending') ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 직원 수정 모달 */}
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

      {/* 관리자 수정 모달 */}
      {editingManager && departments && teams && (
        <ManagerEditModal
          manager={editingManager}
          departments={departments}
          teams={teams}
          vehicles={vehicles ?? []}
          onClose={() => setEditingManager(null)}
          onSave={data => updateManager.mutate({ id: editingManager.id, data })}
        />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-6">사용자 관리</h1>

      {/* 탭 */}
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
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'managers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          관리자 명단
          {pendingManagers.length > 0 && (
            <span className="bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingManagers.length}
            </span>
          )}
        </button>
      </div>

      {/* 직원 탭 */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
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

          {showAddEmployee && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">새 직원 등록</h3>
              <form onSubmit={handleAddEmployee} className="flex flex-wrap gap-3 items-end">
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
                <div>
                  <label className="block text-xs text-gray-500 mb-1">소속 부서</label>
                  <select
                    value={newDeptId}
                    onChange={e => { setNewDeptId(e.target.value); setNewTeamId('') }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">선택 안함</option>
                    {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {filteredTeams.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">소속 실</label>
                    <select
                      value={newTeamId}
                      onChange={e => setNewTeamId(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">선택 안함</option>
                      {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createEmployee.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {createEmployee.isPending ? '저장 중...' : '추가'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddEmployee(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">등록일</th>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {emp.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{emp.created_at.split('T')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => { if (confirm(`'${emp.name}'을(를) 삭제하시겠습니까?`)) deleteEmployee.mutate(emp.id) }}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!employees || employees.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">직원이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 관리자 탭 */}
      {activeTab === 'managers' && (
        <div className="space-y-4">
          {pendingManagers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block" />
                승인 대기 ({pendingManagers.length}명)
              </h3>
              <div className="space-y-2">
                {pendingManagers.map(m => (
                  <div key={m.id} className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.full_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.departments?.name ?? '부서 미지정'} · 가입: {m.created_at.split('T')[0]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveManager.mutate(m.id)}
                        disabled={approveManager.isPending}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => { if (confirm(`'${m.full_name}'을(를) 삭제하시겠습니까?`)) deleteManager.mutate(m.id) }}
                        className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">전체 관리자</h3>
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
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeManagers.map(m => (
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setEditingManager(m)}
                            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => { if (confirm(`'${m.full_name}'을(를) 삭제하시겠습니까?`)) deleteManager.mutate(m.id) }}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeManagers.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">관리자가 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
