import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  roundMoney,
  roundRate,
  sumDecimals,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { In, Repository } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type {
  AddonPricingRuleSnapshot,
  PricingAdjustmentSnapshot,
  PricingRateBookSnapshot,
  PricingResultSnapshot,
  PricingRuleSnapshot,
} from '@insurance-max/contracts';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { ExchangeRateGovernanceService } from './exchange-rate-governance.service';
import {
  PricingQuote,
  PricingQuoteScope,
  PricingQuoteStatus,
} from '../entities/pricing-quote.entity';
import { PricingEngineService } from './pricing-engine.service';
import { QuotationRecalculationService } from './quotation-recalculation.service';
import { PricingRuntimeCacheService } from './pricing-runtime-cache.service';
import type {
  MultiRiskPremiumResult,
  PersistedMultiRiskPremiumResult,
  PersistedRiskPremiumResult,
  PricingBreakdownChargeLine,
  PricingBreakdownItem,
  PricingBreakdownMessage,
  PricingBreakdownRateBookSummary,
  PricingBreakdownStatus,
  PricingPremiumBreakdown,
  PricingMultiRiskInput,
  PricingQuoteSnapshot,
  PricingSingleRiskInput,
  RiskPremiumResult,
  StoredPricingQuote,
} from '../domain/pricing.types';

interface BuiltPricingSnapshot {
  rateBookSnapshot: PricingRateBookSnapshot;
  resultSnapshot: PricingResultSnapshot;
  resultHash: string;
}

@Injectable()
export class PricingQuoteService {
  private readonly defaultExpiryHours = 24;
  private readonly inFlightCalculations = new Map<
    string,
    Promise<PersistedRiskPremiumResult | PersistedMultiRiskPremiumResult>
  >();

