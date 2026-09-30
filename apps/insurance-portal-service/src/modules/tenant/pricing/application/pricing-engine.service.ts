import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PricingProrationMethod,
  PricingRoundingMode,
} from '@insurance-max/contracts';
import {
  applyRate,
  displayPercentageFromRate,
  roundMoney,
  sumDecimals,
  toDecimal,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { RatingFactorValidatorService } from '../infrastructure/rating-factor-validator.service';
import { RatingRuleMatcherService } from '../infrastructure/rating-rule-matcher.service';
import { PremiumBreakdownService } from '../infrastructure/premium-breakdown.service';
import { PricingRateBook } from '../../pricing-rate-books/entities/pricing-rate-book.entity';
import { RiskRuleCondition } from '../../risk-rule-conditions/entities/risk-rule-condition.entity';
import { PricingChargeService } from './pricing-charge.service';
import { PricingValidationService } from './pricing-validation.service';
import {
  AddonPricingService,
  type AddonPricingCalculationResult,
} from './addon-pricing.service';
import { PricingProrationService } from './pricing-proration.service';
import { roundToIncrement } from './pricing-rounding.util';
import type {
  AddonPricingResultContext,
  MultiRiskPremiumFailure,
  MultiRiskPremiumResult,
  PricingAdjustmentControl,
  PricingAdjustmentRequestInput,
  PricingAdjustmentType,
  PricingMultiRiskInput,
  PricingRateBookContext,
  PricingSingleRiskInput,
  PricingFactorValidationResult,
  PricingValidationFailurePayload,
  RiskPremiumResult,
  RiskRuleConditionContext,
  RiskRuleExplanation,
} from '../domain/pricing.types';

@Injectable()
export class PricingEngineService {
  constructor(
    private readonly pricingValidationService: PricingValidationService,
    private readonly ratingFactorValidatorService: RatingFactorValidatorService,
    private readonly ratingRuleMatcherService: RatingRuleMatcherService,
    private readonly premiumBreakdownService: PremiumBreakdownService,
    private readonly pricingChargeService: PricingChargeService,
    private readonly addonPricingService: AddonPricingService,
    private readonly pricingProrationService: PricingProrationService,
  ) {}

  async calculateSingleRisk(
    companyId: string,
    input: PricingSingleRiskInput,
  ): Promise<RiskPremiumResult> {
    const risk = await this.pricingValidationService.requireActiveRisk(
      companyId,
      input.risk_id,
    );
    this.pricingValidationService.assertPricingConfigurationAvailable(risk);

    const factorValues =
      this.ratingFactorValidatorService.normalizeInputFactors(input);
    const validationResult =
      await this.ratingFactorValidatorService.validateForRisk(
        companyId,
        input.risk_id,
        factorValues,
        input.effective_date ?? null,
      );
    if (!validationResult.calculation_allowed) {
      throw new BadRequestException(
        this.buildValidationFailurePayload(validationResult),
      );
    }
    this.pricingValidationService.assertMotorRiskSelectionMatches(
      risk,
      validationResult.normalized_factor_values,
      input.effective_date ?? null,
    );

    const matchingRule =
      await this.ratingRuleMatcherService.findFirstMatchingRule(
        companyId,
        input.risk_id,
        validationResult.normalized_factor_values,
        input.effective_date ?? null,
        input.currency_code ?? null,
      );

    if (!matchingRule) {
      throw new NotFoundException(
        `No active matching rating rule found for risk ${input.risk_id}`,
      );
    }

    const effectiveRule =
      this.ratingRuleMatcherService.resolveEffectiveRule(matchingRule);
    const breakdown = this.premiumBreakdownService.buildBreakdown(
      effectiveRule,
      validationResult.normalized_factor_values,
    );

    const discountControl = this.buildAdjustmentControl(
      matchingRule,
      'discount',
    );
    const loadingControl = this.buildAdjustmentControl(matchingRule, 'loading');

    const rateBook = matchingRule.rate_book ?? null;
    const effectiveDate =
      input.effective_date ?? new Date().toISOString().slice(0, 10);

    // Optional add-ons are priced against the same resolved rate book as the
    // primary risk premium. A rate book must exist to have any
    // product_addon_rate_rules to resolve against.
    const addonResults: AddonPricingCalculationResult[] =
      input.addons && input.addons.length > 0
        ? await this.addonPricingService.calculate({
            companyId,
            rateBookId: this.requireRateBookIdForAddons(
              matchingRule.rate_book_id ?? null,
            ),
            effectiveDate,
            factors: validationResult.normalized_factor_values,
            selectedAddons: input.addons.map((addon) => ({
              addonDefinitionId: addon.addon_definition_id,
              quantity: addon.quantity ?? 1,
              sumInsured: addon.sum_insured ?? null,
            })),
          })
        : [];
    const baseAddonPremium = roundMoney(
      sumDecimals(addonResults.map((result) => result.premium)),
    );

    // Calculation order per PRICING_CALCULATION_SEQUENCE: minimum/maximum
    // premium (already applied by buildBreakdown) -> optional covers
    // (add-ons) -> proration -> loadings -> discounts -> taxes/levies/fees.
    // Both the min/max-clamped risk premium and the add-on premium are
    // prorated together, before loadings are computed on top of the result.
    const prorationMethod =
      rateBook?.proration_method ?? PricingProrationMethod.NONE;
    let prorationFactor = 1;
    if (prorationMethod !== PricingProrationMethod.NONE) {
      if (!input.cover_start_date || !input.cover_end_date) {
        throw new BadRequestException(
          'cover_start_date and cover_end_date are required to prorate this premium.',
        );
      }
      prorationFactor = this.pricingProrationService.resolveFactor(
        prorationMethod,
        input.cover_start_date,
        input.cover_end_date,
      );
    }

    const proratedRiskPremium = roundMoney(
      toDecimal(breakdown.final_premium).mul(prorationFactor),
    );
    const proratedAddonPremium = roundMoney(
      toDecimal(baseAddonPremium).mul(prorationFactor),
    );
    const premiumBeforeLoading = roundMoney(
      proratedRiskPremium + proratedAddonPremium,
    );

    // Loading and discount are computed here as a live, unauthorized
    // preview — the matched rule's own limits are used to flag
    // discount_approval_required/loading_approval_required, but a value
    // above the limit is still computed and returned (not rejected) so the
    // frontend can show the user what would happen; actual enforcement
    // happens at quotation submission time.
    const loadingRate = input.loading?.rate ?? null;
    const loadingAmount = this.computeAdjustmentAmount(
      premiumBeforeLoading,
      input.loading,
    );
    const loadingApprovalRequired = this.isAdjustmentApprovalRequired(
      loadingControl,
      loadingRate,
      loadingAmount,
    );

    const premiumBeforeDiscount = roundMoney(
      premiumBeforeLoading + loadingAmount,
    );

    const discountType = this.resolveAdjustmentType(input.discount);
    const discountRate = input.discount?.rate ?? null;
    const discountAmount = this.computeAdjustmentAmount(
      premiumBeforeDiscount,
      input.discount,
    );
    const discountApprovalRequired = this.isAdjustmentApprovalRequired(
      discountControl,
      discountRate,
      discountAmount,
    );

    const premiumAfterDiscount = roundMoney(
      premiumBeforeDiscount - discountAmount,
    );

    const chargeSummary = await this.pricingChargeService.calculateCharges(
      companyId,
      {
        category_id: risk.product?.category_id ?? null,
        product_id: risk.product_id,
        risk_id: risk.id,
        effective_date: input.effective_date ?? null,
        basic_premium: breakdown.base_premium,
        net_premium: premiumAfterDiscount,
        gross_premium: premiumBeforeDiscount,
        tax_rule_ids: input.tax_rule_ids ?? null,
        tax_codes: input.tax_codes ?? null,
      },
    );

    const sumInsured = roundMoney(Number(factorValues.sum_insured ?? 0));
    const taxAmount = chargeSummary.total_charge_amount;
    const premiumIncludingTax = chargeSummary.premium_including_charges;

    // Rate-book-scoped rounding is applied ONLY at this final step — every
    // earlier intermediate figure above keeps using the global roundMoney()
    // HALF_UP-to-2dp policy unchanged.
    const finalPayablePremium = roundToIncrement(
      toDecimal(premiumIncludingTax),
      rateBook?.rounding_increment ?? '1',
      rateBook?.rounding_mode ?? PricingRoundingMode.HALF_UP,
    ).toNumber();

    return {
      client_reference: input.client_reference ?? null,
      risk_id: risk.id,
      risk_code: risk.risk_code,
      risk_name: risk.risk_name,
      rate_book_id: matchingRule.rate_book_id ?? null,
      rate_book_code: matchingRule.rate_book?.code ?? null,
      rate_book_version: matchingRule.rate_book?.version ?? null,
      rule_id: matchingRule.id,
      rule_name: matchingRule.rule_name,
      rule_version: matchingRule.rule_version ?? null,
      sum_insured: sumInsured,
      rate_type: effectiveRule.rate_type,
      percentage_rate: breakdown.percentage_rate,
      base_premium: breakdown.base_premium,
      per_unit_factor_code: breakdown.per_unit_factor_code,
      per_unit_value: breakdown.per_unit_value,
      per_unit_amount: breakdown.per_unit_amount,
      per_unit_premium: breakdown.per_unit_premium,
      fixed_amount: breakdown.fixed_amount,
      minimum_amount: breakdown.minimum_amount,
      gross_premium: breakdown.gross_premium,
      final_premium: breakdown.final_premium,
      minimum_applied: breakdown.minimum_applied,
      discount_control: discountControl,
      loading_control: loadingControl,
      charges: chargeSummary.charges,
      total_charge_amount: chargeSummary.total_charge_amount,
      taxable_charge_amount: chargeSummary.taxable_charge_amount,
      non_taxable_charge_amount: chargeSummary.non_taxable_charge_amount,
      premium_including_charges: chargeSummary.premium_including_charges,
      factors: validationResult.normalized_factor_values,
      validation_errors: [],
      validation_warnings: validationResult.warnings.map(
        (warning) => warning.message,
      ),

      // Documented response contract (additive).
      premium_rate: breakdown.percentage_rate,
      premium_rate_percent: displayPercentageFromRate(
        breakdown.percentage_rate ?? 0,
      ),
      raw_premium: breakdown.raw_premium,
      sum_insured_equivalent: sumInsured,
      minimum_premium: breakdown.minimum_amount,
      minimum_premium_applied: breakdown.minimum_applied,
      maximum_premium: breakdown.maximum_amount,
      maximum_premium_applied: breakdown.maximum_applied,
      loading_rate: loadingRate,
      loading_amount: loadingAmount,
      loading_approval_required: loadingApprovalRequired,
      discount_type: discountType,
      discount_rate: discountRate,
      discount_amount: discountAmount,
      discount_approval_required: discountApprovalRequired,
      premium_before_discount: premiumBeforeDiscount,
      premium_after_discount: premiumAfterDiscount,
      premium_excluding_tax: premiumAfterDiscount,
      premium_excluding_tax_equivalent: premiumAfterDiscount,
      tax_rate: chargeSummary.charges[0]?.rate ?? null,
      tax_amount: taxAmount,
      total_tax_amount: taxAmount,
      premium_including_tax: premiumIncludingTax,
      premium_including_tax_equivalent: premiumIncludingTax,
      final_payable_premium: finalPayablePremium,

      // Pricing authority: raw context for PricingQuoteService's
      // immutable snapshot/hash — see pricing.types.ts for field docs.
      premium_after_minimum: breakdown.premium_after_minimum,
      base_addon_premium: baseAddonPremium,
      premium_before_loading: premiumBeforeLoading,
      proration_factor: prorationFactor,
      matched_rule_priority: matchingRule.priority,
      matched_rule_specificity_score: matchingRule.specificity_score,
      matched_rule_conditions: this.buildRuleConditionContexts(
        matchingRule.conditions ?? [],
      ),
      addon_results: this.buildAddonResultContexts(addonResults),
      rate_book_context: this.buildRateBookContext(rateBook),
    };
  }

  async calculateMultiRisk(
    companyId: string,
    input: PricingMultiRiskInput,
  ): Promise<MultiRiskPremiumResult> {
    this.pricingValidationService.assertMultiRiskRequest(input.risks);

    const settled = await Promise.all(
      input.risks.map(async (riskInput) => {
        try {
          const result = await this.calculateSingleRisk(companyId, {
            ...riskInput,
            effective_date: riskInput.effective_date ?? input.effective_date,
          });
          return { ok: true as const, result };
        } catch (error) {
          return {
            ok: false as const,
            failure: this.buildMultiRiskFailure(riskInput, error),
          };
        }
      }),
    );
    const results = settled
      .filter(
        (entry): entry is { ok: true; result: RiskPremiumResult } => entry.ok,
      )
      .map((entry) => entry.result);
    const failedRisks = settled
      .filter(
        (entry): entry is { ok: false; failure: MultiRiskPremiumFailure } =>
          !entry.ok,
      )
      .map((entry) => entry.failure);

    return {
      risks: results,
      failed_risks: failedRisks,
      grand_total: roundMoney(
        sumDecimals(results.map((result) => result.premium_including_charges)),
      ),
      successful_risk_count: results.length,
      failed_risk_count: failedRisks.length,
    };
  }

  async explainRisk(
    companyId: string,
    riskId: string,
  ): Promise<RiskRuleExplanation> {
    const risk = await this.pricingValidationService.requireActiveRisk(
      companyId,
      riskId,
    );
    const rules = await this.ratingRuleMatcherService.findActiveRules(
      companyId,
      riskId,
    );

    const topRule = rules[0];
    if (!topRule) {
      throw new NotFoundException(
        `No active rating rule found for risk ${riskId}`,
      );
    }

    const effectiveRule =
      this.ratingRuleMatcherService.resolveEffectiveRule(topRule);

    return this.premiumBreakdownService.buildRuleExplanation({
      risk,
      rule: effectiveRule,
      conditions: this.ratingRuleMatcherService.summarizeConditions(
        topRule.conditions ?? [],
      ),
      otherActiveRuleCount: rules.length - 1,
    });
  }

  private buildValidationFailurePayload(
    validationResult: PricingFactorValidationResult,
  ): PricingValidationFailurePayload {
    return {
      status: 'INCOMPLETE',
      calculation_allowed: false,
      message: 'Pricing factor validation failed',
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      validation_errors: validationResult.errors.map((error) => error.message),
      validation_warnings: validationResult.warnings.map(
        (warning) => warning.message,
      ),
    };
  }

  private requireRateBookIdForAddons(rateBookId: string | null): string {
    if (!rateBookId) {
      throw new BadRequestException(
        'Add-ons require a resolved rate book; none is configured for this risk.',
      );
    }
    return rateBookId;
  }

  private buildRuleConditionContexts(
    conditions: RiskRuleCondition[],
  ): RiskRuleConditionContext[] {
    return conditions.map((condition) => ({
      id: condition.id,
      factor_code: condition.factor_code,
      operator: condition.operator,
      value_from: condition.value_from,
      value_to: condition.value_to,
      logical_operator: condition.logical_operator,
    }));
  }

  private buildAddonResultContexts(
    addonResults: AddonPricingCalculationResult[],
  ): AddonPricingResultContext[] {
    return addonResults.map((entry) => ({
      rule_id: entry.rule.id,
      addon_definition_id: entry.rule.addon_definition_id,
      addon_code: entry.rule.addon_definition?.code ?? '',
      addon_name: entry.rule.addon_definition?.name ?? '',
      pricing_type: entry.rule.pricing_type,
      percentage_rate: entry.rule.percentage_rate,
      fixed_amount: entry.rule.fixed_amount,
      per_unit_amount: entry.rule.per_unit_amount,
      per_unit_factor_code: entry.rule.per_unit_factor_code,
      minimum_amount: entry.rule.minimum_amount,
      maximum_amount: entry.rule.maximum_amount,
      quantity: entry.quantity,
      sum_insured: entry.sumInsured,
      calculated_premium: roundMoney(entry.premium),
    }));
  }

  private buildRateBookContext(
    rateBook: PricingRateBook | null,
  ): PricingRateBookContext | null {
    if (!rateBook) {
      return null;
    }

    return {
      rate_book_id: rateBook.id,
      code: rateBook.code,
      version: rateBook.version,
      company_id: rateBook.company_id,
      product_id: rateBook.product_id,
      product_version_id: rateBook.product_version_id,
      product_definition_hash: rateBook.product_definition_hash,
      currency_code: rateBook.currency_code,
      effective_from: rateBook.effective_from,
      effective_to: rateBook.effective_to,
      rounding_mode: rateBook.rounding_mode,
      rounding_increment: rateBook.rounding_increment,
      proration_method: rateBook.proration_method,
      calculation_version: rateBook.calculation_version,
      definition_hash: rateBook.definition_hash,
    };
  }

  private buildAdjustmentControl(
    rule: {
      max_discount_rate?: number | null;
      max_discount_amount?: number | null;
      discount_approval_threshold_rate?: number | null;
      discount_approval_threshold_amount?: number | null;
      max_loading_rate?: number | null;
      max_loading_amount?: number | null;
      loading_approval_threshold_rate?: number | null;
      loading_approval_threshold_amount?: number | null;
      adjustment_effective_from?: string | null;
      adjustment_effective_to?: string | null;
    },
    kind: 'discount' | 'loading',
  ): PricingAdjustmentControl {
    if (kind === 'discount') {
      return {
        max_rate: rule.max_discount_rate ?? null,
        max_amount: rule.max_discount_amount ?? null,
        approval_threshold_rate: rule.discount_approval_threshold_rate ?? null,
        approval_threshold_amount:
          rule.discount_approval_threshold_amount ?? null,
        effective_from: rule.adjustment_effective_from ?? null,
        effective_to: rule.adjustment_effective_to ?? null,
      };
    }

    return {
      max_rate: rule.max_loading_rate ?? null,
      max_amount: rule.max_loading_amount ?? null,
      approval_threshold_rate: rule.loading_approval_threshold_rate ?? null,
      approval_threshold_amount: rule.loading_approval_threshold_amount ?? null,
      effective_from: rule.adjustment_effective_from ?? null,
      effective_to: rule.adjustment_effective_to ?? null,
    };
  }

  private resolveAdjustmentType(
    input?: PricingAdjustmentRequestInput | null,
  ): PricingAdjustmentType {
    if (!input) return 'NONE';
    if (typeof input.rate === 'number' && input.rate > 0) return 'PERCENTAGE';
    if (typeof input.fixed_amount === 'number' && input.fixed_amount > 0) {
      return 'FIXED';
    }
    return 'NONE';
  }

  private computeAdjustmentAmount(
    base: number,
    input?: PricingAdjustmentRequestInput | null,
  ): number {
    if (!input) return 0;
    if (typeof input.rate === 'number' && input.rate > 0) {
      return roundMoney(applyRate(base, input.rate));
    }
    if (typeof input.fixed_amount === 'number' && input.fixed_amount > 0) {
      return roundMoney(input.fixed_amount);
    }
    return 0;
  }

  /**
   * A live calculation preview never rejects an over-limit discount/loading
   * outright — it flags approval_required so the frontend can surface it,
   * while actual enforcement happens later at the quotation-level
   * request/approve workflow (see quotations.service.ts).
   */
  private isAdjustmentApprovalRequired(
    control: PricingAdjustmentControl,
    rate: number | null,
    amount: number,
  ): boolean {
    if (amount <= 0) return false;
    if (control.max_rate !== null && rate !== null && rate > control.max_rate) {
      return true;
    }
    if (control.max_amount !== null && amount > control.max_amount) {
      return true;
    }
    if (
      control.approval_threshold_rate !== null &&
      rate !== null &&
      rate > control.approval_threshold_rate
    ) {
      return true;
    }
    if (
      control.approval_threshold_amount !== null &&
      amount > control.approval_threshold_amount
    ) {
      return true;
    }
    return false;
  }

  private buildMultiRiskFailure(
    input: PricingSingleRiskInput,
    error: unknown,
  ): MultiRiskPremiumFailure {
    const details = this.toFailureDetails(error);
    const response = details && typeof details === 'object' ? details : null;
    const validationErrors = this.extractValidationMessages(
      response?.validation_errors,
      response?.errors,
    );
    const validationWarnings = this.extractValidationMessages(
      response?.validation_warnings,
      response?.warnings,
    );
    const message = this.resolveFailureMessage(error, response);
    const status = response?.status === 'INCOMPLETE' ? 'INCOMPLETE' : 'FAILED';

    return {
      client_reference: input.client_reference ?? null,
      risk_id: input.risk_id ?? null,
      status,
      message,
      validation_errors: validationErrors,
      validation_warnings: validationWarnings,
      details: response,
    };
  }

  private toFailureDetails(error: unknown): Record<string, unknown> | null {
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object'
    ) {
      return error.response as Record<string, unknown>;
    }

    return null;
  }

  private resolveFailureMessage(
    error: unknown,
    response: Record<string, unknown> | null,
  ): string {
    const responseMessage = response?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
    }
    if (
      Array.isArray(responseMessage) &&
      responseMessage.every((value) => typeof value === 'string')
    ) {
      return responseMessage.join(', ');
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Pricing calculation failed';
  }

  private extractValidationMessages(
    direct: unknown,
    issues: unknown,
  ): string[] {
    if (
      Array.isArray(direct) &&
      direct.every((value) => typeof value === 'string')
    ) {
      return direct;
    }

    if (!Array.isArray(issues)) {
      return [];
    }

    return issues
      .map((issue) => {
        if (
          issue &&
          typeof issue === 'object' &&
          'message' in issue &&
          typeof issue.message === 'string'
        ) {
          return issue.message;
        }
        return null;
      })
      .filter((message): message is string => !!message);
  }
}
