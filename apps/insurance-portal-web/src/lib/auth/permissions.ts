import type { AuthUser } from '@/types';

export function hasPermission(
  user: Pick<AuthUser, 'permissions'> | null | undefined,
  permission: string,
): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function hasRole(
  user: Pick<AuthUser, 'roles'> | null | undefined,
  role: string,
): boolean {
  return user?.roles?.includes(role) ?? false;
}

export function hasAnyRole(
  user: Pick<AuthUser, 'roles'> | null | undefined,
  roles: string[] | undefined,
): boolean {
  if (!roles?.length) return true;
  return roles.some((role) => hasRole(user, role));
}

export function canAccessRoute(
  user: AuthUser | null | undefined,
  options?: {
    requiredPermission?: string;
    anyPermission?: string[];
    requiredRole?: string;
    anyRole?: string[];
    allowedScopes?: Array<'platform' | 'company' | 'customer'>;
  },
): boolean {
  if (!user) return false;

  if (
    options?.allowedScopes?.length &&
    !options.allowedScopes.includes(user.scope)
  ) {
    return false;
  }

  if (
    options?.requiredPermission &&
    !hasPermission(user, options.requiredPermission)
  ) {
    return false;
  }

  if (
    options?.anyPermission?.length &&
    !options.anyPermission.some((permission) => hasPermission(user, permission))
  ) {
    return false;
  }

  if (options?.requiredRole && !hasRole(user, options.requiredRole)) {
    return false;
  }

  if (options?.anyRole && !hasAnyRole(user, options.anyRole)) {
    return false;
  }

  return true;
}
