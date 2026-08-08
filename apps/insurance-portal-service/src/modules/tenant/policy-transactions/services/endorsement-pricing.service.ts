import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  PolicyTransactionPremiumEffect,
  type PolicyTransactionPricingSnapshot,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { DecimalUtil } from '../../../shared/finance/decimal.util';

export interface RemainingPeriodPricingResult {
  finalPayablePremium: string;
  fullTermPremium: string;
  earnedBeforeEffectiveDate: string;
  taxAmount: string;
  commissionAmount: string;
  resultHash: string;
}

export interface EndorsementPricingInput {
  sourcePolicyPremium: string;
  oldPricing: RemainingPeriodPricingResult;
  newPricing: RemainingPeriodPricingResult;
  currencyCode: string;
  effectiveDate: string;
  calculationMethod?: string;
}

/**
 * Compares old-vs-new remaining-period premiums for an endorsement
 * (§13.12). The actual re-pricing of the old/new policy snapshots for the
 * remaining period (transaction effective date -> policy end date) is
 * expected to be produced upstream via the existing
 * `pricing/application/pricing-engine.service.ts` per-risk calculators —
 * there is no single `pricePolicySnapshot` entry point in this codebase, so
 * the caller (EndorsementService) is responsible for invoking the engine
 * per risk and folding the results into a RemainingPeriodPricingResult
 * before calling this comparator. This keeps the DEBIT/CREDIT/NONE
 * determination and pricing-snapshot shape centralized and testable
 * independent of that integration.
 */
@Injectable()
export class EndorsementPricingService {
  constructor(private readonly hashService: ProductDefinitionHashService) {}

  compare(input: EndorsementPricingInput): PolicyTransactionPricingSnapshot {
    const oldPayable = DecimalUtil.value(input.oldPricing.finalPayablePremium);
    const newPayable = DecimalUtil.value(input.newPricing.finalPayablePremium);
    const difference = newPayable.minus(oldPayable);

    const taxDifference = DecimalUtil.value(input.newPricing.taxAmount).minus(
      DecimalUtil.value(input.oldPricing.taxAmount),
    );
    const commissionDifference = DecimalUtil.value(
      input.newPricing.commissionAmount,
    ).minus(DecimalUtil.value(input.oldPricing.commissionAmount));

    const premiumEffect = this.resolveEffect(difference);

    const snapshot: Omit<
      PolicyTransactionPricingSnapshot,
      'pricingResultHashes' | 'snapshotHash'
    > = {
      sourcePolicyPremium: input.sourcePolicyPremium,
      revisedFullTermPremium: input.newPricing.fullTermPremium,
      earnedPremiumBeforeChange: input.oldPricing.earnedBeforeEffectiveDate,
      remainingOldPremium: oldPayable.toFixed(4),
      remainingNewPremium: newPayable.toFixed(4),
      premiumDifference: difference.toFixed(4),
      taxDifference: taxDifference.toFixed(4),
      chargeDifference: '0.0000',
      commissionDifference: commissionDifference.toFixed(4),
      customerPayableDifference: difference.toFixed(4),
      premiumEffect,
      currencyCode: input.currencyCode,
      effectiveDate: input.effectiveDate,
      calculationMethod:
        input.calculationMethod ?? 'REMAINING_PERIOD_DIFFERENCE',
    };

    const pricingResultHashes = [
      input.oldPricing.resultHash,
      input.newPricing.resultHash,
    ];

    return {
      ...snapshot,
      pricingResultHashes,
      snapshotHash: this.hashService.hashDefinition({
        ...snapshot,
        pricingResultHashes,
      }),
    };
  }

  private resolveEffect(difference: Decimal): PolicyTransactionPremiumEffect {
    if (difference.greaterThan(0)) {
      return PolicyTransactionPremiumEffect.DEBIT;
    }

    if (difference.lessThan(0)) {
      return PolicyTransactionPremiumEffect.CREDIT;
    }

    return PolicyTransactionPremiumEffect.NONE;
  }
}
