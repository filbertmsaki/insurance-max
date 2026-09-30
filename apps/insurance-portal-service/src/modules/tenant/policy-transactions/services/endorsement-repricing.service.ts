import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type {
  PricingFactorValues,
  PricingMultiRiskInput,
  PricingSingleRiskInput,
  RiskPremiumResult,
} from '../../pricing/domain/pricing.types';
import {
  PricingQuote,
  PricingQuoteScope,
} from '../../pricing/entities/pricing-quote.entity';
import { PricingEngineService } from '../../pricing/application/pricing-engine.service';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import {
  EndorsementPricingService,
  type RemainingPeriodPricingResult,
} from './endorsement-pricing.service';

interface EndorsementRiskTax {
  taxCode: string;
  isTaxExempted: string;
  taxExemptionType: string | null;
  taxExemptionReference: string | null;
  taxRate: string;
  taxAmount: string;
}

interface EndorsementRiskDiscount {
  discountType: number | null;
  discountRate: string | null;
  discountAmount: string | null;
}

interface RiskPricingAudit {
  entryIndex: number;
  riskIndex: number;
  quotationRiskId: string | null;
  insuranceRiskId: string;
  sourcePricingQuoteId: string;
  riskCode: string;
  sumInsured: string;
  sumInsuredEquivalent: string;
  premiumRate: string;
  premiumBeforeDiscount: string;
  premiumAfterDiscount: string;
  premiumExcludingTaxEquivalent: string;
  premiumIncludingTax: string;
  finalPayablePremium: string;
  premiumExcludingTax: string;
  taxAmount: string;
  chargeAmount: string;
  discounts: EndorsementRiskDiscount[];
  taxes: EndorsementRiskTax[];
  discountApprovalRequired: boolean;
  loadingApprovalRequired: boolean;
  resultHash: string;
  factors: PricingFactorValues;
}

interface PricingRun {
  remaining: RemainingPeriodPricingResult;
  risks: RiskPricingAudit[];
  approvalRequired: boolean;
  taxAmount: string;
  chargeAmount: string;
  premiumExcludingTax: string;
  pricingResultHashes: string[];
}

interface EndorsementPricingAuthoritySnapshot {
  sourcePolicyPremium: string;
  revisedFullTermPremium: string;
  earnedPremiumBeforeChange: string;
  remainingOldPremium: string;
  remainingNewPremium: string;
  premiumDifference: string;
  taxDifference: string;
  chargeDifference: string;
  commissionDifference: string;
  customerPayableDifference: string;
  premiumEffect: 'NONE' | 'DEBIT' | 'CREDIT';
  currencyCode: string;
  effectiveDate: string;
  calculationMethod: string;
  pricingResultHashes: string[];
  sourceRiskPricing: RiskPricingAudit[];
  proposedRiskPricing: RiskPricingAudit[];
  pricingApprovalRequired: boolean;
  snapshotHash: string;
}

