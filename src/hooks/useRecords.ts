import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DrivingRecord } from '@/types'

export interface RecordFilters {
  startDate?: string
  endDate?: string
  departmentId?: string
  employeeId?: string
  driverName?: string
  vehicleId?: string
}

export function useRecords(filters?: RecordFilters) {
  return useQuery({
    queryKey: ['driving_records', filters],
    queryFn: async () => {
      let query = supabase
        .from('driving_records')
        .select(`
          *,
          vehicles(name, license_plate),
          departments(name),
          employees(name)
        `)
        .order('usage_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.startDate) query = query.gte('usage_date', filters.startDate)
      if (filters?.endDate) query = query.lte('usage_date', filters.endDate)
      if (filters?.departmentId) query = query.eq('department_id', filters.departmentId)
      if (filters?.employeeId) query = query.eq('employee_id', filters.employeeId)
      if (filters?.driverName) query = query.eq('driver_name', filters.driverName)
      if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useDeleteRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('driving_records').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driving_records'] }),
  })
}

export function useUpdateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DrivingRecord> }) => {
      const { error } = await supabase.from('driving_records').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driving_records'] }),
  })
}
