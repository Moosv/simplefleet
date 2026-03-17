import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, useAuthState, useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AdminLayout from '@/components/layout/AdminLayout'

// Pages
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import RecordEntryPage from '@/pages/RecordEntryPage'
import EmployeeLoginPage from '@/pages/EmployeeLoginPage'
import EmployeeDashboardPage from '@/pages/EmployeeDashboardPage'
import VehicleDashboardPage from '@/pages/VehicleDashboardPage'
import DepartmentDashboardPage from '@/pages/DepartmentDashboardPage'

// Operator pages
import OperatorDashboardPage from '@/pages/operator/DashboardPage'
import OperatorRecordsPage from '@/pages/operator/RecordsPage'
import OperatorUsersPage from '@/pages/operator/UsersPage'
import OperatorVehiclesPage from '@/pages/operator/VehiclesPage'
import OperatorSettingsPage from '@/pages/operator/SettingsPage'
import OperatorStatsPage from '@/pages/operator/StatsPage'

// Manager pages
import ManagerDashboardPage from '@/pages/manager/DashboardPage'
import ManagerRecordsPage from '@/pages/manager/RecordsPage'
import ManagerStatsPage from '@/pages/manager/StatsPage'
import ManagerUsersPage from '@/pages/manager/UsersPage'
import ManagerVehiclesPage from '@/pages/manager/VehiclesPage'
import ManagerSettingsPage from '@/pages/manager/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
})

// SVG Icon helper
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const OPERATOR_NAV = [
  {
    to: '/operator/dashboard', label: '대시보드',
    icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  },
  {
    to: '/operator/records', label: '운행 기록',
    icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  },
  {
    to: '/operator/stats', label: '통계',
    icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    to: '/operator/users', label: '사용자 관리',
    icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  },
  {
    to: '/operator/vehicles', label: '차량 관리',
    icon: <Icon d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6m1-1h4a1 1 0 001-1V9l-3-3h-2" />,
  },
  {
    to: '/operator/settings', label: '마스터 관리',
    icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  },
]

const MANAGER_NAV = [
  {
    to: '/manager/dashboard', label: '대시보드',
    icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  },
  {
    to: '/manager/records', label: '운행 기록',
    icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  },
  {
    to: '/manager/stats', label: '통계',
    icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    to: '/manager/users', label: '사용자 관리',
    icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  },
  {
    to: '/manager/vehicles', label: '차량 관리',
    icon: <Icon d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6m1-1h4a1 1 0 001-1V9l-3-3h-2" />,
  },
  {
    to: '/manager/settings', label: '용무 관리',
    icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  },
]

function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'system_operator') return <Navigate to="/operator/dashboard" replace />
  return <Navigate to="/manager/dashboard" replace />
}

function OperatorPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['system_operator']}>
      <AdminLayout navItems={OPERATOR_NAV} title="시스템 운영자">
        {children}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function ManagerPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['department_manager']}>
      <AdminLayout navItems={MANAGER_NAV} title="관리자">
        {children}
      </AdminLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/record" element={<RecordEntryPage />} />
            <Route path="/employee" element={<EmployeeLoginPage />} />
            <Route path="/employee/record" element={<RecordEntryPage />} />
            <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
            <Route path="/vehicle/dashboard" element={<VehicleDashboardPage />} />
            <Route path="/department/dashboard" element={<DepartmentDashboardPage />} />

            {/* 시스템운영자 라우트 */}
            <Route path="/operator/dashboard" element={<OperatorPage><OperatorDashboardPage /></OperatorPage>} />
            <Route path="/operator/records" element={<OperatorPage><OperatorRecordsPage /></OperatorPage>} />
            <Route path="/operator/stats" element={<OperatorPage><OperatorStatsPage /></OperatorPage>} />
            <Route path="/operator/users" element={<OperatorPage><OperatorUsersPage /></OperatorPage>} />
            <Route path="/operator/vehicles" element={<OperatorPage><OperatorVehiclesPage /></OperatorPage>} />
            <Route path="/operator/settings" element={<OperatorPage><OperatorSettingsPage /></OperatorPage>} />

            {/* 관리자 라우트 */}
            <Route path="/manager/dashboard" element={<ManagerPage><ManagerDashboardPage /></ManagerPage>} />
            <Route path="/manager/records" element={<ManagerPage><ManagerRecordsPage /></ManagerPage>} />
            <Route path="/manager/stats" element={<ManagerPage><ManagerStatsPage /></ManagerPage>} />
            <Route path="/manager/users" element={<ManagerPage><ManagerUsersPage /></ManagerPage>} />
            <Route path="/manager/vehicles" element={<ManagerPage><ManagerVehiclesPage /></ManagerPage>} />
            <Route path="/manager/settings" element={<ManagerPage><ManagerSettingsPage /></ManagerPage>} />

            {/* 기본 리다이렉트 */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
