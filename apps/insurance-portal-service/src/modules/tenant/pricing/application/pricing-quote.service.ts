import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import {
  PricingQuote,
  PricingQuoteScope,
  PricingQuoteStatus,
} from '../entities/pricing-quote.entity';
import { PricingEngineService } from './pricing-engine.service';
import { QuotationRecalculationService } from './quotation-recalculation.service';
import type {
  MultiRiskPremiumResult,
  PersistedMultiRiskPremiumResult,
  PersistedRiskPremiumResult,
  PricingMultiRiskInput,
  PricingQuoteSnapshot,
  PricingSingleRiskInput,
  RiskPremiumResult,
  StoredPricingQuote,
} from '../domain/pricing.types';

@Injectable()
export class PricingQuoteService {
  private readonly defaultExpiryHours = 24;

  constructor(
    private readonly pricingEngineService: PricingEngineService,
    private readonly quotationRecalculationService: QuotationRecalculationService,
    private readonly identifierGeneratorService: IdentifierGeneratorService,

    @InjectRepository(PricingQuote)
    private readonly pricingQuoteRepository: Repository<PricingQuote>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

  async calculateSingleRiskQuote(
    companyId: string,
    input: PricingSingleRiskInput,
    calculatedBy: string | null,
  ): Promise<PersistedRiskPremiumResult> {
    const result = await this.pricingEngineService.calculateSingleRisk(
      companyId,
      input,
    );
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
      },
    );

    return {
      ...result,
      pricing_quote_id: snapshot.pricing_quote_id,
      pricing_status: snapshot.pricing_status,
      calculated_at: snapshot.calculated_at,
      expires_at: snapshot.expires_at,
      input_signature: snapshot.input_signature,
      quotation_type: snapshot.quotation_type,
      currency_code: snapshot.currency_code,
    };
  }

  async calculateMultiRiskQuote(
    companyId: string,
    input: PricingMultiRiskInput,
    calculatedBy: string | null,
  ): Promise<PersistedMultiRiskPremiumResult> {
    const result = await this.pricingEngineService.calculateMultiRisk(
      companyId,
      input,
    );
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
      },
    );

    return {
      ...result,
      pricing_quote_id: snapshot.pricing_quote_id,
      pricing_status: snapshot.pricing_status,
      calculated_at: snapshot.calculated_at,
      expires_at: snapshot.expires_at,
      input_signature: snapshot.input_signature,
      quotation_type: snapshot.quotation_type,
      currency_code: snapshot.currency_code,
    };
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

  private async persistQuoteSnapshot(
    companyId: string,
    quoteScope: PricingQuoteScope,
    input: PricingSingleRiskInput | PricingMultiRiskInput,
    result: RiskPremiumResult | MultiRiskPremiumResult,
    calculatedBy: string | null,
    contextPayload: Record<string, unknown> | null,
  ): Promise<PricingQuoteSnapshot<RiskPremiumResult | MultiRiskPremiumResult>> {
    const calculatedAt = new Date();
    const expiresAt = new Date(
      calculatedAt.getTime() + this.defaultExpiryHours * 60 * 60 * 1000,
    );
    const inputSignature =
      this.quotationRecalculationService.createInputSignature(input);
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
      minimum_premium_adjustment:
        this.resolveMinimumPremiumAdjustment(result),
      gross_premium: this.resolveGrossPremium(result),
      final_premium: this.resolveFinalPremium(result),
      expires_at: expiresAt,
      calculated_at: calculatedAt,
      input_signature: inputSignature,
      input_payload: this.toJsonObject(input),
      factor_payload: this.resolveFactorPayload(input, result),
      result_payload: this.toJsonObject(result),
      warning_messages: this.collectWarnings(result),
      context_payload: {
        ...(contextPayload ?? {}),
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
      result,
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

  private resolveBasePremium(result: RiskPremiumResult | MultiRiskPremiumResult) {
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
}
