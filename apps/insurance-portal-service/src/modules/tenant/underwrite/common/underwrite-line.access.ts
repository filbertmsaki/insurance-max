import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type {
  UnderwriteActionValue,
  UnderwriteLine,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

export const UNDERWRITE_LINE_ACTION_KEY = 'underwrite:line-action';
export const UNDERWRITE_LINE_COVERS_KEY = 'underwrite:line-covers';

export interface UnderwriteLineAccessOptions {
  /**
   * Also admit holders of a restricted cover inside the line (e.g.
   * Short-Term on Motor). Only for routes whose services filter records by
   * cover (the `*ForUser` quotation/policy reads and the cover-checked
   * writes); every other route stays line-only.
   */
  covers?: boolean;
}

/**
 * Declares the line-level gate for a route under `tenant/underwrite/:line`.
 * The existing action permission is still declared with `@Permissions(...)`.
 */
export const UnderwriteLineAccess = (
  action: UnderwriteActionValue,
  options: UnderwriteLineAccessOptions = {},
) =>
  applyDecorators(
    SetMetadata(UNDERWRITE_LINE_ACTION_KEY, action),
    SetMetadata(UNDERWRITE_LINE_COVERS_KEY, options.covers === true),
  );

export interface UnderwriteRequest {
  user?: AuthenticatedUser;
  params?: Record<string, string>;
  underwriteLine?: UnderwriteLine;
}

/** The line resolved from the `:line` route segment by `UnderwriteLineGuard`. */
export const CurrentUnderwriteLine = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UnderwriteLine => {
    const request = ctx.switchToHttp().getRequest<UnderwriteRequest>();
    return request.underwriteLine!;
  },
);

/** Mirrors the platform-owner bypass of the global AuthorizationGuard. */
export function isPlatformOwner(user: AuthenticatedUser): boolean {
  return (
    user.scope === 'platform' &&
    (user.userType === 'OWNER' ||
      user.userType === 'SUPER_ADMIN' ||
      user.roles.includes('OWNER') ||
      user.roles.includes('SUPER_ADMIN'))
  );
}

export function userHasPermission(
  user: AuthenticatedUser,
  permission: string,
): boolean {
  return isPlatformOwner(user) || (user.permissions ?? []).includes(permission);
}
