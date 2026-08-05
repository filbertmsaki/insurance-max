import type { ReactNode } from 'react'

import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

interface CanProps {
  permission?: string
  anyPermission?: string[]
  role?: string
  anyRole?: string[]

  fallback?: ReactNode
  children: ReactNode
}

/**
 * Conditionally renders children based on the current authorization
 * context. This is a UX convenience only - the backend must still
 * enforce every permission. Hiding a button is not security.
 */
export function Can({
  permission,
  anyPermission = [],
  role,
  anyRole = [],
  fallback = null,
  children,
}: CanProps) {
  const { hasPermission, hasRole } = useAuthStore()

  const allowed =
    (!permission || hasPermission(permission)) &&
    (anyPermission.length === 0 || anyPermission.some(hasPermission)) &&
    (!role || hasRole(role)) &&
    (anyRole.length === 0 || anyRole.some(hasRole))

  return allowed ? <>{children}</> : <>{fallback}</>
}
