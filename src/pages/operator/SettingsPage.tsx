import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useDepartments, usePurposes, useTeams } from '@/hooks/useEmployees'

// ─── 인라인 편집 행 컴포넌트 ──────────────────────────────────────────────────
function EditableRow({
  name,
  onSave,
  onDelete,
  onCancel,
}: {
  name: string
  onSave: (newName: string) => void
  onDelete: () => void
  onCancel?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  function handleSave() {
    if (value.trim() && value.trim() !== name) onSave(value.trim())
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setValue(name); setEditing(false); onCancel?.() } }}
          className="flex-1 mr-3 px-2 py-1 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-sm text-gray-900 flex-1">{name}</span>
      )}
      <div className="flex items-center gap-3 shrink-0">
        {editing ? (
          <>
            <button onClick={handleSave} className="text-xs text-blue-600 hover:text-blue-800 font-medium">저장</button>
            <button onClick={() => { setValue(name); setEditing(false) }} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-700">수정</button>
            <button
              onClick={() => { if (confirm(`'${name}'을(를) 삭제하시겠습니까?`)) onDelete() }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 부서 + 실 섹션 ──────────────────────────────────────────────────────────
function DepartmentsSection() {
  const queryClient = useQueryClient()
  const { data: departments } = useDepartments()
  const { data: teams } = useTeams()

  const [newDeptName, setNewDeptName] = useState('')
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null)
  const [newTeamNames, setNewTeamNames] = useState<Record<string, string>>({})

  const createDept = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('departments').insert({ name })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setNewDeptName('') },
  })

  const updateDept = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('departments').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })

  const deleteDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })

  const createTeam = useMutation({
    mutationFn: async ({ name, department_id }: { name: string; department_id: string }) => {
      const { error } = await supabase.from('teams').insert({ name, department_id })
      if (error) throw error
    },
    onSuccess: (_, { department_id }) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setNewTeamNames(prev => ({ ...prev, [department_id]: '' }))
    },
  })

  const updateTeam = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('teams').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  })

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  })

  return (
    <div className="space-y-4">
      {/* 부서 추가 폼 */}
      <form
        onSubmit={e => { e.preventDefault(); if (newDeptName.trim()) createDept.mutate(newDeptName.trim()) }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newDeptName}
          onChange={e => setNewDeptName(e.target.value)}
          required
          placeholder="새 부서명 입력 (예: 산림특용자원연구과)"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={createDept.isPending}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {/* 부서 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
        {departments?.map(dept => {
          const deptTeams = teams?.filter(t => t.department_id === dept.id) ?? []
          const isExpanded = expandedDeptId === dept.id

          return (
            <div key={dept.id}>
              {/* 부서 행 */}
              <div className="flex items-center px-4 py-3">
                <DeptEditableRow
                  dept={dept}
                  teamCount={deptTeams.length}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                  onSave={name => updateDept.mutate({ id: dept.id, name })}
                  onDelete={() => deleteDept.mutate(dept.id)}
                />
              </div>

              {/* 실(팀) 서브 목록 */}
              {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-100">
                  {deptTeams.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {deptTeams.map(team => (
                        <div key={team.id} className="pl-10">
                          <EditableRow
                            name={team.name}
                            onSave={name => updateTeam.mutate({ id: team.id, name })}
                            onDelete={() => deleteTeam.mutate(team.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 실 추가 폼 */}
                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      const name = (newTeamNames[dept.id] ?? '').trim()
                      if (name) createTeam.mutate({ name, department_id: dept.id })
                    }}
                    className="flex gap-2 px-4 py-3 pl-10"
                  >
                    <input
                      type="text"
                      value={newTeamNames[dept.id] ?? ''}
                      onChange={e => setNewTeamNames(prev => ({ ...prev, [dept.id]: e.target.value }))}
                      placeholder="새 연구실명 입력"
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={createTeam.isPending}
                      className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      + 연구실 추가
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        })}
        {(!departments || departments.length === 0) && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">부서가 없습니다</div>
        )}
      </div>
    </div>
  )
}

// 부서 행 (팀 수 배지 클릭 → 펼치기/접기)
function DeptEditableRow({
  dept,
  teamCount,
  isExpanded,
  onToggle,
  onSave,
  onDelete,
}: {
  dept: { id: string; name: string }
  teamCount: number
  isExpanded: boolean
  onToggle: () => void
  onSave: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(dept.name)

  function handleSave() {
    if (value.trim() && value.trim() !== dept.name) onSave(value.trim())
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between flex-1 min-w-0">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setValue(dept.name); setEditing(false) } }}
          className="flex-1 mr-3 px-2 py-1 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900">{dept.name}</span>
          <button
            onClick={onToggle}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
              isExpanded
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {teamCount > 0 ? `${teamCount}개 연구실` : '연구실 없음'}
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex items-center gap-3 shrink-0 ml-3">
        {editing ? (
          <>
            <button onClick={handleSave} className="text-xs text-blue-600 hover:text-blue-800 font-medium">저장</button>
            <button onClick={() => { setValue(dept.name); setEditing(false) }} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-700">수정</button>
            <button
              onClick={() => { if (confirm(`'${dept.name}'을(를) 삭제하시겠습니까?`)) onDelete() }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 용무 섹션 ────────────────────────────────────────────────────────────────
function PurposesSection() {
  const queryClient = useQueryClient()
  const { data: purposes } = usePurposes()
  const [newPurposeName, setNewPurposeName] = useState('')

  const createPurpose = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('purposes').insert({ name })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purposes'] }); setNewPurposeName('') },
  })

  const updatePurpose = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('purposes').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purposes'] }),
  })

  const deletePurpose = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purposes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purposes'] }),
  })

  return (
    <div className="space-y-4">
      <form
        onSubmit={e => { e.preventDefault(); if (newPurposeName.trim()) createPurpose.mutate(newPurposeName.trim()) }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newPurposeName}
          onChange={e => setNewPurposeName(e.target.value)}
          required
          placeholder="새 용무명 입력 (예: 연구출장)"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={createPurpose.isPending}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          추가
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
        {purposes?.map(p => (
          <EditableRow
            key={p.id}
            name={p.name}
            onSave={name => updatePurpose.mutate({ id: p.id, name })}
            onDelete={() => deletePurpose.mutate(p.id)}
          />
        ))}
        {(!purposes || purposes.length === 0) && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">용무가 없습니다</div>
        )}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'purposes'>('departments')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">마스터 데이터 관리</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'departments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          부서 · 연구실
        </button>
        <button
          onClick={() => setActiveTab('purposes')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'purposes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          용무
        </button>
      </div>

      {activeTab === 'departments' && <DepartmentsSection />}
      {activeTab === 'purposes' && <PurposesSection />}
    </div>
  )
}
