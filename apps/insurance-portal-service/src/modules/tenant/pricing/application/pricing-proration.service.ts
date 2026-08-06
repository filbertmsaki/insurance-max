import { BadRequestException, Injectable } from '@nestjs/common';
import { PricingProrationMethod } from '@insurance-max/contracts';

/**
 * Resolves the fraction of a full policy term that a cover period represents,
 * per the rate book's configured `proration_method`. Used by
 * PricingEngineService to prorate the risk premium and add-on premium for
 * short-period or non-annual covers before loadings/discounts are applied.
 */
@Injectable()
export class PricingProrationService {
  resolveFactor(
    method: PricingProrationMethod,
    coverStartDate: string,
    coverEndDate: string,
  ): number {
    const start = new Date(`${coverStartDate}T00:00:00.000Z`);
    const end = new Date(`${coverEndDate}T00:00:00.000Z`);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      throw new BadRequestException('Invalid cover date range.');
    }

    const inclusiveDays =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

    switch (method) {
      case PricingProrationMethod.NONE:
        return 1;
      case PricingProrationMethod.DAILY_365:
        return inclusiveDays / 365;
      case PricingProrationMethod.DAILY_366:
        return inclusiveDays / 366;
      case PricingProrationMethod.MONTHLY_12: {
        const months = Math.max(1, Math.ceil(inclusiveDays / 30.4375));
        return months / 12;
      }
      default:
        return 1;
    }
  }
}
