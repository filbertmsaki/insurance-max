import { Injectable } from '@nestjs/common';
import {
  applyRate,
  roundMoney,
  roundRate,
  toDecimal,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { RiskRatingRule } from '../../risk-rating-rules/entities/risk-rating-rule.entity';
import type {
  PricingFactorValues,
  RiskRuleConditionSummary,
  RiskRuleExplanation,
  RuleCalculationBreakdown,
} from '../domain/pricing.types';
import { StructuredPricingCalculatorService } from './structured-pricing-calculator.service';

@Injectable()
export class PremiumBreakdownService {
  constructor(
    private readonly structuredPricingCalculatorService: StructuredPricingCalculatorService,
  ) {}

  buildBreakdown(
    rule: RiskRatingRule,
    factorValues: PricingFactorValues,
  ): RuleCalculationBreakdown {
    const sumInsured = toDecimal(Number(factorValues.sum_insured ?? 0));
    const percentageRate = toDecimal(rule.percentage_rate ?? 0);
    const fixedAmount = toDecimal(rule.fixed_amount ?? 0);
    const perUnitAmount = toDecimal(rule.per_unit_amount ?? 0);
    const minimumAmount = toDecimal(rule.minimum_amount ?? 0);
    const perUnitFactorCode = rule.per_unit_factor_code ?? null;
    const perUnitValue = toDecimal(
      Number(perUnitFactorCode ? (factorValues[perUnitFactorCode] ?? 0) : 0),
    );

    const basePremium = applyRate(sumInsured, percentageRate);
    const perUnitPremium = perUnitValue.mul(perUnitAmount);
    const grossPremium =
      this.structuredPricingCalculatorService.calculateGrossPremium(
        rule.rate_type,
        {
          sumInsured,
          percentageRate,
          fixedAmount,
          perUnitAmount,
          perUnitValue,
          basePremium,
          perUnitPremium,
        },
        rule.formula,
      );

    let finalPremium = grossPremium;
    let minimumApplied = false;
    if (minimumAmount.gt(0) && finalPremium.lt(minimumAmount)) {
      finalPremium = minimumAmount;
      minimumApplied = true;
    }

    return {
      percentage_rate: roundRate(percentageRate),
      base_premium: roundMoney(basePremium),
      per_unit_factor_code: perUnitFactorCode,
      per_unit_value: roundMoney(perUnitValue),
      per_unit_amount: roundMoney(perUnitAmount),
      per_unit_premium: roundMoney(perUnitPremium),
      fixed_amount: roundMoney(fixedAmount),
      minimum_amount: roundMoney(minimumAmount),
      gross_premium: roundMoney(grossPremium),
      final_premium: roundMoney(finalPremium),
      minimum_applied: minimumApplied,
    };
  }

  buildRuleExplanation(params: {
    risk: { id: string; risk_code: string; risk_name: string };
    rule: RiskRatingRule;
    conditions: RiskRuleConditionSummary[];
    otherActiveRuleCount: number;
  }): RiskRuleExplanation {
    const { risk, rule, conditions, otherActiveRuleCount } = params;

    return {
      risk_id: risk.id,
      risk_code: risk.risk_code,
      risk_name: risk.risk_name,
      rate_book_id: rule.rate_book_id ?? null,
      rate_book_code: rule.rate_book?.code ?? null,
      rate_book_version: rule.rate_book?.version ?? null,
      rule_id: rule.id,
      rule_name: rule.rule_name,
      rule_version: rule.rule_version ?? null,
      priority: rule.priority,
      rate_type: rule.rate_type,
      percentage_rate: roundRate(Number(rule.percentage_rate ?? 0)),
      fixed_amount: roundMoney(Number(rule.fixed_amount ?? 0)),
      per_unit_amount: roundMoney(Number(rule.per_unit_amount ?? 0)),
      per_unit_factor_code: rule.per_unit_factor_code ?? null,
      minimum_amount: roundMoney(Number(rule.minimum_amount ?? 0)),
      formula: rule.formula ?? null,
      conditions,
      other_active_rule_count: Math.max(otherActiveRuleCount, 0),
    };
  }
}
