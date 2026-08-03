import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { SUBSCRIPTION_FEATURE_KEY } from '../decorators/require-subscription-feature.decorator';
import { SubscriptionAccessService } from '../services/subscription-access.service';

@Injectable()
export class SubscriptionFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureCode = this.reflector.getAllAndOverride<string>(
      SUBSCRIPTION_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureCode) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    if (!request.user?.companyId) {
      return false;
    }

    await this.subscriptionAccessService.assertFeatureEnabled(
      request.user.companyId,
      featureCode,
    );

    return true;
  }
}