@Injectable()
export class EndorsementRepricingService {
  constructor(
    private readonly pricingEngineService: PricingEngineService,
    private readonly comparisonService: EndorsementPricingService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async reprice(
    manager: EntityManager,
    transaction: PolicyTransaction,
    sourceSnapshot: Record<string, unknown>,
    proposedSnapshot: Record<string, unknown>,
  ): Promise<{
    snapshot: EndorsementPricingAuthoritySnapshot;
    approvalRequired: boolean;
  }> {
    const sourceRun = await this.priceRemainingPolicy(
      manager,
      transaction,
      sourceSnapshot,
    );
    const proposedRun = await this.priceRemainingPolicy(
      manager,
      transaction,
      proposedSnapshot,
    );
    const sourceTotals = this.asObject(sourceSnapshot['totals']) ?? {};
    const sourcePolicyPremium = this.money(sourceTotals['totalPremium']);
    const earnedPremium = this.calculateEarnedPremiumBeforeChange(
      sourceSnapshot,
      transaction.effective_date,
      sourcePolicyPremium,
    );
    const revisedFullTermPremium = DecimalUtil.value(earnedPremium)
      .plus(proposedRun.remaining.finalPayablePremium)
      .toFixed(4);

    const oldPricing: RemainingPeriodPricingResult = {
      ...sourceRun.remaining,
      fullTermPremium: sourcePolicyPremium,
      earnedBeforeEffectiveDate: earnedPremium,
    };
    const newPricing: RemainingPeriodPricingResult = {
      ...proposedRun.remaining,
      fullTermPremium: revisedFullTermPremium,
      earnedBeforeEffectiveDate: earnedPremium,
    };

    const comparison = this.comparisonService.compare({
      sourcePolicyPremium,
      oldPricing,
      newPricing,
      currencyCode: transaction.currency_code,
      effectiveDate: transaction.effective_date,
      calculationMethod: 'LIVE_PRICING_ENGINE_REMAINING_PERIOD',
    });

    const pricingResultHashes = [
      ...sourceRun.pricingResultHashes,
      ...proposedRun.pricingResultHashes,
    ];
    const unsigned = {
      ...comparison,
      calculationMethod: 'LIVE_PRICING_ENGINE_REMAINING_PERIOD',
      pricingResultHashes,
      sourceRiskPricing: sourceRun.risks,
      proposedRiskPricing: proposedRun.risks,
      pricingApprovalRequired:
        sourceRun.approvalRequired || proposedRun.approvalRequired,
    };
    const snapshotHash = this.hashService.hashDefinition(unsigned);

    return {
      snapshot: {
        ...unsigned,
        snapshotHash,
      },
      approvalRequired:
        sourceRun.approvalRequired || proposedRun.approvalRequired,
    };
  }

  private async priceRemainingPolicy(
    manager: EntityManager,
    transaction: PolicyTransaction,
    snapshot: Record<string, unknown>,
  ): Promise<PricingRun> {
    const entries = this.asArray(snapshot['entries']);

    if (!entries.length) {
      throw new UnprocessableEntityException(
        'The policy snapshot does not contain insured entries.',
      );
    }

    const cover = this.asObject(snapshot['cover']) ?? {};
    const policyEndDate = String(cover['endDate'] ?? snapshot['endDate'] ?? '');

    if (!policyEndDate) {
      throw new UnprocessableEntityException(
        'The policy snapshot does not contain a cover end date.',
      );
    }

    if (transaction.effective_date > policyEndDate) {
      throw new UnprocessableEntityException(
        'The endorsement effective date is after the policy expiry date.',
      );
    }

    const riskResults: RiskPricingAudit[] = [];
    let finalPayable = DecimalUtil.value(0);
    let premiumExcludingTax = DecimalUtil.value(0);
    let totalTax = DecimalUtil.value(0);
    let totalOtherCharges = DecimalUtil.value(0);
    let pricingApprovalRequired = false;

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const entry = this.asObject(entries[entryIndex]);

      // A vehicle removed from the fleet carries no premium for the
      // remaining period; the old/new comparison yields its return premium.
      if (
        !entry ||
        ['REMOVED', 'CANCELLED'].includes(String(entry['status']))
      ) {
        continue;
      }

      const risks = this.asArray(entry['risks']);
      const pricing = this.asObject(entry['pricing']);
      const pricingRisks = this.asArray(pricing?.['risks']);

      for (let riskIndex = 0; riskIndex < risks.length; riskIndex += 1) {
        const risk = this.asObject(risks[riskIndex]);

        if (!risk) {
          continue;
        }

        const quotationRiskId = this.stringOrNull(risk['quotationRiskId']);
        const insuranceRiskId = this.stringOrNull(risk['insuranceRiskId']);

        if (!insuranceRiskId) {
          throw new UnprocessableEntityException(
            `Entry ${entryIndex + 1}, risk ${riskIndex + 1} does not contain an insurance risk ID.`,
          );
        }

        const sourcePricing = pricingRisks
          .map((value) => this.asObject(value))
          .find((value) => {
            if (!value) return false;
            if (quotationRiskId && value['id'] === quotationRiskId) return true;
            return value['insuranceRiskId'] === insuranceRiskId;
          });
        const sourcePricingQuoteId = this.stringOrNull(
          sourcePricing?.['pricingQuoteId'],
        );

        if (!sourcePricingQuoteId) {
          throw new UnprocessableEntityException(
            `Original pricing quote is missing for policy risk ${insuranceRiskId}.`,
          );
        }

        const pricingQuote = await manager.getRepository(PricingQuote).findOne({
          where: {
            company_id: transaction.company_id,
            pricing_quote_id: sourcePricingQuoteId,
          },
        });

        if (!pricingQuote) {
          throw new UnprocessableEntityException(
            `Original pricing quote ${sourcePricingQuoteId} could not be found.`,
          );
        }

        const baseInput = this.resolveOriginalRiskInput(
          pricingQuote,
          insuranceRiskId,
          quotationRiskId,
        );
        const input = this.buildPricingInput({
          baseInput,
          transaction,
          snapshot,
          entry,
          risk,
          insuranceRiskId,
          policyEndDate,
        });
        const result = await this.pricingEngineService.calculateSingleRisk(
          transaction.company_id,
          input,
        );
        const taxAndCharges = this.resolveTaxAndCharges(result);
        const sourceDiscounts = this.asArray(sourcePricing?.['discounts'])
          .map((item) => this.asObject(item))
          .filter((item): item is Record<string, unknown> => !!item);
        const sourceDiscount = sourceDiscounts[0] ?? null;
        const discounts: EndorsementRiskDiscount[] = DecimalUtil.value(
          result.discount_amount,
        ).gt(0)
          ? [
              {
                discountType: sourceDiscount
                  ? this.numberOrNull(sourceDiscount['discountType'])
                  : null,
                discountRate:
                  result.discount_rate !== null
                    ? String(result.discount_rate)
                    : null,
                discountAmount: DecimalUtil.value(
                  result.discount_amount,
                ).toFixed(4),
              },
            ]
          : [];
        const sourceTaxes = this.asArray(sourcePricing?.['taxes'])
          .map((item) => this.asObject(item))
          .filter((item): item is Record<string, unknown> => !!item);
        const taxes: EndorsementRiskTax[] = (result.charges ?? [])
          .filter((charge) => ['TAX', 'LEVY'].includes(charge.charge_category))
          .map((charge) => {
            const original = sourceTaxes.find(
              (tax) => tax['taxCode'] === charge.charge_code,
            );

            return {
              taxCode: charge.charge_code,
              isTaxExempted: String(original?.['isTaxExempted'] ?? 'N'),
              taxExemptionType:
                original?.['taxExemptionType'] != null
                  ? String(original['taxExemptionType'])
                  : null,
              taxExemptionReference:
                original?.['taxExemptionReference'] != null
                  ? String(original['taxExemptionReference'])
                  : null,
              taxRate: charge.rate !== null ? String(charge.rate) : '0',
              taxAmount: DecimalUtil.value(charge.computed_amount).toFixed(4),
            };
          });

        finalPayable = finalPayable.plus(result.final_payable_premium);
        premiumExcludingTax = premiumExcludingTax.plus(
          result.premium_excluding_tax,
        );
        totalTax = totalTax.plus(taxAndCharges.tax);
        totalOtherCharges = totalOtherCharges.plus(taxAndCharges.other);

        if (
          result.discount_approval_required ||
          result.loading_approval_required
        ) {
          pricingApprovalRequired = true;
        }

        const resultHash = this.hashService.hashDefinition({
          sourcePricingQuoteId,
          input,
          result: {
            riskId: result.risk_id,
            ruleId: result.rule_id,
            rateBookId: result.rate_book_id,
            sumInsured: result.sum_insured,
            premiumRate: result.premium_rate,
            premiumAfterDiscount: result.premium_after_discount,
            tax: taxAndCharges.tax,
            otherCharges: taxAndCharges.other,
            finalPayablePremium: result.final_payable_premium,
          },
        });

        riskResults.push({
          entryIndex,
          riskIndex,
          quotationRiskId,
          insuranceRiskId,
          sourcePricingQuoteId,
          riskCode: result.risk_code,
          sumInsured: DecimalUtil.value(result.sum_insured).toFixed(4),
          sumInsuredEquivalent: DecimalUtil.value(
            result.sum_insured_equivalent,
          ).toFixed(4),
          premiumRate: DecimalUtil.value(result.premium_rate).toFixed(10),
          premiumBeforeDiscount: DecimalUtil.value(
            result.premium_before_discount,
          ).toFixed(4),
          premiumAfterDiscount: DecimalUtil.value(
            result.premium_after_discount,
          ).toFixed(4),
          premiumExcludingTaxEquivalent: DecimalUtil.value(
            result.premium_excluding_tax_equivalent,
          ).toFixed(4),
          premiumIncludingTax: DecimalUtil.value(
            result.premium_including_tax,
          ).toFixed(4),
          finalPayablePremium: DecimalUtil.value(
            result.final_payable_premium,
          ).toFixed(4),
          premiumExcludingTax: DecimalUtil.value(
            result.premium_excluding_tax,
          ).toFixed(4),
          taxAmount: taxAndCharges.tax,
          chargeAmount: taxAndCharges.other,
          discounts,
          taxes,
          discountApprovalRequired: result.discount_approval_required,
          loadingApprovalRequired: result.loading_approval_required,
          resultHash,
          factors: result.factors,
        });
      }
    }

    if (!riskResults.length) {
      throw new UnprocessableEntityException(
        'No priceable policy risks were found in the current policy version.',
      );
    }

    const commissionAmount = this.calculateCommission(
      snapshot,
      premiumExcludingTax.toFixed(4),
    );
    const aggregateHash = this.hashService.hashDefinition({
      effectiveDate: transaction.effective_date,
      policyEndDate,
      risks: riskResults.map((risk) => risk.resultHash),
      finalPayable: finalPayable.toFixed(4),
      tax: totalTax.toFixed(4),
      charges: totalOtherCharges.toFixed(4),
      commission: commissionAmount,
    });

    return {
      remaining: {
        finalPayablePremium: finalPayable.toFixed(4),
        fullTermPremium: finalPayable.toFixed(4),
        earnedBeforeEffectiveDate: '0.0000',
        taxAmount: totalTax.toFixed(4),
        chargeAmount: totalOtherCharges.toFixed(4),
        commissionAmount,
        resultHash: aggregateHash,
      },
      risks: riskResults,
      approvalRequired: pricingApprovalRequired,
      taxAmount: totalTax.toFixed(4),
      chargeAmount: totalOtherCharges.toFixed(4),
      premiumExcludingTax: premiumExcludingTax.toFixed(4),
      pricingResultHashes: riskResults.map((risk) => risk.resultHash),
    };
  }

