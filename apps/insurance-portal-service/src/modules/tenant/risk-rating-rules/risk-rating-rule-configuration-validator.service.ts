import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import { RiskRatingRule } from './entities/risk-rating-rule.entity';

type ActiveRuleDraft = Pick<
  RiskRatingRule,
  'id' | 'risk_id' | 'rule_name' | 'priority' | 'is_active' | 'per_unit_factor_code'
>;

type ActiveRuleSnapshot = Pick<
  RiskRatingRule,
  'id' | 'risk_id' | 'rule_name' | 'priority'
> & {
  conditions: Pick<
    RiskRuleCondition,
    'factor_code' | 'operator' | 'value_from' | 'value_to' | 'logical_operator'
  >[];
};

type ConditionDraft = Pick<
  RiskRuleCondition,
  'factor_code' | 'operator' | 'value_from' | 'value_to' | 'logical_operator'
>;

@Injectable()
export class RiskRatingRuleConfigurationValidatorService {
  constructor(
    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    @InjectRepository(RiskRuleCondition)
    private readonly conditionRepository: Repository<RiskRuleCondition>,

    @InjectRepository(RatingFactor)
    private readonly ratingFactorRepository: Repository<RatingFactor>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

  async assertRuleCanBeSaved(
    companyId: string,
    rule: ActiveRuleDraft,
  ): Promise<void> {
    if (!rule.is_active) {
      return;
    }

    await this.assertRiskIsActive(companyId, rule.risk_id);
    await this.assertPerUnitFactorCode(companyId, rule.per_unit_factor_code);

    const currentConditions = rule.id
      ? await this.findConditionsForRule(companyId, rule.id)
      : [];

    await this.assertDeterministicActiveRuleSet(companyId, rule.risk_id, {
      id: rule.id ?? `pending:${rule.rule_name}:${rule.priority}`,
      risk_id: rule.risk_id,
      rule_name: rule.rule_name,
      priority: rule.priority,
      conditions: currentConditions,
    });
  }

  async assertConditionCanBeCreated(
    companyId: string,
    rule: Pick<
      RiskRatingRule,
      'id' | 'risk_id' | 'rule_name' | 'priority' | 'is_active'
    >,
    condition: ConditionDraft,
  ): Promise<void> {
    const normalizedCondition = await this.normalizeAndValidateCondition(
      companyId,
      condition,
    );

    if (!rule.is_active) {
      return;
    }

    const currentConditions = await this.findConditionsForRule(companyId, rule.id);
    await this.assertDeterministicActiveRuleSet(companyId, rule.risk_id, {
      id: rule.id,
      risk_id: rule.risk_id,
      rule_name: rule.rule_name,
      priority: rule.priority,
      conditions: [...currentConditions, normalizedCondition],
    });
  }

  async assertConditionCanBeUpdated(
    companyId: string,
    rule: Pick<
      RiskRatingRule,
      'id' | 'risk_id' | 'rule_name' | 'priority' | 'is_active'
    >,
    conditionId: string,
    condition: ConditionDraft,
  ): Promise<void> {
    const normalizedCondition = await this.normalizeAndValidateCondition(
      companyId,
      condition,
    );

    if (!rule.is_active) {
      return;
    }

    const currentConditions = await this.findConditionsForRule(companyId, rule.id);
    await this.assertDeterministicActiveRuleSet(companyId, rule.risk_id, {
      id: rule.id,
      risk_id: rule.risk_id,
      rule_name: rule.rule_name,
      priority: rule.priority,
      conditions: currentConditions.map((existing) =>
        existing.id === conditionId ? normalizedCondition : existing,
      ),
    });
  }

  async assertConditionCanBeRemoved(
    companyId: string,
    rule: Pick<
      RiskRatingRule,
      'id' | 'risk_id' | 'rule_name' | 'priority' | 'is_active'
    >,
    conditionId: string,
  ): Promise<void> {
    if (!rule.is_active) {
      return;
    }

    const currentConditions = await this.findConditionsForRule(companyId, rule.id);
    await this.assertDeterministicActiveRuleSet(companyId, rule.risk_id, {
      id: rule.id,
      risk_id: rule.risk_id,
      rule_name: rule.rule_name,
      priority: rule.priority,
      conditions: currentConditions.filter(
        (existing) => existing.id !== conditionId,
      ),
    });
  }

  private async findConditionsForRule(companyId: string, ruleId: string) {
    return this.conditionRepository.find({
      where: { company_id: companyId, rule_id: ruleId },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }

  private async assertRiskIsActive(
    companyId: string,
    riskId: string,
  ): Promise<void> {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, company_id: companyId },
    });

    if (!risk) {
      throw new BadRequestException(
        'Risk not found or does not belong to this company',
      );
    }

    if (!risk.is_active) {
      throw new ConflictException(
        `Cannot activate rating rules for inactive risk ${risk.risk_code}`,
      );
    }
  }