  constructor(
    private readonly pricingEngineService: PricingEngineService,
    private readonly quotationRecalculationService: QuotationRecalculationService,
    private readonly identifierGeneratorService: IdentifierGeneratorService,
    private readonly exchangeRateGovernanceService: ExchangeRateGovernanceService,
    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
    private readonly productDefinitionHashService: ProductDefinitionHashService,

    @InjectRepository(PricingQuote)
    private readonly pricingQuoteRepository: Repository<PricingQuote>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

  async calculateSingleRiskQuote(
    companyId: string,
    input: PricingSingleRiskInput,
    calculatedBy: string | null,
    user?: Pick<AuthenticatedUser, 'id' | 'permissions'> | null,
  ): Promise<PersistedRiskPremiumResult> {
    const exchangeRateSnapshot =
      await this.exchangeRateGovernanceService.resolveSnapshot(
        companyId,
        {
          quotation_currency_code: input.currency_code ?? null,
          exchange_rate: input.exchange_rate ?? null,
          effective_date: input.effective_date ?? null,
        },
        user,
      );
    const inputSignature =
      this.quotationRecalculationService.createInputSignature(input);
    const exchangeRateSignature =
      this.quotationRecalculationService.createInputSignature(
        exchangeRateSnapshot ?? null,
      );
    const runtimeConfigurationSignature =
      await this.pricingRuntimeCacheService.getConfigurationSignature(
        companyId,
        ['product', 'rate', 'tax'],
      );

    return this.runCoalescedCalculation(
      this.buildCalculationKey(
        companyId,
        PricingQuoteScope.SINGLE_RISK,
        inputSignature,
        exchangeRateSignature,
        runtimeConfigurationSignature,
      ),
      async () => {
        const reusable = await this.findReusableQuoteSnapshot(
          companyId,
          PricingQuoteScope.SINGLE_RISK,
          inputSignature,
          exchangeRateSignature,
          runtimeConfigurationSignature,
        );
        if (reusable) {
          return this.mapPersistedQuote(reusable) as PersistedRiskPremiumResult;
        }

        const engineResult =
          await this.pricingEngineService.calculateSingleRisk(companyId, input);
        const result: RiskPremiumResult = this.applyExchangeRateEquivalents({
          ...engineResult,
          exchange_rate_snapshot: exchangeRateSnapshot,
        });
        const snapshot = await this.persistQuoteSnapshot(
          companyId,
          PricingQuoteScope.SINGLE_RISK,
          input,
          result,
          calculatedBy,
          {
            company_user_id: null,
            branch_id: null,
            department_id: null,
            exchange_rate_snapshot: exchangeRateSnapshot,
            exchange_rate_signature: exchangeRateSignature,
            runtime_configuration_signature: runtimeConfigurationSignature,
          },
          inputSignature,
        );
        return this.toPersistedResult(snapshot) as PersistedRiskPremiumResult;
      },
    );
  }

  async calculateMultiRiskQuote(
    companyId: string,
    input: PricingMultiRiskInput,
    calculatedBy: string | null,
    user?: Pick<AuthenticatedUser, 'id' | 'permissions'> | null,
  ): Promise<PersistedMultiRiskPremiumResult> {
    const exchangeRateSnapshot =
      await this.exchangeRateGovernanceService.resolveSnapshot(
        companyId,
        {
          quotation_currency_code: input.currency_code ?? null,
          exchange_rate: input.exchange_rate ?? null,
          effective_date: input.effective_date ?? null,
        },
        user,
      );
    const inputSignature =
      this.quotationRecalculationService.createInputSignature(input);
    const exchangeRateSignature =
      this.quotationRecalculationService.createInputSignature(
        exchangeRateSnapshot ?? null,
      );
    const runtimeConfigurationSignature =
      await this.pricingRuntimeCacheService.getConfigurationSignature(
        companyId,
        ['product', 'rate', 'tax'],
      );

    return this.runCoalescedCalculation(
      this.buildCalculationKey(
        companyId,
        PricingQuoteScope.MULTI_RISK,
        inputSignature,
        exchangeRateSignature,
        runtimeConfigurationSignature,
      ),
      async () => {
        const reusable = await this.findReusableQuoteSnapshot(
          companyId,
          PricingQuoteScope.MULTI_RISK,
          inputSignature,
          exchangeRateSignature,
          runtimeConfigurationSignature,
        );
        if (reusable) {
          return this.mapPersistedQuote(
            reusable,
          ) as PersistedMultiRiskPremiumResult;
        }

        const engineResult = await this.pricingEngineService.calculateMultiRisk(
          companyId,
          input,
        );
        const result: MultiRiskPremiumResult = {
          ...engineResult,
          risks: engineResult.risks.map((risk) =>
            this.applyExchangeRateEquivalents({
              ...risk,
              exchange_rate_snapshot: exchangeRateSnapshot,
            }),
          ),
        };
        const snapshot = await this.persistQuoteSnapshot(
          companyId,
          PricingQuoteScope.MULTI_RISK,
          input,
          result,
          calculatedBy,
          {
            company_user_id: input.company_user_id ?? null,
            branch_id: input.branch_id ?? null,
            department_id: input.department_id ?? null,
            exchange_rate_snapshot: exchangeRateSnapshot,
            exchange_rate_signature: exchangeRateSignature,
            runtime_configuration_signature: runtimeConfigurationSignature,
          },
          inputSignature,
        );
        return this.toPersistedResult(
          snapshot,
        ) as PersistedMultiRiskPremiumResult;
      },
    );
  }

  async findStoredQuote(
    companyId: string,
    pricingQuoteId: string,
  ): Promise<StoredPricingQuote> {
    const quote = await this.pricingQuoteRepository.findOne({
      where: {
        company_id: companyId,
        pricing_quote_id: pricingQuoteId,
      },
    });
    if (!quote) {
      throw new NotFoundException('Pricing quote not found');
    }

    return {
      pricing_quote_id: quote.pricing_quote_id,
      pricing_status: quote.calculation_status,
      quote_scope: quote.quote_scope,
      calculated_at: quote.calculated_at.toISOString(),
      expires_at: quote.expires_at.toISOString(),
      input_signature: quote.input_signature,
      quotation_type: quote.quotation_type,
      currency_code: quote.currency_code,
      product_id: quote.product_id,
      risk_id: quote.risk_id,
      rate_book_id: quote.rate_book_id,
      rate_book_version: quote.rate_book_version,
      matched_rule_id: quote.matched_rule_id,
      matched_rule_version: quote.matched_rule_version,
      base_premium: Number(quote.base_premium),
      minimum_premium_adjustment: Number(quote.minimum_premium_adjustment),
      gross_premium: Number(quote.gross_premium),
      final_premium: Number(quote.final_premium),
      input_payload: quote.input_payload,
      factor_payload: quote.factor_payload,
      result_payload: quote.result_payload,
      warning_messages: quote.warning_messages ?? [],
      context_payload: quote.context_payload,
    };
  }

  /**
   * The engine computes *_equivalent fields as equal to their plain
   * counterpart because it has no exchange-rate context. Once the snapshot
   * is resolved here, recompute the true base-currency equivalents.
   */
  private applyExchangeRateEquivalents(
    result: RiskPremiumResult,
  ): RiskPremiumResult {
    const rate = result.exchange_rate_snapshot?.exchange_rate;
    if (!rate || rate === 1) {
      return result;
    }

    return {
      ...result,
      sum_insured_equivalent: roundMoney(result.sum_insured * rate),
      premium_excluding_tax_equivalent: roundMoney(
        result.premium_excluding_tax * rate,
      ),
      premium_including_tax_equivalent: roundMoney(
        result.premium_including_tax * rate,
      ),
    };
  }

  private async persistQuoteSnapshot(
    companyId: string,
    quoteScope: PricingQuoteScope,
    input: PricingSingleRiskInput | PricingMultiRiskInput,
    result: RiskPremiumResult | MultiRiskPremiumResult,
    calculatedBy: string | null,
    contextPayload: Record<string, unknown> | null,
    inputSignature: string,
  ): Promise<PricingQuoteSnapshot<RiskPremiumResult | MultiRiskPremiumResult>> {
    const calculatedAt = new Date();
    const expiresAt = new Date(
      calculatedAt.getTime() + this.defaultExpiryHours * 60 * 60 * 1000,
    );
    const { pricingQuoteId, sequenceNo } =
      await this.identifierGeneratorService.generatePricingQuoteId();
    const riskIds = this.collectRiskIds(result);
    const risks =
      riskIds.length > 0
        ? await this.riskRepository.find({
            where: {
              company_id: companyId,
              id: In(riskIds),
            },
          })
        : [];
    const productIds = [...new Set(risks.map((risk) => risk.product_id))];
    const resolvedProductId = productIds.length === 1 ? productIds[0] : null;
    const singleResult = this.isSingleRiskResult(result) ? result : null;
    const currencyCode =
      (this.isSingleRiskInput(input)
        ? input.currency_code
        : input.currency_code) ?? null;
    const quotationType =
      (this.isSingleRiskInput(input)
        ? input.quotation_type
        : input.quotation_type) ?? null;
    const enrichedResult = this.attachPremiumBreakdown(result, {
      pricing_quote_id: pricingQuoteId,
      currency_code: currencyCode,
      expires_at: expiresAt.toISOString(),
    });

    const pricingSnapshot = singleResult
      ? this.buildPricingSnapshot(
          pricingQuoteId,
          singleResult,
          calculatedAt,
          expiresAt,
          inputSignature,
          currencyCode,
        )
      : null;

    const persisted = this.pricingQuoteRepository.create({
      company_id: companyId,
      pricing_quote_id: pricingQuoteId,
      sequence_no: String(sequenceNo),
      quote_scope: quoteScope,
      calculation_status: PricingQuoteStatus.CALCULATED,
      calculated_by: calculatedBy,
      product_id: resolvedProductId,
      risk_id: singleResult?.risk_id ?? null,
      quotation_type: quotationType,
      currency_code: currencyCode,
      rate_book_id: singleResult?.rate_book_id ?? null,
      rate_book_version: singleResult?.rate_book_version ?? null,
      matched_rule_id: singleResult?.rule_id ?? null,
      matched_rule_version: singleResult?.rule_version ?? null,
      base_premium: this.resolveBasePremium(result),
      minimum_premium_adjustment: this.resolveMinimumPremiumAdjustment(result),
      maximum_premium_adjustment: this.resolveMaximumPremiumAdjustment(result),
      gross_premium: this.resolveGrossPremium(result),
      final_premium: this.resolveFinalPremium(result),
      expires_at: expiresAt,
      calculated_at: calculatedAt,
      input_signature: inputSignature,
      product_version_id:
        singleResult?.rate_book_context?.product_version_id ?? null,
      product_definition_hash:
        singleResult?.rate_book_context?.product_definition_hash ?? null,
      rate_book_definition_hash:
        singleResult?.rate_book_context?.definition_hash ?? null,
      result_hash: pricingSnapshot?.resultHash ?? null,
      rate_book_snapshot: pricingSnapshot
        ? (pricingSnapshot.rateBookSnapshot as unknown as Record<
            string,
            unknown
          >)
        : null,
      pricing_result_snapshot: pricingSnapshot
        ? (pricingSnapshot.resultSnapshot as unknown as Record<string, unknown>)
        : null,
      input_payload: this.toJsonObject(input),
      factor_payload: this.resolveFactorPayload(input, enrichedResult),
      result_payload: this.toJsonObject(enrichedResult),
      warning_messages: this.collectWarnings(enrichedResult),
      context_payload: {
        ...(contextPayload ?? {}),
        pricing_trace_id: pricingQuoteId,
        risk_ids: riskIds,
        product_ids: productIds,
        rate_book_ids: this.collectRateBookIds(result),
        matched_rule_ids: this.collectMatchedRuleIds(result),
        quote_scope: quoteScope,
      },
    });

    await this.pricingQuoteRepository.save(persisted);

    return {
      pricing_quote_id: pricingQuoteId,
      pricing_status: PricingQuoteStatus.CALCULATED,
      calculated_at: calculatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      input_signature: inputSignature,
      quotation_type: quotationType,
      currency_code: currencyCode,
      result: enrichedResult,
    };
  }

  private async runCoalescedCalculation<
    T extends PersistedRiskPremiumResult | PersistedMultiRiskPremiumResult,
  >(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.inFlightCalculations.get(key) as
      | Promise<T>
      | undefined;
    if (existing) {
      return existing;
    }

    const pending = loader();
    this.inFlightCalculations.set(key, pending);

    try {
      return await pending;
    } finally {
      this.inFlightCalculations.delete(key);
    }
  }

  private buildCalculationKey(
    companyId: string,
    quoteScope: PricingQuoteScope,
    inputSignature: string,
    exchangeRateSignature: string,
    runtimeConfigurationSignature: string,
  ): string {
    return [
      companyId,
      quoteScope,
      inputSignature,
      exchangeRateSignature,
      runtimeConfigurationSignature,
    ].join(':');
  }

  private async findReusableQuoteSnapshot(
    companyId: string,
    quoteScope: PricingQuoteScope,
    inputSignature: string,
    exchangeRateSignature: string,
    runtimeConfigurationSignature: string,
  ): Promise<PricingQuote | null> {
    const candidates = await this.pricingQuoteRepository.find({
      where: {
        company_id: companyId,
        quote_scope: quoteScope,
        calculation_status: PricingQuoteStatus.CALCULATED,
        input_signature: inputSignature,
      },
      order: {
        calculated_at: 'DESC',
      },
      take: 5,
    });

    const now = Date.now();

    return (
      candidates.find((candidate) => {
        if (candidate.expires_at.getTime() <= now) {
          return false;
        }

        const context = candidate.context_payload;
        return (
          context?.exchange_rate_signature === exchangeRateSignature &&
          context?.runtime_configuration_signature ===
            runtimeConfigurationSignature
        );
      }) ?? null
    );
  }

  private mapPersistedQuote(
    quote: PricingQuote,
  ): PersistedRiskPremiumResult | PersistedMultiRiskPremiumResult {
    const result = quote.result_payload as unknown as
      | RiskPremiumResult
      | MultiRiskPremiumResult;

    return {
      ...result,
      pricing_quote_id: quote.pricing_quote_id,
      pricing_status: quote.calculation_status,
      calculated_at: quote.calculated_at.toISOString(),
      expires_at: quote.expires_at.toISOString(),
      input_signature: quote.input_signature,
      quotation_type: quote.quotation_type,
      currency_code: quote.currency_code,
    };
  }

  private toPersistedResult(
    snapshot: PricingQuoteSnapshot<RiskPremiumResult | MultiRiskPremiumResult>,
  ): PersistedRiskPremiumResult | PersistedMultiRiskPremiumResult {
    return {
      ...snapshot.result,
      pricing_quote_id: snapshot.pricing_quote_id,
      pricing_status: snapshot.pricing_status,
      calculated_at: snapshot.calculated_at,
      expires_at: snapshot.expires_at,
      input_signature: snapshot.input_signature,
      quotation_type: snapshot.quotation_type,
      currency_code: snapshot.currency_code,
    };
  }

  private isSingleRiskResult(
    value: RiskPremiumResult | MultiRiskPremiumResult,
  ): value is RiskPremiumResult {
    return !('risks' in value);
  }

  private isSingleRiskInput(
    value: PricingSingleRiskInput | PricingMultiRiskInput,
  ): value is PricingSingleRiskInput {
    return !('risks' in value);
  }

  private collectRiskIds(result: RiskPremiumResult | MultiRiskPremiumResult) {
    if (this.isSingleRiskResult(result)) {
      return [result.risk_id];
    }

    return result.risks.map((risk) => risk.risk_id);
  }

  private collectWarnings(result: RiskPremiumResult | MultiRiskPremiumResult) {
    if (this.isSingleRiskResult(result)) {
      return result.validation_warnings;
    }

    return [
      ...result.risks.flatMap((risk) => risk.validation_warnings),
      ...result.failed_risks.flatMap((risk) => risk.validation_warnings),
    ];
  }

  private resolveFactorPayload(
    input: PricingSingleRiskInput | PricingMultiRiskInput,
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ): Record<string, unknown> | null {
    if (this.isSingleRiskInput(input) && this.isSingleRiskResult(result)) {
      return {
        risk_id: result.risk_id,
        factors: result.factors,
      };
    }

    if (!this.isSingleRiskInput(input) && !this.isSingleRiskResult(result)) {
      return {
        risks: result.risks.map((risk, index) => ({
          client_reference: risk.client_reference ?? null,
          risk_id: risk.risk_id,
          factors: risk.factors,
          requested_input: input.risks[index] ?? null,
        })),
        failed_risks: result.failed_risks,
      };
    }

    return null;
  }

  private resolveBasePremium(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ) {
    if (this.isSingleRiskResult(result)) {
      return result.base_premium;
    }

    return result.risks.reduce((sum, risk) => sum + risk.base_premium, 0);
  }

  private resolveMinimumPremiumAdjustment(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ) {
    if (this.isSingleRiskResult(result)) {
      return Math.max(0, result.final_premium - result.gross_premium);
    }

    return result.risks.reduce(
      (sum, risk) => sum + Math.max(0, risk.final_premium - risk.gross_premium),
      0,
    );
  }

  /**
   * The delta the maximum-premium ceiling subtracted, analogous to
   * resolveMinimumPremiumAdjustment above (which reports the delta the
   * minimum-premium floor added).
   */
  private resolveMaximumPremiumAdjustment(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ) {
    if (this.isSingleRiskResult(result)) {
      return Math.max(0, result.premium_after_minimum - result.final_premium);
    }

    return result.risks.reduce(
      (sum, risk) =>
        sum + Math.max(0, risk.premium_after_minimum - risk.final_premium),
      0,
    );
  }

  /**
   * Builds the immutable Phase 7 pricing-authority snapshot (rate book +
   * matched rule + evaluated add-ons + calculation result) and its content
   * hash, for persistence alongside the pricing quote. Only meaningful for a
   * single-risk quote resolved against a published rate book — returns null
   * for multi-risk quotes (no single rate book/rule to snapshot) and for
   * legacy risk-level rules with no associated rate book (rate_book_id IS
   * NULL), since PricingRateBookSnapshot requires a non-null rate book
   * identity.
   */
  private buildPricingSnapshot(
    pricingQuoteId: string,
    risk: RiskPremiumResult,
    calculatedAt: Date,
    expiresAt: Date,
    inputSignature: string,
    fallbackCurrencyCode: string | null,
  ): BuiltPricingSnapshot {
    const rateBookContext = risk.rate_book_context;

    const matchedRule: PricingRuleSnapshot = {
      ruleId: risk.rule_id,
      ruleName: risk.rule_name,
      ruleVersion: risk.rule_version ?? 0,
      riskId: risk.risk_id,
      riskCode: risk.risk_code,
      riskName: risk.risk_name,
      priority: risk.matched_rule_priority,
      specificityScore: risk.matched_rule_specificity_score,
      rateType: risk.rate_type,
      percentageRate: this.toNullableString(risk.percentage_rate),
      fixedAmount: this.toNullableString(risk.fixed_amount),
      perUnitAmount: this.toNullableString(risk.per_unit_amount),
      perUnitFactorCode: risk.per_unit_factor_code,
      minimumAmount: this.toNullableString(risk.minimum_amount),
      maximumAmount: this.toNullableString(risk.maximum_premium),
      maxDiscountRate: this.toNullableString(risk.discount_control.max_rate),
      maxDiscountAmount: this.toNullableString(
        risk.discount_control.max_amount,
      ),
      discountApprovalThresholdRate: this.toNullableString(
        risk.discount_control.approval_threshold_rate,
      ),
      discountApprovalThresholdAmount: this.toNullableString(
        risk.discount_control.approval_threshold_amount,
      ),
      maxLoadingRate: this.toNullableString(risk.loading_control.max_rate),
      maxLoadingAmount: this.toNullableString(risk.loading_control.max_amount),
      loadingApprovalThresholdRate: this.toNullableString(
        risk.loading_control.approval_threshold_rate,
      ),
      loadingApprovalThresholdAmount: this.toNullableString(
        risk.loading_control.approval_threshold_amount,
      ),
      conditions: risk.matched_rule_conditions.map((condition) => ({
        id: condition.id,
        factorCode: condition.factor_code,
        operator: condition.operator,
        valueFrom: condition.value_from,
        valueTo: condition.value_to,
        logicalOperator: condition.logical_operator,
      })),
    };

    const addons: AddonPricingRuleSnapshot[] = risk.addon_results.map(
      (addon) => ({
        ruleId: addon.rule_id,
        addonDefinitionId: addon.addon_definition_id,
        addonCode: addon.addon_code,
        addonName: addon.addon_name,
        pricingType: addon.pricing_type,
        percentageRate: addon.percentage_rate,
        fixedAmount: addon.fixed_amount,
        perUnitAmount: addon.per_unit_amount,
        perUnitFactorCode: addon.per_unit_factor_code,
        minimumAmount: addon.minimum_amount,
        maximumAmount: addon.maximum_amount,
        quantity: addon.quantity,
        sumInsured:
          addon.sum_insured !== null ? String(addon.sum_insured) : null,
        calculatedPremium: String(addon.calculated_premium),
      }),
    );

    // Risks priced from a direct rating rule (e.g. TIRA base rates) have no
    // configured rate book: rateBookContext is legitimately null. The
    // signed result must still exist in that case, so fall back to empty/
    // default rate-book fields rather than dropping the snapshot (and with
    // it resultHash) entirely, which previously made pricing quotes for
    // every such risk unusable for TIRAMIS submission.
    const rateBookSnapshot: PricingRateBookSnapshot = rateBookContext
      ? {
          rateBookId: rateBookContext.rate_book_id,
          code: rateBookContext.code,
          version: rateBookContext.version,
          insurerCompanyId: rateBookContext.company_id,
          productId: rateBookContext.product_id,
          productVersionId: rateBookContext.product_version_id ?? '',
          productDefinitionHash:
            rateBookContext.product_definition_hash ?? '',
          currencyCode: rateBookContext.currency_code,
          effectiveFrom: rateBookContext.effective_from,
          effectiveTo: rateBookContext.effective_to,
          roundingMode: rateBookContext.rounding_mode,
          roundingIncrement: rateBookContext.rounding_increment,
          prorationMethod: rateBookContext.proration_method,
          calculationVersion: rateBookContext.calculation_version,
          definitionHash: rateBookContext.definition_hash,
          matchedRule,
          addons,
        }
      : {
          rateBookId: '',
          code: '',
          version: '',
          insurerCompanyId: '',
          productId: '',
          productVersionId: '',
          productDefinitionHash: '',
          currencyCode: fallbackCurrencyCode,
          effectiveFrom: calculatedAt.toISOString(),
          effectiveTo: null,
          roundingMode: 'HALF_UP',
          roundingIncrement: '0.01',
          prorationMethod: 'NONE',
          calculationVersion: 'DIRECT_RULE',
          definitionHash: null,
          matchedRule,
          addons,
        };

    const loadingType = this.resolveSnapshotAdjustmentType(
      risk.loading_rate,
      risk.loading_amount,
    );
    const loadingAdjustment: PricingAdjustmentSnapshot = {
      type: loadingType,
      requestedRate: this.toNullableString(risk.loading_rate),
      requestedAmount:
        risk.loading_rate === null && risk.loading_amount > 0
          ? String(risk.loading_amount)
          : null,
      appliedRate: this.toNullableString(risk.loading_rate),
      appliedAmount: String(risk.loading_amount),
      approvalRequired: risk.loading_approval_required,
    };

    const discountAdjustment: PricingAdjustmentSnapshot = {
      type: risk.discount_type,
      requestedRate: this.toNullableString(risk.discount_rate),
      requestedAmount:
        risk.discount_rate === null && risk.discount_amount > 0
          ? String(risk.discount_amount)
          : null,
      appliedRate: this.toNullableString(risk.discount_rate),
      appliedAmount: String(risk.discount_amount),
      approvalRequired: risk.discount_approval_required,
    };

    const resultWithoutHash: Omit<PricingResultSnapshot, 'resultHash'> = {
      pricingQuoteId,
      calculationVersion: rateBookSnapshot.calculationVersion,
      riskId: risk.risk_id,
      riskCode: risk.risk_code,
      riskName: risk.risk_name,
      currencyCode: rateBookSnapshot.currencyCode ?? fallbackCurrencyCode,
      sumInsured: String(risk.sum_insured),
      rawPremium: String(risk.raw_premium),
      premiumAfterMinimum: String(risk.premium_after_minimum),
      premiumAfterMaximum: String(risk.final_premium),
      baseAddonPremium: String(risk.base_addon_premium),
      premiumBeforeLoading: String(risk.premium_before_loading),
      loading: loadingAdjustment,
      premiumBeforeDiscount: String(risk.premium_before_discount),
      discount: discountAdjustment,
      premiumExcludingCharges: String(risk.premium_after_discount),
      totalChargeAmount: String(risk.total_charge_amount),
      finalPayablePremium: String(risk.final_payable_premium),
      minimumPremiumApplied: risk.minimum_premium_applied,
      maximumPremiumApplied: risk.maximum_premium_applied,
      prorationFactor: String(risk.proration_factor),
      rateBook: rateBookSnapshot,
      inputHash: inputSignature,
      calculatedAt: calculatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const resultHash =
      this.productDefinitionHashService.hashDefinition(resultWithoutHash);

    return {
      rateBookSnapshot,
      resultSnapshot: { ...resultWithoutHash, resultHash },
      resultHash,
    };
  }

  private resolveSnapshotAdjustmentType(
    rate: number | null,
    amount: number,
  ): 'NONE' | 'PERCENTAGE' | 'FIXED' {
    if (typeof rate === 'number' && rate > 0) return 'PERCENTAGE';
    if (amount > 0) return 'FIXED';
    return 'NONE';
  }

  private toNullableString(
    value: number | string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  }

  private resolveGrossPremium(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ) {
    if (this.isSingleRiskResult(result)) {
      return result.gross_premium;
    }

    return result.risks.reduce((sum, risk) => sum + risk.gross_premium, 0);
  }

  private resolveFinalPremium(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ) {
    if (this.isSingleRiskResult(result)) {
      return result.final_premium;
    }

    return result.grand_total;
  }

  private collectRateBookIds(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ): string[] {
    if (this.isSingleRiskResult(result)) {
      return result.rate_book_id ? [result.rate_book_id] : [];
    }

    return [
      ...new Set(
        result.risks
          .map((risk) => risk.rate_book_id)
          .filter((value): value is string => !!value),
      ),
    ];
  }

  private collectMatchedRuleIds(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ): string[] {
    if (this.isSingleRiskResult(result)) {
      return [result.rule_id];
    }

    return result.risks.map((risk) => risk.rule_id);
  }

  private toJsonObject(value: unknown): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private attachPremiumBreakdown(
    result: RiskPremiumResult | MultiRiskPremiumResult,
    metadata: {
      pricing_quote_id: string;
      currency_code: string | null;
      expires_at: string;
    },
  ): RiskPremiumResult | MultiRiskPremiumResult {
    return {
      ...result,
      premium_breakdown: this.buildPremiumBreakdown(result, metadata),
    };
  }

  private buildPremiumBreakdown(
    result: RiskPremiumResult | MultiRiskPremiumResult,
    metadata: {
      pricing_quote_id: string;
      currency_code: string | null;
      expires_at: string;
    },
  ): PricingPremiumBreakdown {
    const risks = this.isSingleRiskResult(result) ? [result] : result.risks;
    const items = risks.map((risk) => this.buildBreakdownItem(risk));
    const taxesTotal = roundMoney(
      sumDecimals(
        items.flatMap((item) => item.taxes.map((charge) => charge.amount)),
      ),
    );
    const otherChargesTotal = roundMoney(
      sumDecimals(
        items.flatMap((item) =>
          item.other_charges.map((charge) => charge.amount),
        ),
      ),
    );
    const payablePremium = this.isSingleRiskResult(result)
      ? (result.premium_including_charges ?? result.final_premium)
      : roundMoney(sumDecimals(items.map((item) => item.final_premium)));

    return {
      pricing_quote_id: metadata.pricing_quote_id,
      status: this.resolveBreakdownStatus(result),
      currency:
        metadata.currency_code ??
        risks[0]?.exchange_rate_snapshot?.quotation_currency_code ??
        null,
      rate_book: this.resolveBreakdownRateBook(risks),
      items,
      totals: {
        base_premium: roundMoney(
          sumDecimals(risks.map((risk) => risk.base_premium)),
        ),
        raw_premium: roundMoney(
          sumDecimals(items.map((item) => item.raw_premium)),
        ),
        loadings: 0,
        discounts: 0,
        premium_after_discount: roundMoney(
          sumDecimals(items.map((item) => item.premium_after_discount)),
        ),
        taxes: taxesTotal,
        other_charges: otherChargesTotal,
        payable_premium: payablePremium,
      },
      errors: this.collectBreakdownErrors(result),
      warnings: this.collectBreakdownWarnings(result),
      expires_at: metadata.expires_at,
    };
  }

  private buildBreakdownItem(risk: RiskPremiumResult): PricingBreakdownItem {
    const charges = risk.charges ?? [];
    const taxes = charges
      .filter((charge) => charge.charge_category === 'TAX')
      .map((charge) => this.toBreakdownChargeLine(charge));
    const otherCharges = charges
      .filter((charge) => charge.charge_category !== 'TAX')
      .map((charge) => this.toBreakdownChargeLine(charge));

    return {
      client_reference: risk.client_reference ?? null,
      risk_id: risk.risk_id,
      risk_code: risk.risk_code,
      risk_name: risk.risk_name,
      calculation_method: risk.rate_type,
      sum_insured: risk.sum_insured,
      rate: risk.percentage_rate,
      display_rate_percent: roundRate(Number(risk.percentage_rate ?? 0) * 100),
      raw_premium: risk.raw_premium,
      minimum_premium: risk.minimum_amount,
      minimum_applied: risk.minimum_applied,
      loadings: [],
      discounts: [],
      premium_after_discount: risk.premium_after_discount,
      taxes,
      other_charges: otherCharges,
      final_premium: risk.premium_including_charges ?? risk.final_premium,
      matched_rule: {
        rule_id: risk.rule_id,
        rule_name: risk.rule_name,
        rule_version: risk.rule_version,
      },
    };
  }

  private toBreakdownChargeLine(
    charge: RiskPremiumResult['charges'][number],
  ): PricingBreakdownChargeLine {
    return {
      charge_code: charge.charge_code,
      charge_name: charge.charge_name,
      charge_category: charge.charge_category,
      charge_scope: charge.charge_scope,
      charge_type: charge.charge_type,
      calculation_base: charge.calculation_base,
      base_amount: charge.base_amount,
      rate: charge.rate,
      amount: charge.computed_amount,
      is_taxable: charge.is_taxable,
    };
  }

  private resolveBreakdownStatus(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ): PricingBreakdownStatus {
    if (this.isSingleRiskResult(result)) {
      return result.validation_errors.length > 0 ? 'INCOMPLETE' : 'CALCULATED';
    }

    if (result.failed_risk_count === 0) {
      return 'CALCULATED';
    }

    if (result.successful_risk_count === 0) {
      return 'INCOMPLETE';
    }

    return 'PARTIAL';
  }

  private resolveBreakdownRateBook(
    risks: RiskPremiumResult[],
  ): PricingBreakdownRateBookSummary {
    return {
      code: this.pickSingleValue(
        risks.map((risk) => risk.rate_book_code ?? null),
      ),
      version: this.pickSingleValue(
        risks.map((risk) => risk.rate_book_version ?? null),
      ),
    };
  }

  private pickSingleValue(values: Array<string | null>): string | null {
    const distinct = [
      ...new Set(values.filter((value): value is string => !!value)),
    ];
    return distinct.length === 1 ? distinct[0] : null;
  }

  private collectBreakdownErrors(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ): PricingBreakdownMessage[] {
    if (this.isSingleRiskResult(result)) {
      return result.validation_errors.map((message) => ({
        client_reference: result.client_reference ?? null,
        risk_id: result.risk_id,
        risk_code: result.risk_code,
        message,
      }));
    }

    return result.failed_risks.flatMap((failure) => {
      const messages =
        failure.validation_errors.length > 0
          ? failure.validation_errors
          : [failure.message];

      return messages.map((message) => ({
        client_reference: failure.client_reference ?? null,
        risk_id: failure.risk_id,
        risk_code: null,
        message,
      }));
    });
  }

  private collectBreakdownWarnings(
    result: RiskPremiumResult | MultiRiskPremiumResult,
  ): PricingBreakdownMessage[] {
    if (this.isSingleRiskResult(result)) {
      return result.validation_warnings.map((message) => ({
        client_reference: result.client_reference ?? null,
        risk_id: result.risk_id,
        risk_code: result.risk_code,
        message,
      }));
    }

    return [
      ...result.risks.flatMap((risk) =>
        risk.validation_warnings.map((message) => ({
          client_reference: risk.client_reference ?? null,
          risk_id: risk.risk_id,
          risk_code: risk.risk_code,
          message,
        })),
      ),
      ...result.failed_risks.flatMap((failure) =>
        failure.validation_warnings.map((message) => ({
          client_reference: failure.client_reference ?? null,
          risk_id: failure.risk_id,
          risk_code: null,
          message,
        })),
      ),
    ];
  }
}
