import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { roundMoney } from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { Repository } from 'typeorm';
import { ProductTaxRule } from '../../product-distribution/entities/product-tax-rule.entity';
import { ProductCalculationBase } from '../../product-distribution/enums/product-calculation-base.enum';
import { ProductRuleStatus } from '../../product-distribution/enums/product-rule-status.enum';
import { ProductTaxType } from '../../product-distribution/enums/product-tax-type.enum';
import type {
  PricingChargeBreakdown,
  PricingChargeCalculationInput,
  PricingChargeSummary,
} from '../domain/pricing.types';

@Injectable()
export class PricingChargeService {
  constructor(
    @InjectRepository(ProductTaxRule)
    private readonly productTaxRuleRepository: Repository<ProductTaxRule>,
  ) {}

  async calculateCharges(
    companyId: string,
    input: PricingChargeCalculationInput,
  ): Promise<PricingChargeSummary & { charges: PricingChargeBreakdown[] }> {
    const effectiveDate = input.effective_date ?? this.today();
    const rules = await this.productTaxRuleRepository.find({
      where: {
        company_id: companyId,
        status: ProductRuleStatus.ACTIVE,
      },
      order: {
        effective_from: 'ASC',
        created_at: 'ASC',
      },
    });

    const charges = rules
      .filter((rule) => this.ruleMatches(rule, input, effectiveDate))
      .map((rule) => this.toBreakdown(rule, input));

    const totalChargeAmount = roundMoney(
      charges.reduce((sum, charge) => sum + charge.computed_amount, 0),
    );
    const taxableChargeAmount = roundMoney(
      charges.reduce(
        (sum, charge) =>
          sum + (charge.is_taxable ? charge.computed_amount : 0),
        0,
      ),
    );
    const nonTaxableChargeAmount = roundMoney(
      totalChargeAmount - taxableChargeAmount,
    );

    return {
      charges,
      total_charge_amount: totalChargeAmount,
      taxable_charge_amount: taxableChargeAmount,
      non_taxable_charge_amount: nonTaxableChargeAmount,
      premium_including_charges: roundMoney(
        input.net_premium + totalChargeAmount,
      ),
    };
  }

  private ruleMatches(
    rule: ProductTaxRule,
    input: PricingChargeCalculationInput,
    effectiveDate: string,
  ) {
    if (rule.category_id && rule.category_id !== (input.category_id ?? null)) {
      return false;
    }
    if (rule.product_id && rule.product_id !== (input.product_id ?? null)) {
      return false;
    }
    if (rule.risk_id && rule.risk_id !== (input.risk_id ?? null)) {
      return false;
    }

    return (
      rule.effective_from <= effectiveDate && rule.effective_to >= effectiveDate
    );
  }

  private toBreakdown(
    rule: ProductTaxRule,
    input: PricingChargeCalculationInput,
  ): PricingChargeBreakdown {
    const baseAmount = this.resolveBaseAmount(rule.calculation_base, input);
    const rate = rule.tax_rate !== null ? Number(rule.tax_rate) : null;
    const fixedAmount =
      rule.tax_amount !== null ? Number(rule.tax_amount) : null;
    const rawAmount =
      rule.tax_type === ProductTaxType.PERCENTAGE
        ? baseAmount * (rate ?? 0)
        : fixedAmount ?? 0;
    const minimumChargeAmount =
      rule.minimum_charge_amount !== null
        ? Number(rule.minimum_charge_amount)
        : null;
    const maximumChargeAmount =
      rule.maximum_charge_amount !== null
        ? Number(rule.maximum_charge_amount)
        : null;

    let computedAmount = roundMoney(rawAmount);
    if (
      minimumChargeAmount !== null &&
      computedAmount < minimumChargeAmount
    ) {
      computedAmount = roundMoney(minimumChargeAmount);
    }
    if (
      maximumChargeAmount !== null &&
      computedAmount > maximumChargeAmount
    ) {
      computedAmount = roundMoney(maximumChargeAmount);
    }

    return {
      applied_rule_id: rule.id,
      charge_code: rule.tax_code,
      charge_name: rule.tax_name,
      charge_category:
        rule.charge_category as PricingChargeBreakdown['charge_category'],
      charge_scope: this.resolveScope(rule),
      charge_type: rule.tax_type as PricingChargeBreakdown['charge_type'],
      calculation_base:
        rule.calculation_base as PricingChargeBreakdown['calculation_base'],
      base_amount: roundMoney(baseAmount),
      rate,
      fixed_amount: fixedAmount,
      minimum_charge_amount: minimumChargeAmount,
      maximum_charge_amount: maximumChargeAmount,
      computed_amount: computedAmount,
      is_taxable: rule.is_taxable,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to,
    };
  }

  private resolveBaseAmount(
    calculationBase: ProductCalculationBase,
    input: PricingChargeCalculationInput,
  ) {
    switch (calculationBase) {
      case ProductCalculationBase.BASIC_PREMIUM:
        return input.basic_premium;
      case ProductCalculationBase.GROSS_PREMIUM:
        return input.gross_premium;
      case ProductCalculationBase.NET_PREMIUM:
      default:
        return input.net_premium;
    }
  }

  private resolveScope(
    rule: ProductTaxRule,
  ): PricingChargeBreakdown['charge_scope'] {
    if (rule.risk_id) {
      return 'RISK';
    }
    if (rule.product_id) {
      return 'PRODUCT';
    }
    if (rule.category_id) {
      return 'CATEGORY';
    }
    return 'COMPANY';
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}