  private async assertPerUnitFactorCode(
    companyId: string,
    perUnitFactorCode: string | null | undefined,
  ): Promise<void> {
    const normalizedCode = perUnitFactorCode?.trim().toLowerCase();
    if (!normalizedCode) {
      return;
    }

    const factor = await this.ratingFactorRepository.findOne({
      where: { company_id: companyId, code: normalizedCode },
    });

    if (!factor) {
      throw new BadRequestException(
        `per_unit_factor_code "${normalizedCode}" does not exist`,
      );
    }

    if (!factor.is_active) {
      throw new ConflictException(
        `per_unit_factor_code "${normalizedCode}" is inactive`,
      );
    }
  }

  private async normalizeAndValidateCondition(
    companyId: string,
    condition: ConditionDraft,
  ): Promise<ConditionDraft> {
    const factorCode = condition.factor_code.trim().toLowerCase();
    const factor = await this.ratingFactorRepository.findOne({
      where: { company_id: companyId, code: factorCode },
    });

    if (!factor) {
      throw new BadRequestException(
        `Condition factor "${factorCode}" does not exist`,
      );
    }

    if (!factor.is_active) {
      throw new ConflictException(
        `Condition factor "${factorCode}" is inactive`,
      );
    }

    const valueFrom = this.normalizeNullableString(condition.value_from);
    const valueTo = this.normalizeNullableString(condition.value_to);

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
      case ConditionOperator.NOT_EQUALS:
        if (!valueFrom) {
          throw new BadRequestException(
            `${condition.operator} conditions require value_from`,
          );
        }
        this.assertAllowedOptionValues(factor, [valueFrom], condition.operator);
        break;
      case ConditionOperator.GREATER_THAN:
      case ConditionOperator.GREATER_THAN_OR_EQUAL:
      case ConditionOperator.LESS_THAN:
      case ConditionOperator.LESS_THAN_OR_EQUAL:
        this.assertNumericFactorComparison(factor, condition.operator);
        this.assertFiniteNumber(valueFrom, 'value_from', condition.operator);
        break;
      case ConditionOperator.BETWEEN:
        this.assertNumericFactorComparison(factor, condition.operator);
        this.assertFiniteNumber(valueFrom, 'value_from', condition.operator);
        this.assertFiniteNumber(valueTo, 'value_to', condition.operator);
        break;
      case ConditionOperator.IN:
      case ConditionOperator.NOT_IN: {
        const options = this.parseList(valueFrom);
        if (options.length === 0) {
          throw new BadRequestException(
            `${condition.operator} conditions require a comma-separated value_from list`,
          );
        }
        this.assertAllowedOptionValues(factor, options, condition.operator);
        break;
      }
      default:
        throw new BadRequestException('Unsupported condition operator');
    }

