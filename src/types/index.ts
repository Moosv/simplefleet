export type {
  Database,
  Department,
  Vehicle,
  Employee,
  Purpose,
  AdminProfile,
  DrivingRecord,
  AdminRole,
  AdminStatus,
} from './database'

export interface AuthUser {
  id: string
  email: string
  profile: import('./database').AdminProfile
}
