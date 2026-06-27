import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DispatchStatus = 'requested' | 'linked' | 'printed' | 'cancelled'

export interface DispatchFilters {
  startDate?: string
  endDate?: string
  vehicleId?: string
  status?: string
}

export function useDispatchRequests(filters?: DispatchFilters) {
  return useQuery({
    queryKey: ['dispatch_requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('dispatch_requests')
        .select(`
          *,
          vehicles(name, license_plate),
          departments(name),
          teams(name),
          employees(name)
        `)
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.startDate) query = query.gte('usage_date', filters.startDate)
      if (filters?.endDate) query = query.lte('usage_date', filters.endDate)
      if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId)
      if (filters?.status) query = query.eq('status', filters.status as DispatchStatus)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useUpdateDispatchStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DispatchStatus }) => {
      const { error } = await supabase.from('dispatch_requests').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dispatch_requests'] }),
  })
}

export function useDeleteDispatchRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dispatch_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dispatch_requests'] }),
  })
}
