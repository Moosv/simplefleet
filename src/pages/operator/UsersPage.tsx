import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCreateEmployee, useUpdateEmployee, useEmployees, useDepartments } from '@/hooks/useEmployees'
import type { AdminProfile } from '@/types'

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'employees' | 'managers'>('employees')

  // 직원 목록
  const { data: employees } = useEmployees(false)
  const { data: departments } = useDepartments()
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()

  // 부서관리자 목록
  const { data: managers } = useQuery({
    queryKey: ['admin_profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_profiles')
        .select('*, departments(name)')
        .eq('role', 'department_manager')
        .order('created_at', { ascending: false })
      return (data as unknown as (AdminProfile & { departments?: { name: string } | null })[]) ?? []
    },
  })

  const approveManager = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ status: 'active' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_profiles', 'pending_managers'] }),
  })

  const deactivateManager = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ status: 'inactive' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_profiles'] }),
  })

  // 직원 추가 폼 상태
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDeptId, setNewDeptId] = useState('')

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    await createEmployee.mutateAsync({ name: newName.trim(), department_id: newDeptId || null })
    setNewName('')
    setNewDeptId('')
    setShowAddEmployee(false)
  }

  const pendingManagers = managers?.filter(m => m.status === 'pending') ?? []
  const activeManagers = managers?.filter(m => m.status !== 'pending') ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">사용자 관리</h1>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'employees' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          직원 목록
        </button>
        <button
          onClick={() => setActiveTab('managers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'managers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          부서관리자
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
              직원 추가
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
                    onChange={e => setNewDeptId(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">선택 안함</option>
                    {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">등록일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees?.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {(emp as typeof emp & { departments?: { name: string } | null }).departments?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {emp.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {emp.created_at.split('T')[0]}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateEmployee.mutate({ id: emp.id, data: { is_active: !emp.is_active } })}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {emp.is_active ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                ))}
                {(!employees || employees.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">직원이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 부서관리자 탭 */}
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
                    <button
                      onClick={() => approveManager.mutate(m.id)}
                      disabled={approveManager.isPending}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      승인
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">전체 부서관리자</h3>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">소속</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">가입일</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeManagers.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.full_name}</td>
                      <td className="px-4 py-3 text-gray-500">{m.departments?.name ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {m.status === 'active' ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{m.created_at.split('T')[0]}</td>
                      <td className="px-4 py-3">
                        {m.status === 'active' && (
                          <button
                            onClick={() => deactivateManager.mutate(m.id)}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          >
                            비활성화
                          </button>
                        )}
                        {m.status === 'inactive' && (
                          <button
                            onClick={() => approveManager.mutate(m.id)}
                            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            활성화
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {activeManagers.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">부서관리자가 없습니다</td></tr>
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
