import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'
import { canAccessRoute } from '@/lib/auth/permissions'

interface ProtectedRouteProps {
  requiredPermission?: string
  anyPermission?: string[]
  requiredRole?: string
  anyRole?: string[]
}

export function ProtectedRoute({ requiredPermission, anyPermission, requiredRole, anyRole }: ProtectedRouteProps) {
  const { user } = useAuthStore()
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

  if (!canAccessRoute(user, { requiredPermission, anyPermission, requiredRole, anyRole })) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
