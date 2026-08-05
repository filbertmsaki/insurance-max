import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canAccessRoute } from '@/lib/auth/permissions';

interface ProtectedRouteProps {
  /** @deprecated use allPermissions */
  requiredPermission?: string;
  /** @deprecated use anyPermissions */
  anyPermission?: string[];
  /** @deprecated use allRoles */
  requiredRole?: string;
  /** @deprecated use anyRoles */
  anyRole?: string[];

  allPermissions?: string[];
  anyPermissions?: string[];

  allRoles?: string[];
  anyRoles?: string[];

  allowedScopes?: Array<'platform' | 'company'>;
}

export function ProtectedRoute({
  requiredPermission,
  anyPermission,
  requiredRole,
  anyRole,
  allPermissions = [],
  anyPermissions = [],
  allRoles = [],
  anyRoles = [],
  allowedScopes = [],
}: ProtectedRouteProps) {
  const { user, authorizationContext } = useAuthStore();
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const permissions = new Set(
    authorizationContext?.permissions ?? user.permissions ?? [],
  );

  const roles = new Set(authorizationContext?.roles ?? user.roles ?? []);

  const scope = authorizationContext?.scope ?? user.scope;

  const mergedAllPermissions = requiredPermission
    ? [...allPermissions, requiredPermission]
    : allPermissions;

  const mergedAnyPermissions = anyPermission?.length
    ? [...anyPermissions, ...anyPermission]
    : anyPermissions;

  const mergedAllRoles = requiredRole ? [...allRoles, requiredRole] : allRoles;

  const mergedAnyRoles = anyRole?.length ? [...anyRoles, ...anyRole] : anyRoles;

  const usesLegacyOnly =
    mergedAllPermissions.length === 0 &&
    mergedAnyPermissions.length === 0 &&
    mergedAllRoles.length === 0 &&
    mergedAnyRoles.length === 0 &&
    allowedScopes.length === 0;

  const allowed = usesLegacyOnly
    ? canAccessRoute(user, {
        requiredPermission,
        anyPermission,
        requiredRole,
        anyRole,
      })
    : (allowedScopes.length === 0 || allowedScopes.includes(scope)) &&
      mergedAllPermissions.every((permission) => permissions.has(permission)) &&
      (mergedAnyPermissions.length === 0 ||
        mergedAnyPermissions.some((permission) =>
          permissions.has(permission),
        )) &&
      mergedAllRoles.every((role) => roles.has(role)) &&
      (mergedAnyRoles.length === 0 ||
        mergedAnyRoles.some((role) => roles.has(role)));

  if (!allowed) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
