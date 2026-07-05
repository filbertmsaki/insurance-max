import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TIRAMIS_PERMISSIONS_KEY } from './tiramis-permission.decorator';
import {
  TiramisPermission,
  TiramisPermissions,
} from './tiramis-permissions.constant';

@Injectable()
export class TiramisPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<TiramisPermission[]>(
        TIRAMIS_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) || [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }

    if (this.isSuperAdmin(user)) {
      return true;
    }

    const userPermissions = this.extractUserPermissions(user);
    const hasPermission = requiredPermissions.some(
      (permission) =>
        userPermissions.includes(permission) ||
        userPermissions.includes(TiramisPermissions.ADMIN),
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this TIRAMIS action',
        requiredPermissions,
      });
    }

    return true;
  }

  private isSuperAdmin(user: any): boolean {
    const roles = this.extractUserRoles(user);

    return roles.some((role) =>
      ['super_admin', 'platform_admin', 'admin'].includes(
        String(role).toLowerCase(),
      ),
    );
  }

  private extractUserPermissions(user: any): string[] {
    const values = [
      ...(Array.isArray(user.permission_codes) ? user.permission_codes : []),
      ...(Array.isArray(user.permissionCodes) ? user.permissionCodes : []),
      ...(Array.isArray(user.permissions) ? user.permissions : []),
    ];

    return values
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        return item?.code || item?.name || item?.permission_code || null;
      })
      .filter(Boolean)
      .map((item) => String(item).trim());
  }

  private extractUserRoles(user: any): string[] {
    const values = [
      ...(Array.isArray(user.role_codes) ? user.role_codes : []),
      ...(Array.isArray(user.roleCodes) ? user.roleCodes : []),
      ...(Array.isArray(user.roles) ? user.roles : []),
    ];

    return values
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        return item?.code || item?.name || item?.role_code || null;
      })
      .filter(Boolean)
      .map((item) => String(item).trim());
  }
}
