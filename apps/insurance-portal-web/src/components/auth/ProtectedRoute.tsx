import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

interface ProtectedRouteProps {
  requiredPermission?: string
  requiredRole?: string
}

export function ProtectedRoute({ requiredPermission, requiredRole }: ProtectedRouteProps) {
  const { user, hasPermission, hasRole } = useAuthStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
