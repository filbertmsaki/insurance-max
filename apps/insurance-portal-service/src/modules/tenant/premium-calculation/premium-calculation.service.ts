import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { RiskRequiredFactor } from '../risk-required-factors/entities/risk-required-factor.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import {
  CalculateMultiRiskPremiumDto,
  CalculateSingleRiskPremiumDto,
} from './dto/calculate-premium.dto';

type FactorValues = Record<string, string | number | boolean>;

export interface RiskPremiumResult {
  risk_id: string;
  risk_code: string;
  risk_name: string;
  rule_id: string;
  rule_name: string;
  sum_insured: number;
  rate_type: RateType;
  percentage_rate: number;
  base_premium: number;
  per_unit_factor_code: string | null;
  per_unit_value: number;
  per_unit_amount: number;
  per_unit_premium: number;
  fixed_amount: number;
  minimum_amount: number;
  gross_premium: number;
  final_premium: number;
  minimum_applied: boolean;
  factors: FactorValues;
  validation_errors: string[];
}

export interface MultiRiskPremiumResult {
  risks: RiskPremiumResult[];
  grand_total: number;
}

interface RuleCalculationBreakdown {
  percentage_rate: number;
  base_premium: number;
  per_unit_factor_code: string | null;
  per_unit_value: number;
  per_unit_amount: number;
  per_unit_premium: number;
  fixed_amount: number;
  minimum_amount: number;
  gross_premium: number;
  final_premium: number;
  minimum_applied: boolean;
}

@Injectable()
export class PremiumCalculationService {
  constructor(
    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(RiskRequiredFactor)
    private readonly requiredFactorRepository: Repository<RiskRequiredFactor>,

    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,
  ) {}

  async calculateSingleRisk(
    companyId: string,
    dto: CalculateSingleRiskPremiumDto,
  ): Promise<RiskPremiumResult> {
    const risk = await this.riskRepository.findOne({
      where: { id: dto.risk_id, company_id: companyId, is_active: true },
      relations: { product: true },
    });
    if (!risk) {
      throw new NotFoundException(`Risk not found or inactive: ${dto.risk_id}`);
    }

    const factorValues = this.normalizeInputFactors(dto);
    const validationErrors = await this.validateRequiredFactors(
      companyId,
      dto.risk_id,
      factorValues,
    );

    const rules = await this.ruleRepository.find({
      where: { company_id: companyId, risk_id: dto.risk_id, is_active: true },
      relations: { conditions: true },
      order: { priority: 'ASC' },
    });

    const matchingRule = rules.find((rule) =>
      this.evaluateRuleConditions(rule.conditions ?? [], factorValues),
    );

    if (!matchingRule) {
      throw new NotFoundException(
        `No active matching rating rule found for risk ${dto.risk_id}`,
      );
    }

    const breakdown = this.applyRule(matchingRule, factorValues);

    return {
      risk_id: risk.id,
      risk_code: risk.risk_code,
      risk_name: risk.risk_name,
      rule_id: matchingRule.id,
      rule_name: matchingRule.rule_name,
      sum_insured: this.roundMoney(Number(factorValues.sum_insured ?? 0)),
      rate_type: matchingRule.rate_type,
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
      factors: factorValues,
      validation_errors: validationErrors,
    };
  }

  async calculateMultiRisk(
    companyId: string,
    dto: CalculateMultiRiskPremiumDto,
  ): Promise<MultiRiskPremiumResult> {
    if (!dto.risks || dto.risks.length === 0) {
      throw new BadRequestException('At least one risk must be provided');
    }

    const results = await Promise.all(
      dto.risks.map((riskDto) => this.calculateSingleRisk(companyId, riskDto)),
    );

    const grandTotal = results.reduce((sum, r) => sum + r.final_premium, 0);

    return {
      risks: results,
      grand_total: this.roundMoney(grandTotal),
    };
  }

