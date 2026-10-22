import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canAccessRoute, isStandardCompanyUser } from '@/lib/auth/permissions';

const COMPANY_USER_POLICY_PERMISSIONS = [
  'dashboard:overview',
  'dashboard:sales',
  'dashboard:policies',
  'dashboard:tasks',
  'policies:read',
  'policy-transactions:read',
  'endorsements:create',
  'endorsements:update-draft',
  'endorsements:complete',
  'endorsements:submit-tiramis',
  'cancellations:read',
  'cancellations:create',
  'cancellations:complete',
  'cancellations:submit-tiramis',
];

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
  /** Each group must have at least one permission the user holds. */
  anyPermissionGroups?: string[][];

  allRoles?: string[];
  anyRoles?: string[];

  allowedScopes?: Array<'platform' | 'company' | 'customer'>;
  hideForStandardUser?: boolean;
}

export function ProtectedRoute({
  requiredPermission,
  anyPermission,
  requiredRole,
  anyRole,
  allPermissions = [],
  anyPermissions = [],
  anyPermissionGroups = [],
  allRoles = [],
  anyRoles = [],
  allowedScopes = [],
  hideForStandardUser = false,
}: ProtectedRouteProps) {
  const { user, authorizationContext } = useAuthStore();
  const location = useLocation();
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (hideForStandardUser && isStandardCompanyUser(user)) {
    return <Navigate to="/apps/forbidden" replace />;
  }

  const permissions = new Set(
    authorizationContext?.permissions ?? user.permissions ?? [],
  );

  const roles = new Set(authorizationContext?.roles ?? user.roles ?? []);

  const scope = authorizationContext?.scope ?? user.scope;

  if (
    scope === 'company' &&
    user.userType === 'COMPANY_USER' &&
    roles.has('USER')
  ) {
    COMPANY_USER_POLICY_PERMISSIONS.forEach((permission) =>
      permissions.add(permission),
    );
  }

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
    anyPermissionGroups.length === 0 &&
    mergedAllRoles.length === 0 &&
    mergedAnyRoles.length === 0 &&
    allowedScopes.length === 0 &&
    !hideForStandardUser;

  const allowed = usesLegacyOnly
    ? canAccessRoute(user, {
        requiredPermission,
        anyPermission,
        requiredRole,
        anyRole,
        hideForStandardUser,
      })
    : (allowedScopes.length === 0 || allowedScopes.includes(scope)) &&
      mergedAllPermissions.every((permission) => permissions.has(permission)) &&
      (mergedAnyPermissions.length === 0 ||
        mergedAnyPermissions.some((permission) =>
          permissions.has(permission),
        )) &&
      anyPermissionGroups.every((group) =>
        group.some((permission) => permissions.has(permission)),
      ) &&
      mergedAllRoles.every((role) => roles.has(role)) &&
      (mergedAnyRoles.length === 0 ||
        mergedAnyRoles.some((role) => roles.has(role)));

  if (!allowed) {
    return <Navigate to="/apps/forbidden" replace />;
  }

  return <Outlet />;
}
