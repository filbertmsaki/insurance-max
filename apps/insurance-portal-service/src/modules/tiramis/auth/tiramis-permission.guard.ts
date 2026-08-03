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

    if (this.isPlatformSuperAdmin(user)) {
      return true;
    }

    const userPermissions = this.extractUserPermissions(user);
    if (
      requiredPermissions.includes(TiramisPermissions.VIEW_TRACKING) &&
      userPermissions.some((permission) =>
        [
          'verifications:motor:submit',
          'verifications:cover-note:submit',
        ].includes(permission),
      )
    ) {
      userPermissions.push(TiramisPermissions.VIEW_TRACKING);
    }
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

  private isPlatformSuperAdmin(user: any): boolean {
    const userType = String(
      user.userType ?? user.user_type ?? '',
    ).toUpperCase();

    return (
      user.scope === 'platform' && ['OWNER', 'SUPER_ADMIN'].includes(userType)
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
}
