import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

interface ProtectedRouteProps {
  requiredPermission?: string
  requiredRole?: string
}

export function ProtectedRoute({ requiredPermission, requiredRole }: ProtectedRouteProps) {
  const { user, hasPermission, hasRole } = useAuthStore()
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return unsubscribe
  }, [])

  if (!hydrated) {
    return null
  }

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
