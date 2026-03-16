import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePurposes } from '@/hooks/useEmployees'

function EditableRow({
  name,
  onSave,
  onDelete,
}: {
  name: string
  onSave: (newName: string) => void
  onDelete: () => void
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
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') { setValue(name); setEditing(false) }
          }}
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

export default function ManagerSettingsPage() {
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
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">용무 관리</h1>

      <form
        onSubmit={e => { e.preventDefault(); if (newPurposeName.trim()) createPurpose.mutate(newPurposeName.trim()) }}
        className="flex gap-2 mb-4"
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