    return {
      factor_code: factorCode,
      operator: condition.operator,
      value_from: valueFrom,
      value_to: valueTo,
      logical_operator: condition.logical_operator,
    };
  }

  private assertNumericFactorComparison(
    factor: RatingFactor,
    operator: ConditionOperator,
  ) {
    if (factor.data_type !== FactorDataType.NUMBER) {
      throw new BadRequestException(
        `${operator} conditions require NUMBER rating factors`,
      );
    }
  }

  private assertFiniteNumber(
    value: string | null,
    field: 'value_from' | 'value_to',
    operator: ConditionOperator,
  ) {
    if (!value || !Number.isFinite(Number(value))) {
      throw new BadRequestException(
        `${operator} conditions require ${field} to be a valid number`,
      );
    }
  }

  private assertAllowedOptionValues(
    factor: RatingFactor,
    values: string[],
    operator: ConditionOperator,
  ) {
    if (
      ![FactorDataType.SELECT, FactorDataType.MULTI_SELECT].includes(
        factor.data_type,
      )
    ) {
      return;
    }

    const allowedOptions = factor.options ?? [];
    const invalidOptions = values.filter(
      (value) => !allowedOptions.includes(value),
    );

    if (invalidOptions.length > 0) {
      throw new BadRequestException(
        `${operator} condition for "${factor.code}" contains unsupported options: ${invalidOptions.join(', ')}`,
      );
    }
  }

  private parseList(raw: string | null): string[] {
    return (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private normalizeNullableString(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async assertDeterministicActiveRuleSet(
    companyId: string,
    riskId: string,
    override: ActiveRuleSnapshot,
  ): Promise<void> {
    const persistedRules = await this.ruleRepository.find({
      where: { company_id: companyId, risk_id: riskId, is_active: true },
      relations: { conditions: true },
      order: { priority: 'ASC', created_at: 'ASC', id: 'ASC' },
    });

    const snapshots = persistedRules.map((rule) => ({
      id: rule.id,
      risk_id: rule.risk_id,
      rule_name: rule.rule_name,
      priority: rule.priority,
      conditions: rule.conditions ?? [],
    }));

    const existingIndex = snapshots.findIndex((rule) => rule.id === override.id);
    if (existingIndex >= 0) {
      snapshots[existingIndex] = override;
    } else {
      snapshots.push(override);
    }

    this.validateActiveRules(snapshots);
  }

  private validateActiveRules(rules: ActiveRuleSnapshot[]) {
    if (rules.length === 0) {
      return;
    }

    const fallbackRules = rules.filter((rule) => rule.conditions.length === 0);
    const conditionalRules = rules.filter((rule) => rule.conditions.length > 0);

    if (fallbackRules.length > 1) {
      throw new ConflictException(
        `Only one active fallback rule is allowed per risk. Conflicting rules: ${fallbackRules
          .map((rule) => rule.rule_name)
          .join(', ')}`,
      );
    }

    if (conditionalRules.length > 0 && fallbackRules.length === 0) {
      throw new ConflictException(
        'At least one active fallback rule is required when conditional rating rules are configured',
      );
    }

    const rulesByPriority = new Map<number, ActiveRuleSnapshot[]>();
    rules.forEach((rule) => {
      const current = rulesByPriority.get(rule.priority) ?? [];
      current.push(rule);
      rulesByPriority.set(rule.priority, current);
    });

    for (const [priority, group] of rulesByPriority.entries()) {
      const fallbackInGroup = group.find((rule) => rule.conditions.length === 0);
      if (fallbackInGroup && group.length > 1) {
        throw new ConflictException(
          `Fallback rule "${fallbackInGroup.rule_name}" overlaps with other active priority ${priority} rules`,
        );
      }

      const signatures = new Map<string, ActiveRuleSnapshot>();
      for (const rule of group.filter((candidate) => candidate.conditions.length > 0)) {
        const signature = this.serializeConditions(rule.conditions);
        const existing = signatures.get(signature);
        if (existing) {
          throw new ConflictException(
            `Rules "${existing.rule_name}" and "${rule.rule_name}" have the same active priority ${priority} condition set`,
          );
        }
        signatures.set(signature, rule);
      }
    }
  }

  private serializeConditions(
    conditions: Pick<
      RiskRuleCondition,
      'factor_code' | 'operator' | 'value_from' | 'value_to' | 'logical_operator'
    >[],
  ) {
    return [...conditions]
      .map((condition) => ({
        factor_code: condition.factor_code,
        operator: condition.operator,
        value_from: condition.value_from ?? '',
        value_to: condition.value_to ?? '',
        logical_operator: condition.logical_operator,
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      )
      .map((condition) => JSON.stringify(condition))
      .join('|');
  }
}