  private resolveOriginalRiskInput(
    pricingQuote: PricingQuote,
    insuranceRiskId: string,
    quotationRiskId: string | null,
  ): PricingSingleRiskInput {
    if (pricingQuote.quote_scope === PricingQuoteScope.SINGLE_RISK) {
      return {
        ...(pricingQuote.input_payload as unknown as PricingSingleRiskInput),
      };
    }

    const multiInput =
      pricingQuote.input_payload as unknown as PricingMultiRiskInput;
    const riskInput = (multiInput.risks ?? []).find((item) => {
      if (item.risk_id === insuranceRiskId) return true;
      if (quotationRiskId && item.client_reference === quotationRiskId) {
        return true;
      }
      return false;
    });

    if (!riskInput) {
      throw new UnprocessableEntityException(
        `Risk ${insuranceRiskId} could not be reconstructed from pricing quote ${pricingQuote.pricing_quote_id}.`,
      );
    }

    return {
      ...riskInput,
      effective_date: riskInput.effective_date ?? multiInput.effective_date,
      quotation_type: riskInput.quotation_type ?? multiInput.quotation_type,
      currency_code: riskInput.currency_code ?? multiInput.currency_code,
      exchange_rate: riskInput.exchange_rate ?? multiInput.exchange_rate,
    };
  }