  private normalizeInputFactors(
    dto: CalculateSingleRiskPremiumDto,
  ): FactorValues {
    const merged: FactorValues = {
      ...(dto.factor_values ?? {}),
      ...(dto.factors ?? {}),
    };

    const normalized: FactorValues = {};
    for (const [key, value] of Object.entries(merged)) {
      normalized[key.trim().toLowerCase()] = value;
    }

    const sumInsured = Number(
      dto.sum_insured ??
        normalized.sum_insured ??
        normalized.sum_insured_amount ??
        0,
    );

    if (!Number.isFinite(sumInsured) || sumInsured < 0) {
      throw new BadRequestException(
        'sum_insured must be a valid non-negative number',
      );
    }

    normalized.sum_insured = sumInsured;
    return normalized;
  }

  private async validateRequiredFactors(
    companyId: string,
    riskId: string,
    factorValues: FactorValues,
  ): Promise<string[]> {
    const required = await this.requiredFactorRepository.find({
      where: { company_id: companyId, risk_id: riskId, is_required: true },
      relations: { factor: true },
      order: { sort_order: 'ASC' },
    });

    return required
      .filter(
        (rf) =>
          factorValues[rf.factor.code] === undefined ||
          factorValues[rf.factor.code] === null,
      )
      .map(
        (rf) =>
          `Required factor "${rf.factor.code}" (${rf.factor.name}) is missing`,
      );
  }

  private evaluateRuleConditions(
    conditions: RiskRuleCondition[],
    factorValues: FactorValues,
  ): boolean {
    if (conditions.length === 0) return true;

    let result = this.evaluateSingleCondition(conditions[0], factorValues);

    for (let i = 1; i < conditions.length; i++) {
      const prev = conditions[i - 1];
      const current = this.evaluateSingleCondition(conditions[i], factorValues);

      if (prev.logical_operator === LogicalOperator.AND) {
        result = result && current;
      } else {
        result = result || current;
      }
    }

    return result;
  }

