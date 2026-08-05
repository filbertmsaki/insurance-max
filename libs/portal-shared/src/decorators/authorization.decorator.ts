import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { ApplicationAccessScope } from '@insurance-max/contracts';

export const ANY_PERMISSIONS_KEY = 'authorization:any-permissions';
export const ALL_ROLES_KEY = 'authorization:all-roles';
export const ACCESS_SCOPES_KEY = 'authorization:access-scopes';
export const TENANT_BOUNDARY_KEY = 'authorization:tenant-boundary';
export const SERVICE_ENDPOINT_KEY = 'authorization:service-endpoint';
export const SELF_SERVICE_KEY = 'authorization:self-service';

export const AnyPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

export const AllRoles = (...roles: string[]) =>
  SetMetadata(ALL_ROLES_KEY, roles);

export const AccessScopes = (...scopes: ApplicationAccessScope[]) =>
  SetMetadata(ACCESS_SCOPES_KEY, scopes);

export const TenantScoped = () =>
  applyDecorators(
    AccessScopes('company'),
    SetMetadata(TENANT_BOUNDARY_KEY, true),
  );

export const PlatformScoped = () => AccessScopes('platform');

export const ServiceEndpoint = () => SetMetadata(SERVICE_ENDPOINT_KEY, true);

/**
 * Explicitly documents a route that requires only authentication — no
 * permission, role, or extra scope check — because it acts solely on the
 * caller's own record (e.g. "get my profile", "revoke my session",
 * "log myself out"). This is a no-op for AuthorizationGuard (which already
 * allows through when no requirements are set); its purpose is to make the
 * "authenticated, no extra permission needed" decision explicit and
 * auditable at the route, rather than leaving it implicit.
 */
export const AuthenticatedAccess = () => SetMetadata(SELF_SERVICE_KEY, true);
