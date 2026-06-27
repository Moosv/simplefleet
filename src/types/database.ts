export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      teams: {
        Row: { id: string; name: string; department_id: string | null; created_at: string }
        Insert: { id?: string; name: string; department_id?: string | null; created_at?: string }
        Update: { id?: string; name?: string; department_id?: string | null; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'teams_department_id_fkey'
            columns: ['department_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          }
        ]
      }
      vehicles: {
        Row: { id: string; name: string; license_plate: string; is_active: boolean; initial_odometer: number | null; created_at: string }
        Insert: { id?: string; name: string; license_plate: string; is_active?: boolean; initial_odometer?: number | null; created_at?: string }
        Update: { id?: string; name?: string; license_plate?: string; is_active?: boolean; initial_odometer?: number | null; created_at?: string }
        Relationships: []
      }
      employees: {
        Row: { id: string; name: string; department_id: string | null; team_id: string | null; default_vehicle_id: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; name: string; department_id?: string | null; team_id?: string | null; default_vehicle_id?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; department_id?: string | null; team_id?: string | null; default_vehicle_id?: string | null; is_active?: boolean; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'employees_department_id_fkey'
            columns: ['department_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          }
        ]
      }
      purposes: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          id: string
          full_name: string
          department_id: string | null
          team_id: string | null
          default_vehicle_id: string | null
          role: 'system_operator' | 'department_manager'
          status: 'active' | 'pending' | 'inactive'
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          department_id?: string | null
          team_id?: string | null
          default_vehicle_id?: string | null
          role: 'system_operator' | 'department_manager'
          status?: 'active' | 'pending' | 'inactive'
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          department_id?: string | null
          team_id?: string | null
          default_vehicle_id?: string | null
          role?: 'system_operator' | 'department_manager'
          status?: 'active' | 'pending' | 'inactive'
          created_at?: string
        }
        Relationships: []
      }
      driving_records: {
        Row: {
          id: string
          created_at: string
          usage_date: string
          vehicle_id: string | null
          department_id: string | null
          employee_id: string | null
          driver_name: string
          purpose: string
          waypoint: string | null
          destination: string
          duration_hours: number | null
          distance_traveled: number | null
          cumulative_distance: number
          fuel_amount: number | null
          end_date: string | null
          departure_time: string | null
          arrival_time: string | null
          odometer_image_url: string | null
          receipt_image_url: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          usage_date: string
          vehicle_id?: string | null
          department_id?: string | null
          employee_id?: string | null
          driver_name: string
          purpose: string
          waypoint?: string | null
          destination: string
          duration_hours?: number | null
          distance_traveled?: number | null
          cumulative_distance: number
          end_date?: string | null
          departure_time?: string | null
          arrival_time?: string | null
          fuel_amount?: number | null
          odometer_image_url?: string | null
          receipt_image_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          usage_date?: string
          vehicle_id?: string | null
          department_id?: string | null
          employee_id?: string | null
          driver_name?: string
          purpose?: string
          waypoint?: string | null
          destination?: string
          duration_hours?: number | null
          distance_traveled?: number | null
          cumulative_distance?: number
          end_date?: string | null
          departure_time?: string | null
          arrival_time?: string | null
          fuel_amount?: number | null
          odometer_image_url?: string | null
          receipt_image_url?: string | null
        }
        Relationships: []
      }
      dispatch_requests: {
        Row: {
          id: string
          created_at: string
          department_id: string | null
          team_id: string | null
          employee_id: string | null
          driver_name: string
          vehicle_id: string | null
          usage_date: string
          end_date: string | null
          departure_time: string | null
          arrival_time: string | null
          destination: string
          waypoint: string | null
          purpose: string
          approver_name: string | null
          status: 'requested' | 'linked' | 'printed' | 'cancelled'
          driving_record_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          department_id?: string | null
          team_id?: string | null
          employee_id?: string | null
          driver_name: string
          vehicle_id?: string | null
          usage_date: string
          end_date?: string | null
          departure_time?: string | null
          arrival_time?: string | null
          destination: string
          waypoint?: string | null
          purpose: string
          approver_name?: string | null
          status?: 'requested' | 'linked' | 'printed' | 'cancelled'
          driving_record_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          department_id?: string | null
          team_id?: string | null
          employee_id?: string | null
          driver_name?: string
          vehicle_id?: string | null
          usage_date?: string
          end_date?: string | null
          departure_time?: string | null
          arrival_time?: string | null
          destination?: string
          waypoint?: string | null
          purpose?: string
          approver_name?: string | null
          status?: 'requested' | 'linked' | 'printed' | 'cancelled'
          driving_record_id?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      get_my_department: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      get_prev_odometer: {
        Args: { p_vehicle_id: string }
        Returns: number | null
      }
      get_prev_odometer_by_date: {
        Args: { p_vehicle_id: string; p_usage_date?: string | null; p_exclude_id?: string | null }
        Returns: number | null
      }
      register_manager: {
        Args: { p_user_id: string; p_full_name: string; p_dept_id: string | null }
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type Department = Database['public']['Tables']['departments']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Vehicle = Database['public']['Tables']['vehicles']['Row']
export type Employee = Database['public']['Tables']['employees']['Row']
export type Purpose = Database['public']['Tables']['purposes']['Row']
export type AdminProfile = Database['public']['Tables']['admin_profiles']['Row']
export type DrivingRecord = Database['public']['Tables']['driving_records']['Row']
export type DispatchRequest = Database['public']['Tables']['dispatch_requests']['Row']

export type AdminRole = AdminProfile['role']
export type AdminStatus = AdminProfile['status']
