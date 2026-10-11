import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CancellationMethod } from '@insurance-max/contracts';

import { DecimalUtil } from '../../../shared/finance/decimal.util';

export interface CancellationPricingInput {
  policyStartDate: string;
  policyEndDate: string;
  cancellationEffectiveDate: string;
  /** Refundable premium base: premium excluding non-refundable tax/charges. */
  grossWrittenPremium: string;
  cancellationMethod: CancellationMethod;
  /** Flat charge configured on the product/company cancellation rules. */
  cancellationCharge?: string;
  /** Minimum-retained-premium floor, only used by MINIMUM_RETAINED. */
  minimumRetainedPremium?: string;
}

export interface CancellationPricingResult {
  policyDays: number;
  daysOnRisk: number;
  remainingDays: number;
  earnedPremium: string;
  unearnedPremium: string;
  cancellationCharge: string;
  refundAmount: string;
  amountDue: string;
}

/**
 * Cancellation premium calculation (§13.18). The method is always resolved
 * from product/company configuration by the caller — never hard-coded here
 * or accepted verbatim from the frontend.
 */
@Injectable()
export class CancellationPricingService {
  calculate(input: CancellationPricingInput): CancellationPricingResult {
    if (
      input.cancellationEffectiveDate < input.policyStartDate ||
      input.cancellationEffectiveDate > input.policyEndDate
    ) {
      throw new Error(
        'Cancellation effective date must be inside the policy period.',
      );
    }

    const policyDays = this.inclusiveDays(
      input.policyStartDate,
      input.policyEndDate,
    );
    const daysOnRisk = this.inclusiveDays(
      input.policyStartDate,
      input.cancellationEffectiveDate,
    );
    const remainingDays = Math.max(policyDays - daysOnRisk, 0);
    const grossPremium = DecimalUtil.value(input.grossWrittenPremium);

    const { earnedPremium, unearnedPremium, cancellationCharge } =
      this.applyMethod(input.cancellationMethod, {
        grossPremium,
        policyDays,
        daysOnRisk,
        configuredCharge: DecimalUtil.value(input.cancellationCharge ?? 0),
        minimumRetainedPremium: DecimalUtil.value(
          input.minimumRetainedPremium ?? 0,
        ),
      });

    const netSettlement = unearnedPremium.minus(cancellationCharge);
    const refundAmount = Decimal.max(netSettlement, 0);
    const amountDue = Decimal.max(netSettlement.negated(), 0);

    return {
      policyDays,
      daysOnRisk,
      remainingDays,
      earnedPremium: earnedPremium.toFixed(4),
      unearnedPremium: unearnedPremium.toFixed(4),
      cancellationCharge: cancellationCharge.toFixed(4),
      refundAmount: refundAmount.toFixed(4),
      amountDue: amountDue.toFixed(4),
    };
  }

  private applyMethod(
    method: CancellationMethod,
    params: {
      grossPremium: Decimal;
      policyDays: number;
      daysOnRisk: number;
      configuredCharge: Decimal;
      minimumRetainedPremium: Decimal;
    },
  ): {
    earnedPremium: Decimal;
    unearnedPremium: Decimal;
    cancellationCharge: Decimal;
  } {
    const { grossPremium, policyDays, daysOnRisk, configuredCharge } = params;

    switch (method) {
      case CancellationMethod.FULL_REFUND: {
        return {
          earnedPremium: new Decimal(0),
          unearnedPremium: grossPremium,
          cancellationCharge: new Decimal(0),
        };
      }

      case CancellationMethod.NO_REFUND: {
        return {
          earnedPremium: grossPremium,
          unearnedPremium: new Decimal(0),
          cancellationCharge: configuredCharge,
        };
      }

      case CancellationMethod.MINIMUM_RETAINED: {
        const proRataEarned = this.proRataEarned(
          grossPremium,
          daysOnRisk,
          policyDays,
        );
        const earnedPremium = Decimal.max(
          proRataEarned,
          params.minimumRetainedPremium,
        );
        const unearnedPremium = Decimal.max(
          grossPremium.minus(earnedPremium),
          0,
        );
        return {
          earnedPremium,
          unearnedPremium,
          cancellationCharge: configuredCharge,
        };
      }

      case CancellationMethod.SHORT_PERIOD:
      case CancellationMethod.PRO_RATA:
      default: {
        // SHORT_PERIOD scale tables are product/company configuration that
        // resolve to an effective `configuredCharge` upstream — the day-count
        // math here is identical to PRO_RATA once that charge is known.
        const earnedPremium = this.proRataEarned(
          grossPremium,
          daysOnRisk,
          policyDays,
        );
        const unearnedPremium = Decimal.max(
          grossPremium.minus(earnedPremium),
          0,
        );
        return {
          earnedPremium,
          unearnedPremium,
          cancellationCharge: configuredCharge,
        };
      }
    }
  }

  private proRataEarned(
    grossPremium: Decimal,
    daysOnRisk: number,
    policyDays: number,
  ): Decimal {
    if (policyDays <= 0) {
      return new Decimal(0);
    }

    return grossPremium.mul(daysOnRisk).div(policyDays);
  }

  private inclusiveDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }
}
