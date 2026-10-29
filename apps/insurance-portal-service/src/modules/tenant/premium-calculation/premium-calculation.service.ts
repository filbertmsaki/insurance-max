import { HttpException, Injectable } from '@nestjs/common';
import {
  roundMoney,
  sumDecimals,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { AuditService } from '../../shared/audit/audit.service';
import { PricingEngineService } from '../pricing/application/pricing-engine.service';
import { PricingQuoteService } from '../pricing/application/pricing-quote.service';
import type {
  FleetPremiumTotals,
  MultiRiskPremiumFailure,
  PersistedFleetPremiumResult,
  PersistedMultiRiskPremiumResult,
  PersistedRiskPremiumResult,
  RiskPremiumResult,
  RiskRuleExplanation,
  StoredPricingQuote,
} from '../pricing/domain/pricing.types';
import {
  CalculateFleetPremiumDto,
  CalculateMultiRiskPremiumDto,
  CalculateSingleRiskPremiumDto,
} from './dto/calculate-premium.dto';

const FLEET_PRICING_CONCURRENCY = 8;

function readErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response && 'message' in response) {
      const message = response.message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
  }
  return error instanceof Error ? error.message : 'Pricing calculation failed';
}

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
    user?: Pick<AuthenticatedUser, 'id' | 'permissions'> | null,
  ): Promise<PersistedRiskPremiumResult> {
    await this.auditService.log({
      userId: userId ?? undefined,
      companyId,
      action: 'PRICING_CALCULATION_REQUESTED',
      resource: 'pricing_quote',
      metadata: {
        scope: 'SINGLE_RISK',
        quotation_id: null,
        quotation_no: null,
        risk_id: dto.risk_id,
        action: 'PRICING_CALCULATION_REQUESTED',
        old_value: null,
        new_value: null,
        reason: 'Pricing calculation requested',
        correlation_id: dto.client_reference?.trim() || dto.risk_id,
        request_input: this.buildSingleRiskRequestInput(dto),
      },
    });

    try {
      const result = await this.pricingQuoteService.calculateSingleRiskQuote(
        companyId,
        dto,
        userId,
        user,
      );

      await this.auditService.log({
        userId: userId ?? undefined,
        companyId,
        action: 'PRICING_RULE_SELECTED',
        resource: 'pricing_quote',
        resourceId: result.pricing_quote_id,
        metadata: {
          scope: 'SINGLE_RISK',
          quotation_id: null,
          quotation_no: null,
          risk_id: result.risk_id,
          action: 'PRICING_RULE_SELECTED',
          old_value: null,
          new_value: this.buildRuleSelectionMetadata(result),
          reason: 'Pricing rule selected for premium calculation',
          correlation_id: result.pricing_quote_id,
        },
      });

      await this.auditService.log({
        userId: userId ?? undefined,
        companyId,
        action: 'PRICING_CALCULATION_COMPLETED',
        resource: 'pricing_quote',
        resourceId: result.pricing_quote_id,
        metadata: {
          scope: 'SINGLE_RISK',
          quotation_id: null,
          quotation_no: null,
          risk_id: result.risk_id,
          action: 'PRICING_CALCULATION_COMPLETED',
          old_value: null,
          new_value: this.buildCalculationResultMetadata(result),
          reason: 'Pricing calculation completed successfully',
          correlation_id: result.pricing_quote_id,
          request_input: this.buildSingleRiskRequestInput(dto),
        },
      });

      await this.logCurrencyConversion(
        companyId,
        userId,
        'SINGLE_RISK',
        result.pricing_quote_id,
        [result],
      );

      return result;
    } catch (error) {
      await this.logCalculationFailure(
        companyId,
        userId,
        'SINGLE_RISK',
        {
          quotation_id: null,
          quotation_no: null,
          risk_id: dto.risk_id,
          action: 'PRICING_CALCULATION_FAILED',
          old_value: null,
          new_value: null,
          reason: 'Pricing calculation failed',
          correlation_id: dto.client_reference?.trim() || dto.risk_id,
          request_input: this.buildSingleRiskRequestInput(dto),
        },
        error,
      );
      throw error;
    }
  }

  async calculateMultiRisk(
    companyId: string,
    dto: CalculateMultiRiskPremiumDto,
    userId: string | null = null,
    user?: Pick<AuthenticatedUser, 'id' | 'permissions'> | null,
  ): Promise<PersistedMultiRiskPremiumResult> {
    await this.auditService.log({
      userId: userId ?? undefined,
      companyId,
      action: 'PRICING_CALCULATION_REQUESTED',
      resource: 'pricing_quote',
      metadata: {
        scope: 'MULTI_RISK',
        quotation_id: null,
        quotation_no: null,
        risk_id: null,
        action: 'PRICING_CALCULATION_REQUESTED',
        old_value: null,
        new_value: null,
        reason: 'Pricing calculation requested',
        correlation_id:
          dto.product_code?.trim() ||
          dto.risks[0]?.client_reference?.trim() ||
          `MULTI_RISK:${dto.risks.length}`,
        request_input: this.buildMultiRiskRequestInput(dto),
      },
    });

    try {
      const result = await this.pricingQuoteService.calculateMultiRiskQuote(
        companyId,
        dto,
        userId,
        user,
      );

      await this.auditService.log({
        userId: userId ?? undefined,
        companyId,
        action: 'PRICING_RULE_SELECTED',
        resource: 'pricing_quote',
        resourceId: result.pricing_quote_id,
        metadata: {
          scope: 'MULTI_RISK',
          quotation_id: null,
          quotation_no: null,
          risk_id: null,
          action: 'PRICING_RULE_SELECTED',
          old_value: null,
          new_value: {
            rules: result.risks.map((risk) =>
              this.buildRuleSelectionMetadata(risk),
            ),
          },
          reason: 'Pricing rules selected for premium calculation',
          correlation_id: result.pricing_quote_id,
        },
      });

      await this.auditService.log({
        userId: userId ?? undefined,
        companyId,
        action: 'PRICING_CALCULATION_COMPLETED',
        resource: 'pricing_quote',
        resourceId: result.pricing_quote_id,
        metadata: {
          scope: 'MULTI_RISK',
          quotation_id: null,
          quotation_no: null,
          risk_id: null,
          action: 'PRICING_CALCULATION_COMPLETED',
          old_value: null,
          new_value: this.buildCalculationResultMetadata(result),
          reason: 'Pricing calculation completed successfully',
          correlation_id: result.pricing_quote_id,
          request_input: this.buildMultiRiskRequestInput(dto),
        },
      });

      await this.logCurrencyConversion(
        companyId,
        userId,
        'MULTI_RISK',
        result.pricing_quote_id,
        result.risks,
      );

      return result;
    } catch (error) {
      await this.logCalculationFailure(
        companyId,
        userId,
        'MULTI_RISK',
        {
          quotation_id: null,
          quotation_no: null,
          risk_id: null,
          action: 'PRICING_CALCULATION_FAILED',
          old_value: null,
          new_value: null,
          reason: 'Pricing calculation failed',
          correlation_id:
            dto.product_code?.trim() ||
            dto.risks[0]?.client_reference?.trim() ||
            `MULTI_RISK:${dto.risks.length}`,
          request_input: this.buildMultiRiskRequestInput(dto),
        },
        error,
      );
      throw error;
    }
  }

  /**
   * Motor fleet pricing: the fleet's single risk, discount and tax selection
   * is applied to every vehicle, each vehicle is rated on its own sum insured
   * and factors (one pricing quote per vehicle, re-verified at quotation
   * create), and the results are rolled up into fleet totals.
   */
  async calculateFleet(
    companyId: string,
    dto: CalculateFleetPremiumDto,
    userId: string | null = null,
    user?: Pick<AuthenticatedUser, 'id' | 'permissions'> | null,
  ): Promise<PersistedFleetPremiumResult> {
    const risks: PersistedRiskPremiumResult[] = [];
    const failedRisks: MultiRiskPremiumFailure[] = [];

    // Bounded concurrency keeps large fleets from flooding the database.
    for (
      let start = 0;
      start < dto.vehicles.length;
      start += FLEET_PRICING_CONCURRENCY
    ) {
      const batch = dto.vehicles.slice(
        start,
        start + FLEET_PRICING_CONCURRENCY,
      );
      const settled = await Promise.allSettled(
        batch.map((vehicle) =>
          this.calculateSingleRisk(
            companyId,
            {
              client_reference: vehicle.client_reference,
              risk_id: dto.risk_id,
              sum_insured: vehicle.sum_insured,
              factors: vehicle.factors ?? {},
              effective_date: dto.effective_date,
              cover_start_date: dto.cover_start_date,
              cover_end_date: dto.cover_end_date,
              quotation_type: dto.quotation_type,
              currency_code: dto.currency_code,
              exchange_rate: dto.exchange_rate,
              discount: dto.discount,
              tax_codes: dto.tax_codes,
            },
            userId,
            user,
          ),
        ),
      );
      settled.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
          risks.push(outcome.value);
          return;
        }
        const message = readErrorMessage(outcome.reason);
        failedRisks.push({
          client_reference: batch[index].client_reference,
          risk_id: dto.risk_id,
          status: 'FAILED',
          message,
          validation_errors: [message],
          validation_warnings: [],
          details: null,
        });
      });
    }

    const fleetTotals = buildFleetPremiumTotals(dto.vehicles.length, risks);
    return {
      risk_id: dto.risk_id,
      risks,
      failed_risks: failedRisks,
      successful_risk_count: risks.length,
      failed_risk_count: failedRisks.length,
      grand_total: fleetTotals.premium_including_tax,
      fleet_totals: fleetTotals,
    };
  }

  /**
   * Resolves a risk's highest-priority active rating rule without requiring
   * sum_insured or factor values, and without running a calculation. Powers
   * the frontend's "show minimum premium the moment a risk is selected"
   * behavior, and doubles as a QA tool to inspect why a risk prices the way
   * it does without reverse-engineering the seed data.
   *
   * Deliberately does not attempt condition matching (rule conditions
   * reference factor values, which aren't known yet at this point) - this
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

  private async logCurrencyConversion(
    companyId: string,
    userId: string | null,
    scope: 'SINGLE_RISK' | 'MULTI_RISK',
    pricingQuoteId: string,
    risks: RiskPremiumResult[],
  ) {
    const snapshots = risks
      .map((risk) => risk.exchange_rate_snapshot)
      .filter(
        (
          snapshot,
        ): snapshot is NonNullable<
          RiskPremiumResult['exchange_rate_snapshot']
        > => !!snapshot,
      );
    if (snapshots.length === 0) {
      return;
    }

    const distinctSnapshots = Array.from(
      new Set(
        snapshots.map((snapshot) =>
          JSON.stringify({
            quotation_currency_code: snapshot.quotation_currency_code,
            base_currency_code: snapshot.base_currency_code,
            exchange_rate: snapshot.exchange_rate,
            exchange_rate_date: snapshot.exchange_rate_date,
            exchange_rate_source: snapshot.exchange_rate_source,
            approval_required: snapshot.approval_required,
            approval_granted: snapshot.approval_granted,
          }),
        ),
      ),
    ).map((snapshot) => JSON.parse(snapshot) as Record<string, unknown>);

    await this.auditService.log({
      userId: userId ?? undefined,
      companyId,
      action: 'PRICING_CURRENCY_CONVERSION',
      resource: 'pricing_quote',
      resourceId: pricingQuoteId,
      metadata: {
        scope,
        quotation_id: null,
        quotation_no: null,
        risk_id: scope === 'SINGLE_RISK' ? (risks[0]?.risk_id ?? null) : null,
        action: 'PRICING_CURRENCY_CONVERSION',
        old_value: null,
        new_value: {
          snapshots: distinctSnapshots,
        },
        reason: 'Exchange-rate snapshot applied to pricing calculation',
        correlation_id: pricingQuoteId,
      },
    });
  }

  private buildSingleRiskRequestInput(dto: CalculateSingleRiskPremiumDto) {
    return {
      client_reference: dto.client_reference ?? null,
      risk_id: dto.risk_id,
      sum_insured: dto.sum_insured,
      factors: dto.factors,
      factor_values: dto.factor_values ?? null,
      effective_date: dto.effective_date ?? null,
      quotation_type: dto.quotation_type ?? null,
      currency_code: dto.currency_code ?? null,
      exchange_rate: dto.exchange_rate ?? null,
    };
  }

  private buildMultiRiskRequestInput(dto: CalculateMultiRiskPremiumDto) {
    return {
      product_code: dto.product_code ?? null,
      effective_date: dto.effective_date ?? null,
      quotation_type: dto.quotation_type ?? null,
      currency_code: dto.currency_code ?? null,
      exchange_rate: dto.exchange_rate ?? null,
      company_user_id: dto.company_user_id ?? null,
      branch_id: dto.branch_id ?? null,
      department_id: dto.department_id ?? null,
      risks: dto.risks.map((risk) => this.buildSingleRiskRequestInput(risk)),
    };
  }

  private buildRuleSelectionMetadata(result: RiskPremiumResult) {
    return {
      risk_id: result.risk_id,
      risk_code: result.risk_code,
      rule_id: result.rule_id,
      rule_name: result.rule_name,
      rule_version: result.rule_version,
      rate_book_id: result.rate_book_id,
      rate_book_code: result.rate_book_code,
      rate_book_version: result.rate_book_version,
      discount_control: result.discount_control,
      loading_control: result.loading_control,
    };
  }

  private buildCalculationResultMetadata(
    result: PersistedRiskPremiumResult | PersistedMultiRiskPremiumResult,
  ) {
    if ('risks' in result) {
      return {
        pricing_quote_id: result.pricing_quote_id,
        pricing_status: result.pricing_status,
        calculated_at: result.calculated_at,
        expires_at: result.expires_at,
        input_signature: result.input_signature,
        grand_total: result.grand_total,
        successful_risk_count: result.successful_risk_count,
        failed_risk_count: result.failed_risk_count,
        risks: result.risks.map((risk) => ({
          risk_id: risk.risk_id,
          risk_code: risk.risk_code,
          final_premium: risk.final_premium,
          premium_including_charges: risk.premium_including_charges,
          rate_book_version: risk.rate_book_version,
          rule_id: risk.rule_id,
        })),
        failed_risks: result.failed_risks,
      };
    }

    return {
      pricing_quote_id: result.pricing_quote_id,
      pricing_status: result.pricing_status,
      calculated_at: result.calculated_at,
      expires_at: result.expires_at,
      input_signature: result.input_signature,
      risk_id: result.risk_id,
      risk_code: result.risk_code,
      base_premium: result.base_premium,
      final_premium: result.final_premium,
      premium_including_charges: result.premium_including_charges,
      rate_book_version: result.rate_book_version,
      rule_id: result.rule_id,
      validation_warnings: result.validation_warnings,
    };
  }
}

export function buildFleetPremiumTotals(
  vehicleCount: number,
  risks: RiskPremiumResult[],
): FleetPremiumTotals {
  const total = (
    pick: (risk: RiskPremiumResult) => number | null | undefined,
  ) =>
    roundMoney(
      sumDecimals(risks.map((risk) => roundMoney(Number(pick(risk) ?? 0)))),
    );
  const premiumExcludingTax = total(
    (risk) => risk.premium_excluding_tax_equivalent,
  );
  const taxAmount = total((risk) => risk.total_tax_amount ?? risk.tax_amount);

  return {
    vehicle_count: vehicleCount,
    priced_vehicle_count: risks.length,
    sum_insured: total((risk) => risk.sum_insured),
    premium_before_discount: total((risk) => risk.premium_before_discount),
    discount_amount: total((risk) => risk.discount_amount),
    premium_excluding_tax: premiumExcludingTax,
    tax_amount: taxAmount,
    premium_including_tax: roundMoney(
      sumDecimals([premiumExcludingTax, taxAmount]),
    ),
  };
}
