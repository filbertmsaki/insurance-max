import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { RiskRatingRuleConfigurationValidatorService } from './risk-rating-rule-configuration-validator.service';

const COMPANY_ID = 'company-1';
const RISK_ID = 'risk-1';

function createServiceFixture(options?: {
  activeRisk?: boolean;
  persistedRules?: Array<Record<string, unknown>>;
  persistedConditions?: Array<Record<string, unknown>>;
  factor?: Record<string, unknown> | null;
}) {
  const ruleRepository = {
    find: jest.fn().mockResolvedValue(options?.persistedRules ?? []),
  };
  const conditionRepository = {
    find: jest.fn().mockResolvedValue(options?.persistedConditions ?? []),
  };
  const factorResult = Object.prototype.hasOwnProperty.call(
    options ?? {},
    'factor',
  )
    ? options?.factor
    : {
        id: 'factor-1',
        company_id: COMPANY_ID,
        code: 'vehicle_type',
        name: 'Vehicle Type',
        data_type: FactorDataType.SELECT,
        options: ['BUS', 'CAR'],
        is_active: true,
      };
  const ratingFactorRepository = {
    findOne: jest.fn().mockResolvedValue(factorResult),
  };
  const riskRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: RISK_ID,
      company_id: COMPANY_ID,
      risk_code: 'RISK-001',
      is_active: options?.activeRisk ?? true,
    }),
  };

  const service = new RiskRatingRuleConfigurationValidatorService(
    ruleRepository as any,
    conditionRepository as any,
    ratingFactorRepository as any,
    riskRepository as any,
  );

  return {
    service,
    ruleRepository,
    conditionRepository,
    ratingFactorRepository,
    riskRepository,
  };
}

describe('RiskRatingRuleConfigurationValidatorService', () => {
  it('rejects a second active fallback rule for the same risk', async () => {
    const { service } = createServiceFixture({
      persistedRules: [
        {
          id: 'existing-fallback',
          risk_id: RISK_ID,
          rule_name: 'Existing fallback',
          priority: 1,
          conditions: [],
        },
      ],
    });

    await expect(
      service.assertRuleCanBeSaved(COMPANY_ID, {
        id: 'new-fallback',
        risk_id: RISK_ID,
        rule_name: 'New fallback',
        priority: 2,
        is_active: true,
        per_unit_factor_code: null,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an active conditional rule set with no fallback rule', async () => {
    const { service } = createServiceFixture({
      persistedRules: [
        {
          id: 'conditional-rule',
          risk_id: RISK_ID,
          rule_name: 'Commercial bus rule',
          priority: 1,
          conditions: [],
        },
      ],
      factor: {
        id: 'factor-1',
        company_id: COMPANY_ID,
        code: 'vehicle_type',
        name: 'Vehicle Type',
        data_type: FactorDataType.SELECT,
        options: ['BUS', 'CAR'],
        is_active: true,
      },
    });

    await expect(
      service.assertConditionCanBeCreated(
        COMPANY_ID,
        {
          id: 'conditional-rule',
          risk_id: RISK_ID,
          rule_name: 'Commercial bus rule',
          priority: 1,
          is_active: true,
        },
        {
          factor_code: 'vehicle_type',
          operator: ConditionOperator.EQUALS,
          value_from: 'BUS',
          value_to: null,
          logical_operator: LogicalOperator.AND,
        },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects condition definitions that reference unknown factors', async () => {
    const { service } = createServiceFixture({
      factor: null,
    });

    await expect(
      service.assertConditionCanBeCreated(
        COMPANY_ID,
        {
          id: 'rule-1',
          risk_id: RISK_ID,
          rule_name: 'Rule 1',
          priority: 1,
          is_active: false,
        },
        {
          factor_code: 'unknown_factor',
          operator: ConditionOperator.EQUALS,
          value_from: 'BUS',
          value_to: null,
          logical_operator: LogicalOperator.AND,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
