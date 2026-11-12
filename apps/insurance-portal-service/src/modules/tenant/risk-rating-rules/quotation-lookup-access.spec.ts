import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from '@insurance-max/portal-shared/guards/authorization.guard';
import { RiskRatingRulesController } from './risk-rating-rules.controller';
import { ProductDistributionController } from '../product-distribution/product-distribution.controller';

describe('quotation lookup authorization', () => {
  const guard = new AuthorizationGuard(new Reflector());
  const context = (controller: any, handler: any, scope = 'company') =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { scope, roles: [], permissions: [], userType: 'COMPANY_USER' },
        }),
      }),
    }) as any;

  it.each([
    [RiskRatingRulesController, RiskRatingRulesController.prototype.findAll],
    [
      ProductDistributionController,
      ProductDistributionController.prototype.listChannels,
    ],
  ])(
    'allows company users to read the lookup without a permission',
    (controller, handler) => {
      expect(guard.canActivate(context(controller, handler))).toBe(true);
      expect(() =>
        guard.canActivate(context(controller, handler, 'customer')),
      ).toThrow();
    },
  );

  it('still requires permission to change rating rules and channels', () => {
    expect(() =>
      guard.canActivate(
        context(
          RiskRatingRulesController,
          RiskRatingRulesController.prototype.create,
        ),
      ),
    ).toThrow();
    expect(() =>
      guard.canActivate(
        context(
          ProductDistributionController,
          ProductDistributionController.prototype.createChannel,
        ),
      ),
    ).toThrow();
  });
});
