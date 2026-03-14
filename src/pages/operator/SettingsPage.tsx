import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useDepartments, usePurposes } from '@/hooks/useEmployees'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'departments' | 'purposes'>('departments')

  const { data: departments } = useDepartments()
  const { data: purposes } = usePurposes()

  const [newDeptName, setNewDeptName] = useState('')
  const [newPurposeName, setNewPurposeName] = useState('')

  const createDept = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('departments').insert({ name })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setNewDeptName('')
    },
  })

  const deleteDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })

  const createPurpose = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('purposes').insert({ name })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purposes'] })
      setNewPurposeName('')
    },
  })

  const deletePurpose = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purposes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purposes'] }),
  })

  const TabContent = ({ items, newValue, setNewValue, onAdd, onDelete, placeholder }: {
    items: { id: string; name: string }[] | undefined
    newValue: string
    setNewValue: (v: string) => void
    onAdd: () => void
    onDelete: (id: string) => void
    placeholder: string
  }) => (
    <div className="space-y-4">
      <form
        onSubmit={e => { e.preventDefault(); if (newValue.trim()) onAdd() }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          required
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          추가
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {items?.map(item => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-900">{item.name}</span>
              <button
                onClick={() => {
                  if (confirm(`'${item.name}'을(를) 삭제하시겠습니까?`)) onDelete(item.id)
                }}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
          {(!items || items.length === 0) && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              데이터가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">마스터 데이터 관리</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'departments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          부서
        </button>
        <button
          onClick={() => setActiveTab('purposes')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'purposes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          용무
        </button>
      </div>

      {activeTab === 'departments' && (
        <TabContent
          items={departments}
          newValue={newDeptName}
          setNewValue={setNewDeptName}
          onAdd={() => createDept.mutate(newDeptName.trim())}
          onDelete={id => deleteDept.mutate(id)}
          placeholder="부서명 입력"
        />
      )}

      {activeTab === 'purposes' && (
        <TabContent
          items={purposes}
          newValue={newPurposeName}
          setNewValue={setNewPurposeName}
          onAdd={() => createPurpose.mutate(newPurposeName.trim())}
          onDelete={id => deletePurpose.mutate(id)}
          placeholder="용무명 입력"
        />
      )}
    </div>
  )
}
