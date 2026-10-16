import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type UnderwriteActionValue,
  underwriteLineFromSlug,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import {
  UNDERWRITE_LINE_ACTION_KEY,
  type UnderwriteRequest,
  userHasPermission,
} from './underwrite-line.access';

/**
 * Resolves the `:line` route segment and enforces the matching
 * `underwrite.<line>.<action>` permission. Runs after the global guards, so
 * authentication, tenant boundary and `@Permissions(...)` are already checked.
 */
@Injectable()
export class UnderwriteLineGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<UnderwriteRequest>();
    const line = underwriteLineFromSlug(request.params?.line ?? '');

    if (!line) {
      throw new NotFoundException('Unknown underwrite line');
    }

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      });
    }

    const action = this.reflector.getAllAndOverride<UnderwriteActionValue>(
      UNDERWRITE_LINE_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!action) {
      // Fail closed: every line route must declare its gate.
      throw new ForbiddenException('Underwrite line access is not declared');
    }

    const granting = underwritePermissionsGranting(line, action);
    const permission = granting[0];
    if (!granting.some((item) => userHasPermission(user, item))) {
      throw new ForbiddenException({
        code: 'MISSING_REQUIRED_PERMISSION',
        message: 'You do not have the required permission.',
        details: { required: [permission], missing: [permission] },
      });
    }

    request.underwriteLine = line;
    return true;
  }
}
