import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  ACCESS_SCOPES_KEY,
  ALL_ROLES_KEY,
  ANY_PERMISSIONS_KEY,
} from '../decorators/authorization.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const COMPANY_USER_POLICY_PERMISSIONS = [
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

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // Existing @Roles semantics are ANY.
    const anyRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const allRoles =
      this.reflector.getAllAndOverride<string[]>(ALL_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const allowedScopes =
      this.reflector.getAllAndOverride<
        Array<'platform' | 'company' | 'customer'>
      >(ACCESS_SCOPES_KEY, [context.getHandler(), context.getClass()]) ?? [];

    const hasRequirements =
      requiredPermissions.length > 0 ||
      anyPermissions.length > 0 ||
      anyRoles.length > 0 ||
      allRoles.length > 0 ||
      allowedScopes.length > 0;

    if (!hasRequirements) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      });
    }

    if (allowedScopes.length > 0 && !allowedScopes.includes(user.scope)) {
      throw new ForbiddenException({
        code: 'INVALID_ACCESS_SCOPE',
        message: `This operation requires ${allowedScopes.join(' or ')} access.`,
      });
    }

    const platformOwner =
      user.scope === 'platform' &&
      (user.userType === 'OWNER' ||
        user.userType === 'SUPER_ADMIN' ||
        user.roles.includes('OWNER') ||
        user.roles.includes('SUPER_ADMIN'));

    if (platformOwner) {
      return true;
    }

    const permissionSet = new Set(user.permissions ?? []);
    const roleSet = new Set(user.roles ?? []);

    if (
      user.scope === 'company' &&
      user.userType === 'COMPANY_USER' &&
      roleSet.has('USER')
    ) {
      COMPANY_USER_POLICY_PERMISSIONS.forEach((permission) =>
        permissionSet.add(permission),
      );
    }

    const missingPermissions = requiredPermissions.filter(
      (permission) => !permissionSet.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException({
        code: 'MISSING_REQUIRED_PERMISSION',
        message: 'You do not have the required permission.',
        details: {
          required: requiredPermissions,
          missing: missingPermissions,
        },
      });
    }

    if (
      anyPermissions.length > 0 &&
      !anyPermissions.some((permission) => permissionSet.has(permission))
    ) {
      throw new ForbiddenException({
        code: 'MISSING_ANY_PERMISSION',
        message: 'You do not have any of the required permissions.',
        details: { requiredAny: anyPermissions },
      });
    }

    if (anyRoles.length > 0 && !anyRoles.some((role) => roleSet.has(role))) {
      throw new ForbiddenException({
        code: 'MISSING_REQUIRED_ROLE',
        message: 'You do not have a required role.',
        details: { requiredAny: anyRoles },
      });
    }

    const missingRoles = allRoles.filter((role) => !roleSet.has(role));

    if (missingRoles.length > 0) {
      throw new ForbiddenException({
        code: 'MISSING_REQUIRED_ROLES',
        message: 'You do not have all required roles.',
        details: { required: allRoles, missing: missingRoles },
      });
    }

    return true;
  }
}
