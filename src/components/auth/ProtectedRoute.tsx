import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { AdminRole } from '@/types'

interface Props {
  children: React.ReactNode
  allowedRoles?: AdminRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // 권한 없으면 해당 역할의 기본 페이지로
    const redirect = profile.role === 'system_operator' ? '/operator/dashboard' : '/manager/dashboard'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
