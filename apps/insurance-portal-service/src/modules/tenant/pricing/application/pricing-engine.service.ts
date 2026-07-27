import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  roundMoney,
  sumDecimals,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { RatingFactorValidatorService } from '../infrastructure/rating-factor-validator.service';
import { RatingRuleMatcherService } from '../infrastructure/rating-rule-matcher.service';
import { PremiumBreakdownService } from '../infrastructure/premium-breakdown.service';
import { PricingChargeService } from './pricing-charge.service';
import { PricingValidationService } from './pricing-validation.service';
import type {
  MultiRiskPremiumFailure,
  MultiRiskPremiumResult,
  PricingAdjustmentControl,
  PricingMultiRiskInput,
  PricingSingleRiskInput,
  PricingFactorValidationResult,
  PricingValidationFailurePayload,
  RiskPremiumResult,
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
  ) {}

  async calculateSingleRisk(
    companyId: string,
    input: PricingSingleRiskInput,
  ): Promise<RiskPremiumResult> {
    const risk = await this.pricingValidationService.requireActiveRisk(
      companyId,
      input.risk_id,
    );

    const factorValues =
      this.ratingFactorValidatorService.normalizeInputFactors(input);
    const validationResult =
      await this.ratingFactorValidatorService.validateForRisk(
        companyId,
        input.risk_id,
        factorValues,
      );
    if (!validationResult.calculation_allowed) {
      throw new BadRequestException(
        this.buildValidationFailurePayload(validationResult),
      );
    }

    const matchingRule = await this.ratingRuleMatcherService.findFirstMatchingRule(
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
    const chargeSummary = await this.pricingChargeService.calculateCharges(
      companyId,
      {
        category_id: risk.product?.category_id ?? null,
        product_id: risk.product_id,
        risk_id: risk.id,
        effective_date: input.effective_date ?? null,
        basic_premium: breakdown.base_premium,
        net_premium: breakdown.final_premium,
        gross_premium: breakdown.gross_premium,
      },
    );

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
      sum_insured: roundMoney(Number(factorValues.sum_insured ?? 0)),
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
      discount_control: this.buildAdjustmentControl(matchingRule, 'discount'),
      loading_control: this.buildAdjustmentControl(matchingRule, 'loading'),
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
      .filter((entry): entry is { ok: true; result: RiskPremiumResult } => entry.ok)
      .map((entry) => entry.result);
    const failedRisks = settled
      .filter(
        (
          entry,
        ): entry is { ok: false; failure: MultiRiskPremiumFailure } => !entry.ok,
      )
      .map((entry) => entry.failure);

    return {
      risks: results,
      failed_risks: failedRisks,
      grand_total: roundMoney(
        sumDecimals(
          results.map((result) => result.premium_including_charges),
        ),
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
        approval_threshold_rate:
          rule.discount_approval_threshold_rate ?? null,
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
      approval_threshold_amount:
        rule.loading_approval_threshold_amount ?? null,
      effective_from: rule.adjustment_effective_from ?? null,
      effective_to: rule.adjustment_effective_to ?? null,
    };
  }

  private buildMultiRiskFailure(
    input: PricingSingleRiskInput,
    error: unknown,
  ): MultiRiskPremiumFailure {
    const details = this.toFailureDetails(error);
    const response =
      details && typeof details === 'object'
        ? (details as Record<string, unknown>)
        : null;
    const validationErrors = this.extractValidationMessages(
      response?.validation_errors,
      response?.errors,
    );
    const validationWarnings = this.extractValidationMessages(
      response?.validation_warnings,
      response?.warnings,
    );
    const message = this.resolveFailureMessage(error, response);
    const status =
      response?.status === 'INCOMPLETE' ? 'INCOMPLETE' : 'FAILED';

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