  private buildPricingInput(params: {
    baseInput: PricingSingleRiskInput;
    transaction: PolicyTransaction;
    snapshot: Record<string, unknown>;
    entry: Record<string, unknown>;
    risk: Record<string, unknown>;
    insuranceRiskId: string;
    policyEndDate: string;
  }): PricingSingleRiskInput {
    const cover = this.asObject(params.snapshot['cover']) ?? {};
    const motor = this.asObject(params.entry['motor']);
    const factors: PricingFactorValues = {
      ...(params.baseInput.factor_values ?? {}),
      ...(params.baseInput.factors ?? {}),
    };
    const sumInsured = this.numberOrNull(params.risk['sumInsured']);

    if (sumInsured !== null) {
      factors['sum_insured'] = sumInsured;
    }

    if (motor) {
      if (motor['sittingCapacity'] !== undefined) {
        factors['seat_capacity'] = Number(motor['sittingCapacity']);
      }
      if (motor['yearOfManufacture'] !== undefined) {
        factors['year_of_manufacture'] = Number(motor['yearOfManufacture']);
      }
      if (motor['grossWeight'] !== undefined) {
        factors['gross_weight_tons'] = Number(motor['grossWeight']);
      }
    }

    const exchangeRate = this.numberOrNull(cover['exchangeRate']);

    return {
      ...params.baseInput,
      risk_id: params.insuranceRiskId,
      sum_insured: sumInsured ?? params.baseInput.sum_insured,
      factors,
      factor_values: {},
      effective_date: params.transaction.effective_date,
      currency_code: params.transaction.currency_code,
      exchange_rate: exchangeRate ?? params.baseInput.exchange_rate,
      cover_start_date: params.transaction.effective_date,
      cover_end_date: params.policyEndDate,
    };
  }

