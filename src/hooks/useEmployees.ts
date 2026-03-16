import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEmployees(activeOnly = true) {
  return useQuery({
    queryKey: ['employees', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select('*, departments(name), teams(id, name), vehicles(id, name, license_plate)')
        .order('name')
      if (activeOnly) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; department_id: string | null; team_id?: string | null; default_vehicle_id?: string | null }) => {
      const { error } = await supabase.from('employees').insert(data)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; department_id?: string | null; team_id?: string | null; default_vehicle_id?: string | null; is_active?: boolean } }) => {
      const { error } = await supabase.from('employees').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useVehicles(activeOnly = true) {
  return useQuery({
    queryKey: ['vehicles', activeOnly],
    queryFn: async () => {
      let query = supabase.from('vehicles').select('*').order('name')
      if (activeOnly) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function usePurposes() {
  return useQuery({
    queryKey: ['purposes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purposes').select('*').order('created_at')
      if (error) throw error
      // '기타'는 항상 맨 아래로
      return (data ?? []).sort((a, b) => {
        if (a.name === '기타') return 1
        if (b.name === '기타') return -1
        return 0
      })
    },
  })
}
