import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class TiramisCompanyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    const roles = [
      ...(Array.isArray(user.role_codes) ? user.role_codes : []),
      ...(Array.isArray(user.roleCodes) ? user.roleCodes : []),
      ...(Array.isArray(user.roles) ? user.roles : []),
    ].map((role) => String(role).toLowerCase());

    if (roles.includes('super_admin') || roles.includes('platform_admin')) {
      return true;
    }

    const userCompanyId =
      user.companyId ||
      user.active_company_id ||
      user.activeCompanyId ||
      null;

    const requestedCompanyId =
      request.query?.sourceCompanyId ||
      request.body?.sourceCompanyId ||
      request.params?.sourceCompanyId ||
      null;

    if (
      requestedCompanyId &&
      userCompanyId &&
      String(requestedCompanyId) !== String(userCompanyId)
    ) {
      throw new ForbiddenException(
        'You cannot access TIRAMIS records from another company',
      );
    }

    return true;
  }
}