  private resolveTaxAndCharges(result: RiskPremiumResult): {
    tax: string;
    other: string;
  } {
    let tax = DecimalUtil.value(0);
    let other = DecimalUtil.value(0);

    for (const charge of result.charges ?? []) {
      const amount = DecimalUtil.value(charge.computed_amount);

      switch (charge.charge_category) {
        case 'TAX':
        case 'LEVY':
          tax = tax.plus(amount);
          break;
        default:
          other = other.plus(amount);
          break;
      }
    }

    return {
      tax: tax.toFixed(4),
      other: other.toFixed(4),
    };
  }

  private calculateCommission(
    snapshot: Record<string, unknown>,
    remainingPremiumExcludingTax: string,
  ): string {
    const totals = this.asObject(snapshot['totals']) ?? {};
    const sourceCommission = DecimalUtil.value(
      this.money(totals['totalCommission']),
    );
    const sourceNetPremium = DecimalUtil.value(
      this.money(totals['netPremium']),
    );

    if (
      sourceCommission.lessThanOrEqualTo(0) ||
      sourceNetPremium.lessThanOrEqualTo(0)
    ) {
      return '0.0000';
    }

    return DecimalUtil.value(remainingPremiumExcludingTax)
      .mul(sourceCommission.div(sourceNetPremium))
      .toFixed(4);
  }

  private calculateEarnedPremiumBeforeChange(
    snapshot: Record<string, unknown>,
    effectiveDate: string,
    sourcePolicyPremium: string,
  ): string {
    const startDate = String(snapshot['startDate'] ?? '');
    const endDate = String(snapshot['endDate'] ?? '');

    if (!startDate || !endDate) {
      return '0.0000';
    }

    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    const effective = new Date(`${effectiveDate}T00:00:00.000Z`).getTime();
    const policyDays = Math.max(Math.floor((end - start) / 86_400_000) + 1, 1);
    const elapsedDays = Math.min(
      Math.max(Math.floor((effective - start) / 86_400_000), 0),
      policyDays,
    );

    return DecimalUtil.value(sourcePolicyPremium)
      .mul(elapsedDays / policyDays)
      .toFixed(4);
  }

  private money(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return '0.0000';
    }

    return DecimalUtil.value(value as string | number).toFixed(4);
  }

  private numberOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        `Invalid numeric policy value: ${String(value)}`,
      );
    }

    return parsed;
  }

  private stringOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
