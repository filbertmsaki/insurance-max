import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { PORTAL_ACTORS_KEY } from '../decorators/portal-actors.decorator';
import { PortalActorType } from '../enums/portal.enums';
import { PortalPermissions } from '../portal.permissions';
import { PortalAccountsService } from '../services/portal-accounts.service';

/**
 * Verifies: authenticated JWT user + active company context + active portal
 * account + allowed actor type + the portal permission matching that actor
 * type. Fails closed - a handler that forgets @PortalActors(...) is rejected
 * rather than treated as "any actor allowed". The permission check matters
 * because the shared portal controller serves both actor types behind a
 * single @PortalActors(CUSTOMER, INTERMEDIARY) declaration - without it,
 * revoking a user's portal role would not immediately block their access
 * while an active portal_accounts record still exists.
 */
@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accountsService: PortalAccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actors = this.reflector.getAllAndOverride<PortalActorType[]>(
      PORTAL_ACTORS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!actors || actors.length === 0) {
      throw new ForbiddenException(
        'This endpoint is missing a required @PortalActors() declaration',
      );
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      portalAccount?: unknown;
    }>();

    const user = request.user;

    if (!user?.id || !user.companyId) {
      throw new UnauthorizedException(
        'Authenticated portal company context is required',
      );
    }

    const account = await this.accountsService.findActiveForUser(
      user.id,
      user.companyId,
      actors,
    );

    const requiredPermission =
      account.actor_type === PortalActorType.CUSTOMER
        ? PortalPermissions.CUSTOMER_ACCESS
        : PortalPermissions.INTERMEDIARY_ACCESS;

    const permissions = new Set(user.permissions ?? []);

    if (!permissions.has(requiredPermission)) {
      throw new ForbiddenException('Portal permission has been revoked');
    }

    request.portalAccount = account;

    return true;
  }
}