  private evaluateSingleCondition(
    condition: RiskRuleCondition,
    factorValues: FactorValues,
  ): boolean {
    const raw = factorValues[condition.factor_code];
    if (raw === undefined || raw === null) return false;

    const factorValue = typeof raw === 'string' ? raw : String(raw);
    const numericValue = Number(raw);

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return factorValue === condition.value_from;

      case ConditionOperator.NOT_EQUALS:
        return factorValue !== condition.value_from;

      case ConditionOperator.GREATER_THAN:
        return numericValue > Number(condition.value_from);

      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return numericValue >= Number(condition.value_from);

      case ConditionOperator.LESS_THAN:
        return numericValue < Number(condition.value_from);

      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return numericValue <= Number(condition.value_from);

      case ConditionOperator.BETWEEN:
        return (
          numericValue >= Number(condition.value_from) &&
          numericValue <= Number(condition.value_to)
        );

      case ConditionOperator.IN: {
        const options = (condition.value_from ?? '')
          .split(',')
          .map((v) => v.trim());
        return options.includes(factorValue);
      }

      case ConditionOperator.NOT_IN: {
        const options = (condition.value_from ?? '')
          .split(',')
          .map((v) => v.trim());
        return !options.includes(factorValue);
      }

      default:
        return false;
    }
  }

  private applyRule(
    rule: RiskRatingRule,
    factorValues: FactorValues,
  ): RuleCalculationBreakdown {
    const effectiveRule = this.resolveEffectiveRule(rule);
    const sumInsured = Number(factorValues.sum_insured ?? 0);
    const percentageRate = Number(effectiveRule.percentage_rate ?? 0);
    const fixedAmount = Number(effectiveRule.fixed_amount ?? 0);
    const perUnitAmount = Number(effectiveRule.per_unit_amount ?? 0);
    const minimumAmount = Number(effectiveRule.minimum_amount ?? 0);
    const perUnitFactorCode = effectiveRule.per_unit_factor_code ?? null;
    const perUnitValue = Number(
      perUnitFactorCode ? (factorValues[perUnitFactorCode] ?? 0) : 0,
    );

    const basePremium = sumInsured * (percentageRate / 100);
    const perUnitPremium = perUnitValue * perUnitAmount;

    let grossPremium = 0;
    switch (effectiveRule.rate_type) {
      case RateType.PERCENTAGE:
        grossPremium = basePremium;
        break;
      case RateType.FIXED:
        grossPremium = fixedAmount;
        break;
      case RateType.PERCENTAGE_PLUS_FIXED:
        grossPremium = basePremium + fixedAmount;
        break;
      case RateType.PERCENTAGE_PLUS_PER_UNIT:
        grossPremium = basePremium + perUnitPremium;
        break;
      case RateType.PER_UNIT:
        grossPremium = perUnitPremium;
        break;
      case RateType.FORMULA:
        grossPremium = this.evaluateFormula(
          effectiveRule.formula ?? '0',
          factorValues,
        );
        break;
      default:
        grossPremium = 0;
    }

    let finalPremium = grossPremium;
    let minimumApplied = false;
    if (minimumAmount > 0 && finalPremium < minimumAmount) {
      finalPremium = minimumAmount;
      minimumApplied = true;
    }

    return {
      percentage_rate: this.roundMoney(percentageRate),
      base_premium: this.roundMoney(basePremium),
      per_unit_factor_code: perUnitFactorCode,
      per_unit_value: this.roundMoney(perUnitValue),
      per_unit_amount: this.roundMoney(perUnitAmount),
      per_unit_premium: this.roundMoney(perUnitPremium),
      fixed_amount: this.roundMoney(fixedAmount),
      minimum_amount: this.roundMoney(minimumAmount),
      gross_premium: this.roundMoney(grossPremium),
      final_premium: this.roundMoney(finalPremium),
      minimum_applied: minimumApplied,
    };
  }

  private evaluateFormula(formula: string, factorValues: FactorValues): number {
    try {
      const numericValues: Record<string, number> = {};
      for (const [key, val] of Object.entries(factorValues)) {
        numericValues[key] = Number(val) || 0;
      }

      const fn = new Function(
        ...Object.keys(numericValues),
        `"use strict"; return (${formula});`,
      );
      const result = fn(...Object.values(numericValues));
      return typeof result === 'number' && isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private resolveEffectiveRule(rule: RiskRatingRule): RiskRatingRule {
    const formulaText = (rule.formula ?? '').trim();
    if (!formulaText) {
      return rule;
    }

    const percentagePlusPerUnit = formulaText.match(
      /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
    );
    if (percentagePlusPerUnit) {
      return {
        ...rule,
        rate_type: RateType.PERCENTAGE_PLUS_PER_UNIT,
        percentage_rate:
          rule.percentage_rate ??
          this.toNullableNumber(percentagePlusPerUnit[1]),
        per_unit_amount: this.toNullableNumber(percentagePlusPerUnit[2]),
        per_unit_factor_code:
          rule.per_unit_factor_code ??
          this.normalizePerUnitFactorCode(percentagePlusPerUnit[3]),
      };
    }

    const perUnitOnly = formulaText.match(
      /^(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
    );
    if (perUnitOnly) {
      return {
        ...rule,
        rate_type: RateType.PER_UNIT,
        per_unit_amount: this.toNullableNumber(perUnitOnly[1]),
        per_unit_factor_code:
          rule.per_unit_factor_code ??
          this.normalizePerUnitFactorCode(perUnitOnly[2]),
      };
    }

    const percentagePlusFixed = formulaText.match(
      /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)$/i,
    );
    if (percentagePlusFixed) {
      return {
        ...rule,
        rate_type: RateType.PERCENTAGE_PLUS_FIXED,
        percentage_rate:
          rule.percentage_rate ?? this.toNullableNumber(percentagePlusFixed[1]),
        fixed_amount: this.toNullableNumber(percentagePlusFixed[2]),
      };
    }

    return rule;
  }

  private normalizePerUnitFactorCode(raw: string): string {
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes('seat')) return 'seat_capacity';
    if (normalized.includes('weight') && normalized.includes('vehicle')) {
      return 'vehicle_weight_kg';
    }
    if (normalized.includes('ton')) return 'cargo_weight_ton';
    return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private toNullableNumber(raw: string): number | null {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
}
