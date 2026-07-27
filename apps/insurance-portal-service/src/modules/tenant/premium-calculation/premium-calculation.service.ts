import { Injectable } from '@nestjs/common';
import { AuditService } from '../../shared/audit/audit.service';
import { PricingEngineService } from '../pricing/application/pricing-engine.service';
import { PricingQuoteService } from '../pricing/application/pricing-quote.service';
import type {
  PersistedMultiRiskPremiumResult,
  PersistedRiskPremiumResult,
  RiskRuleExplanation,
  StoredPricingQuote,
} from '../pricing/domain/pricing.types';
import {
  CalculateMultiRiskPremiumDto,
  CalculateSingleRiskPremiumDto,
} from './dto/calculate-premium.dto';

@Injectable()
export class PremiumCalculationService {
  constructor(
    private readonly pricingQuoteService: PricingQuoteService,
    private readonly pricingEngineService: PricingEngineService,
    private readonly auditService: AuditService,
  ) {}

  async calculateSingleRisk(
    companyId: string,
    dto: CalculateSingleRiskPremiumDto,
    userId: string | null = null,
  ): Promise<PersistedRiskPremiumResult> {
    await this.auditService.log({
      userId: userId ?? undefined,
      companyId,
      action: 'PRICING_CALCULATION_REQUESTED',
      resource: 'pricing_quote',
      metadata: {
        scope: 'SINGLE_RISK',
        risk_id: dto.risk_id,
        client_reference: dto.client_reference ?? null,
        quotation_type: dto.quotation_type ?? null,
        currency_code: dto.currency_code ?? null,
      },
    });

    try {
      const result = await this.pricingQuoteService.calculateSingleRiskQuote(
        companyId,
        dto,
        userId,
      );

      await this.auditService.log({
        userId: userId ?? undefined,
        companyId,
        action: 'PRICING_CALCULATION_COMPLETED',
        resource: 'pricing_quote',
        resourceId: result.pricing_quote_id,
        metadata: {
          scope: 'SINGLE_RISK',
          risk_id: result.risk_id,
          pricing_quote_id: result.pricing_quote_id,
          final_premium: result.final_premium,
          rate_book_version: result.rate_book_version,
        },
      });

      return result;
    } catch (error) {
      await this.logCalculationFailure(companyId, userId, 'SINGLE_RISK', {
        risk_id: dto.risk_id,
        client_reference: dto.client_reference ?? null,
      }, error);
      throw error;
    }
  }

  async calculateMultiRisk(
    companyId: string,
    dto: CalculateMultiRiskPremiumDto,
    userId: string | null = null,
  ): Promise<PersistedMultiRiskPremiumResult> {
    await this.auditService.log({
      userId: userId ?? undefined,
      companyId,
      action: 'PRICING_CALCULATION_REQUESTED',
      resource: 'pricing_quote',
      metadata: {
        scope: 'MULTI_RISK',
        risk_count: dto.risks.length,
        quotation_type: dto.quotation_type ?? null,
        currency_code: dto.currency_code ?? null,
        product_code: dto.product_code ?? null,
        effective_date: dto.effective_date ?? null,
      },
    });

    try {
      const result = await this.pricingQuoteService.calculateMultiRiskQuote(
        companyId,
        dto,
        userId,
      );

      await this.auditService.log({
        userId: userId ?? undefined,
        companyId,
        action: 'PRICING_CALCULATION_COMPLETED',
        resource: 'pricing_quote',
        resourceId: result.pricing_quote_id,
        metadata: {
          scope: 'MULTI_RISK',
          pricing_quote_id: result.pricing_quote_id,
          successful_risk_count: result.successful_risk_count,
          failed_risk_count: result.failed_risk_count,
          grand_total: result.grand_total,
        },
      });

      return result;
    } catch (error) {
      await this.logCalculationFailure(companyId, userId, 'MULTI_RISK', {
        risk_count: dto.risks.length,
        product_code: dto.product_code ?? null,
        effective_date: dto.effective_date ?? null,
      }, error);
      throw error;
    }
  }

  /**
   * Resolves a risk's highest-priority active rating rule without requiring
   * sum_insured or factor values, and without running a calculation. Powers
   * the frontend's "show minimum premium the moment a risk is selected"
   * behavior, and doubles as a QA tool to inspect why a risk prices the way
   * it does without reverse-engineering the seed data.
   *
   * Deliberately does not attempt condition matching (rule conditions
   * reference factor values, which aren't known yet at this point) — this
   * mirrors the priority-only rule already used to populate the minimum on
   * the frontend, and just exposes the rule's active conditions for
   * visibility rather than evaluating them.
   */
  async explainRisk(
    companyId: string,
    riskId: string,
  ): Promise<RiskRuleExplanation> {
    return this.pricingEngineService.explainRisk(companyId, riskId);
  }

  async findStoredQuote(
    companyId: string,
    pricingQuoteId: string,
  ): Promise<StoredPricingQuote> {
    return this.pricingQuoteService.findStoredQuote(companyId, pricingQuoteId);
  }

  private async logCalculationFailure(
    companyId: string,
    userId: string | null,
    scope: 'SINGLE_RISK' | 'MULTI_RISK',
    metadata: Record<string, unknown>,
    error: unknown,
  ) {
    await this.auditService.log({
      userId: userId ?? undefined,
      companyId,
      action: 'PRICING_CALCULATION_FAILED',
      resource: 'pricing_quote',
      status: 'failure',
      metadata: {
        scope,
        ...metadata,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : { value: String(error) },
      },
    });
  }
}
