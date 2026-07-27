import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import {
  roundMoney,
  roundRate,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { PricingRateBookStatus } from '../../pricing-rate-books/enums/pricing-rate-book-status.enum';
import { PricingRateBook } from '../../pricing-rate-books/entities/pricing-rate-book.entity';
import { RiskRatingRule } from '../../risk-rating-rules/entities/risk-rating-rule.entity';
import { RiskRuleCondition } from '../../risk-rule-conditions/entities/risk-rule-condition.entity';
import type {
  PricingFactorValues,
  RiskRuleConditionSummary,
} from '../domain/pricing.types';
import { matchLegacyStructuredFormula } from './legacy-structured-formula.util';
import { PricingRuntimeCacheService } from '../application/pricing-runtime-cache.service';

@Injectable()
export class RatingRuleMatcherService {
  constructor(
    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(PricingRateBook)
    private readonly rateBookRepository: Repository<PricingRateBook>,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
  ) {}

  async findActiveRules(
    companyId: string,
    riskId: string,
    effectiveDate?: string | null,
    currencyCode?: string | null,
  ): Promise<RiskRatingRule[]> {
    return this.pricingRuntimeCacheService.getActiveRules(
      companyId,
      riskId,
      this.normalizeEffectiveDate(effectiveDate),
      currencyCode ?? null,
      async () => {
        const applicableRateBook = await this.findApplicablePublishedRateBook(
          companyId,
          riskId,
          effectiveDate,
          currencyCode,
        );

        if (applicableRateBook) {
          const versionedRules = await this.ruleRepository.find({
            where: {
              company_id: companyId,
              risk_id: riskId,
              is_active: true,
              rate_book_id: applicableRateBook.id,
            },
            relations: { conditions: true, rate_book: true },
            order: { priority: 'ASC', created_at: 'ASC', id: 'ASC' },
          });

          if (versionedRules.length > 0) {
            return versionedRules;
          }
        }

        return this.ruleRepository.find({
          where: {
            company_id: companyId,
            risk_id: riskId,
            is_active: true,
            rate_book_id: IsNull(),
          },
          relations: { conditions: true, rate_book: true },
          order: { priority: 'ASC', created_at: 'ASC', id: 'ASC' },
        });
      },
    );
  }

  async findFirstMatchingRule(
    companyId: string,
    riskId: string,
    factorValues: PricingFactorValues,
    effectiveDate?: string | null,
    currencyCode?: string | null,
  ): Promise<RiskRatingRule | null> {
    const rules = await this.findActiveRules(
      companyId,
      riskId,
      effectiveDate,
      currencyCode,
    );
    const matchingRules = rules.filter((rule) =>
      this.evaluateRuleConditions(rule.conditions ?? [], factorValues),
    );
    if (matchingRules.length === 0) {
      return null;
    }

    const topPriority = matchingRules[0].priority;
    const topPriorityMatches = matchingRules.filter(
      (rule) => rule.priority === topPriority,
    );

    if (topPriorityMatches.length > 1) {
      throw new ConflictException({
        status: 'CONFIGURATION_ERROR',
        code: 'MULTIPLE_MATCHING_RULES',
        message: `Multiple active rating rules match risk ${riskId} at priority ${topPriority}`,
        risk_id: riskId,
        priority: topPriority,
        matching_rule_ids: topPriorityMatches.map((rule) => rule.id),
        matching_rule_names: topPriorityMatches.map((rule) => rule.rule_name),
      });
    }

    return topPriorityMatches[0] ?? null;
  }

  private async findApplicablePublishedRateBook(
    companyId: string,
    riskId: string,
    effectiveDate?: string | null,
    currencyCode?: string | null,
  ): Promise<PricingRateBook | null> {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, company_id: companyId },
    });
    if (!risk) {
      return null;
    }

    const today = this.normalizeEffectiveDate(effectiveDate);
    const candidateBooks = await this.rateBookRepository.find({
      where: {
        company_id: companyId,
        product_id: risk.product_id,
        status: PricingRateBookStatus.PUBLISHED,
      },
      order: {
        effective_from: 'DESC',
        published_at: 'DESC',
        created_at: 'DESC',
      },
    });

    const applicableBooks = candidateBooks.filter((book) => {
      const endsAfterToday = !book.effective_to || book.effective_to >= today;
      const isEffective = book.effective_from <= today && endsAfterToday;
      // A rate book scoped to a specific currency only applies to a
      // calculation requesting that same currency. Currency-agnostic books
      // (currency_code IS NULL) remain their own bucket, matching the
      // overlap guard already enforced in PricingRateBooksService.publish().
      const matchesCurrency =
        !currencyCode ||
        !book.currency_code ||
        book.currency_code === currencyCode;
      return isEffective && matchesCurrency;
    });

    if (applicableBooks.length > 1) {
      throw new ConflictException({
        status: 'CONFIGURATION_ERROR',
        code: 'MULTIPLE_EFFECTIVE_RATE_BOOKS',
        message: `Multiple published rate books are effective today for risk ${riskId}`,
        risk_id: riskId,
        product_id: risk.product_id,
        matching_rate_book_ids: applicableBooks.map((book) => book.id),
        matching_rate_book_versions: applicableBooks.map(
          (book) => book.version,
        ),
      });
    }

    return applicableBooks[0] ?? null;
  }

  private normalizeEffectiveDate(value?: string | null): string {
    return value?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  }

  summarizeConditions(
    conditions: RiskRuleCondition[],
  ): RiskRuleConditionSummary[] {
    return conditions.map((condition) => ({
      factor_code: condition.factor_code,
      operator: condition.operator,
      value_from: condition.value_from,
      value_to: condition.value_to,
      logical_operator: condition.logical_operator,
    }));
  }

  resolveEffectiveRule(rule: RiskRatingRule): RiskRatingRule {
    const formulaText = (rule.formula ?? '').trim();
    if (!formulaText) {
      return rule;
    }

    const formulaMatch = matchLegacyStructuredFormula(formulaText);
    if (!formulaMatch) {
      return rule;
    }

    if (formulaMatch.kind === 'PERCENTAGE_PLUS_PER_UNIT') {
      return {
        ...rule,
        rate_type: RateType.PERCENTAGE_PLUS_PER_UNIT,
        percentage_rate:
          rule.percentage_rate ??
          this.toNullablePercentage(formulaMatch.percentageRateText ?? ''),
        per_unit_amount: this.toNullableNumber(
          formulaMatch.perUnitAmountText ?? '',
        ),
        per_unit_factor_code:
          rule.per_unit_factor_code ??
          this.normalizePerUnitFactorCode(formulaMatch.perUnitFactorLabel ?? ''),
      };
    }

    if (formulaMatch.kind === 'PER_UNIT') {
      return {
        ...rule,
        rate_type: RateType.PER_UNIT,
        per_unit_amount: this.toNullableNumber(
          formulaMatch.perUnitAmountText ?? '',
        ),
        per_unit_factor_code:
          rule.per_unit_factor_code ??
          this.normalizePerUnitFactorCode(formulaMatch.perUnitFactorLabel ?? ''),
      };
    }

    if (formulaMatch.kind === 'PERCENTAGE_PLUS_FIXED') {
      return {
        ...rule,
        rate_type: RateType.PERCENTAGE_PLUS_FIXED,
        percentage_rate:
          rule.percentage_rate ??
          this.toNullablePercentage(formulaMatch.percentageRateText ?? ''),
        fixed_amount: this.toNullableNumber(formulaMatch.fixedAmountText ?? ''),
      };
    }

    return rule;
  }

  private evaluateRuleConditions(
    conditions: RiskRuleCondition[],
    factorValues: PricingFactorValues,
  ): boolean {
    if (conditions.length === 0) return true;

    // AND binds tighter than OR, matching standard boolean precedence:
    // split the flat condition chain into OR-separated groups, each group
    // being one or more conditions joined by AND, then OR the groups
    // together. Each condition's logical_operator describes how it joins
    // the *next* condition in the chain.
    const groups: boolean[][] = [
      [this.evaluateSingleCondition(conditions[0], factorValues)],
    ];

    for (let index = 1; index < conditions.length; index += 1) {
      const connector = conditions[index - 1].logical_operator;
      const value = this.evaluateSingleCondition(
        conditions[index],
        factorValues,
      );

      if (connector === LogicalOperator.OR) {
        groups.push([value]);
      } else {
        groups[groups.length - 1].push(value);
      }
    }

    return groups.some((group) => group.every((value) => value));
  }

  private evaluateSingleCondition(
    condition: RiskRuleCondition,
    factorValues: PricingFactorValues,
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
          .map((value) => value.trim());
        return options.includes(factorValue);
      }

      case ConditionOperator.NOT_IN: {
        const options = (condition.value_from ?? '')
          .split(',')
          .map((value) => value.trim());
        return !options.includes(factorValue);
      }

      default:
        return false;
    }
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
    return Number.isFinite(parsed) ? roundMoney(parsed) : null;
  }

  private toNullablePercentage(raw: string): number | null {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? roundRate(parsed / 100) : null;
  }
}
