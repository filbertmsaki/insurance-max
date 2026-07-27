import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { PricingEngineService } from '../pricing/application/pricing-engine.service';
import { PricingChargeService } from '../pricing/application/pricing-charge.service';
import { PricingQuoteService } from '../pricing/application/pricing-quote.service';
import { PricingValidationService } from '../pricing/application/pricing-validation.service';
import { QuotationRecalculationService } from '../pricing/application/quotation-recalculation.service';
import { PremiumBreakdownService } from '../pricing/infrastructure/premium-breakdown.service';
import { RatingFactorValidatorService } from '../pricing/infrastructure/rating-factor-validator.service';
import { RatingRuleMatcherService } from '../pricing/infrastructure/rating-rule-matcher.service';
import { StructuredPricingCalculatorService } from '../pricing/infrastructure/structured-pricing-calculator.service';
import { FixedPricingStrategy } from '../pricing/infrastructure/strategies/fixed-pricing.strategy';
import { PercentagePricingStrategy } from '../pricing/infrastructure/strategies/percentage-pricing.strategy';
import { PercentagePlusFixedPricingStrategy } from '../pricing/infrastructure/strategies/percentage-plus-fixed-pricing.strategy';
import { PercentagePlusPerUnitPricingStrategy } from '../pricing/infrastructure/strategies/percentage-plus-per-unit-pricing.strategy';
import { PerUnitPricingStrategy } from '../pricing/infrastructure/strategies/per-unit-pricing.strategy';
import { PremiumCalculationService } from './premium-calculation.service';

const COMPANY_ID = 'company-1';

// Fixtures below mirror the real seeded rating rules for these risk codes
// (verified directly against the database) rather than made-up numbers, so
// these tests exercise the actual production rate configuration per
// rate_type.
const RISKS = {
  // MOTOR Private Vehicles-Comprehensive claim free Vehicle: PERCENTAGE 3.5%, minimum 250,000
  comprehensive: {
    risk: {
      id: 'risk-comprehensive',
      company_id: COMPANY_ID,
      risk_code: 'SP014001000001',
      risk_name: 'MOTOR Private Vehicles-Comprehensive claim free Vehicle',
      is_active: true,
    },
    rule: {
      id: 'rule-comprehensive',
      company_id: COMPANY_ID,
      risk_id: 'risk-comprehensive',
      rule_name: 'Base Rate From TIRA',
      rate_type: RateType.PERCENTAGE,
      percentage_rate: 0.035,
      fixed_amount: null,
      per_unit_amount: null,
      per_unit_factor_code: null,
      minimum_amount: 250000,
      priority: 1,
      formula: null,
      is_active: true,
      conditions: [],
    },
  },
  // MOTOR Private Vehicles-TPFT ("2%+TPP"): PERCENTAGE_PLUS_FIXED, 2% + 200,000, minimum 200,000
  tpft: {
    risk: {
      id: 'risk-tpft',
      company_id: COMPANY_ID,
      risk_code: 'SP014001000003',
      risk_name: 'MOTOR Private Vehicles-TPFT',
      is_active: true,
    },
    rule: {
      id: 'rule-tpft',
      company_id: COMPANY_ID,
      risk_id: 'risk-tpft',
      rule_name: 'Base Rate From TIRA',
      rate_type: RateType.PERCENTAGE_PLUS_FIXED,
      percentage_rate: 0.02,
      fixed_amount: 200000,
      per_unit_amount: null,
      per_unit_factor_code: null,
      minimum_amount: 200000,
      priority: 1,
      formula: null,
      is_active: true,
      conditions: [],
    },
  },
  // MOTOR Passenger Carrying (No Claim Record): PERCENTAGE_PLUS_PER_UNIT, 5.5% + 15,000/seat, minimum 500,000
  passengerCarrying: {
    risk: {
      id: 'risk-passenger',
      company_id: COMPANY_ID,
      risk_code: 'SP014004000001',
      risk_name:
        'MOTOR Passenger Carrying-Comprehensive- Public Taxis, private hire, tour operators with No Claim Record',
      is_active: true,
    },
    rule: {
      id: 'rule-passenger',
      company_id: COMPANY_ID,
      risk_id: 'risk-passenger',
      rule_name: 'Base Rate From TIRA',
      rate_type: RateType.PERCENTAGE_PLUS_PER_UNIT,
      percentage_rate: 0.055,
      fixed_amount: null,
      per_unit_amount: 15000,
      per_unit_factor_code: 'seat_capacity',
      minimum_amount: 500000,
      priority: 1,
      formula: null,
      is_active: true,
      conditions: [],
    },
  },
  // MOTOR Private Vehicles-TPO: FIXED, flat 100,000, no percentage component
  tpo: {
    risk: {
      id: 'risk-tpo',
      company_id: COMPANY_ID,
      risk_code: 'SP014001000004',
      risk_name: 'MOTOR Private Vehicles-TPO',
      is_active: true,
    },
    rule: {
      id: 'rule-tpo',
      company_id: COMPANY_ID,
      risk_id: 'risk-tpo',
      rule_name: 'Base Rate From TIRA',
      rate_type: RateType.FIXED,
      percentage_rate: null,
      fixed_amount: 100000,
      per_unit_amount: null,
      per_unit_factor_code: null,
      minimum_amount: 100000,
      priority: 1,
      formula: null,
      is_active: true,
      conditions: [],
    },
  },
  // MOTOR Motor Cycle-TPO (Three Wheelers): FIXED, flat 75,000
  motorCycleTpo: {
    risk: {
      id: 'risk-motorcycle-tpo',
      company_id: COMPANY_ID,
      risk_code: 'SP014002000008',
      risk_name: 'MOTOR Motor Cycle-TPO (Three Wheelers)',
      is_active: true,
    },
    rule: {
      id: 'rule-motorcycle-tpo',
      company_id: COMPANY_ID,
      risk_id: 'risk-motorcycle-tpo',
      rule_name: 'Base Rate From TIRA',
      rate_type: RateType.FIXED,
      percentage_rate: null,
      fixed_amount: 75000,
      per_unit_amount: null,
      per_unit_factor_code: null,
      minimum_amount: 75000,
      priority: 1,
      formula: null,
      is_active: true,
      conditions: [],
    },
  },
};

// The 5 real risk codes above all have zero rule conditions today, so they
// can't demonstrate the "missing factor referenced by a condition -> no
// matching rule" path — this synthetic fixture exists purely for that one
// negative case.
const CONDITIONAL_RISK = {
  risk: {
    id: 'risk-conditional',
    company_id: COMPANY_ID,
    risk_code: 'SYNTHETIC-CONDITIONAL',
    risk_name: 'Synthetic risk with a claim_record condition',
    is_active: true,
  },
  rule: {
    id: 'rule-conditional',
    company_id: COMPANY_ID,
    risk_id: 'risk-conditional',
    rule_name: 'No claim record rate',
    rate_type: RateType.PERCENTAGE,
    percentage_rate: 0.03,
    fixed_amount: null,
    per_unit_amount: null,
    per_unit_factor_code: null,
    minimum_amount: 0,
    priority: 1,
    formula: null,
    is_active: true,
    conditions: [
      {
        factor_code: 'claim_record',
        operator: ConditionOperator.EQUALS,
        value_from: 'NO_CLAIM',
        value_to: null,
        logical_operator: LogicalOperator.AND,
      },
    ],
  },
};

function createServiceFixture(options: {
  risk: Record<string, unknown> | null;
  rules: Record<string, unknown>[];
  requiredFactors?: Record<string, unknown>[];
  configuredFactors?: Record<string, unknown>[];
}) {
  const riskRepository = {
    findOne: jest.fn().mockResolvedValue(options.risk),
  };
  const requiredFactorRepository = {
    find: jest.fn().mockResolvedValue(options.requiredFactors ?? []),
  };
  const ratingFactorRepository = {
    find: jest.fn().mockResolvedValue(options.configuredFactors ?? []),
  };
  const ruleRepository = {
    find: jest.fn().mockResolvedValue(options.rules),
  };
  const matcherRiskRepository = {
    findOne: jest.fn().mockResolvedValue(options.risk),
  };
  const rateBookRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const pricingQuoteRepository = {
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
    findOne: jest.fn(),
  };
  const pricingQuoteRiskRepository = {
    find: jest
      .fn()
      .mockResolvedValue(options.risk ? [{ ...options.risk, product_id: 'product-1' }] : []),
  };
  const identifierGeneratorService = {
    generatePricingQuoteId: jest.fn().mockResolvedValue({
      pricingQuoteId: 'PQ-2026-00000001',
      sequenceNo: 1,
    }),
  };

  const pricingValidationService = new PricingValidationService(
    riskRepository as any,
  );
  const ratingFactorValidatorService = new RatingFactorValidatorService(
    requiredFactorRepository as any,
    ratingFactorRepository as any,
  );
  const ratingRuleMatcherService = new RatingRuleMatcherService(
    ruleRepository as any,
    matcherRiskRepository as any,
    rateBookRepository as any,
  );
  const structuredPricingCalculatorService =
    new StructuredPricingCalculatorService(
      new PercentagePricingStrategy(),
      new FixedPricingStrategy(),
      new PercentagePlusFixedPricingStrategy(),
      new PerUnitPricingStrategy(),
      new PercentagePlusPerUnitPricingStrategy(),
    );
  const premiumBreakdownService = new PremiumBreakdownService(
    structuredPricingCalculatorService,
  );
  const productTaxRuleRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const pricingChargeService = new PricingChargeService(
    productTaxRuleRepository as any,
  );
  const pricingEngineService = new PricingEngineService(
    pricingValidationService,
    ratingFactorValidatorService,
    ratingRuleMatcherService,
    premiumBreakdownService,
    pricingChargeService,
  );
  const pricingQuoteService = new PricingQuoteService(
    pricingEngineService,
    new QuotationRecalculationService(),
    identifierGeneratorService as any,
    pricingQuoteRepository as any,
    pricingQuoteRiskRepository as any,
  );
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PremiumCalculationService(
    pricingQuoteService,
    pricingEngineService,
    auditService as any,
  );

  return {
    service,
    riskRepository,
    requiredFactorRepository,
    ratingFactorRepository,
    ruleRepository,
    auditService,
  };
}

function configuredFactor(
  code: string,
  dataType: FactorDataType,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `factor-${code}`,
    company_id: COMPANY_ID,
    code,
    name: code,
    data_type: dataType,
    options: null,
    default_value: null,
    is_required: false,
    is_active: true,
    ...overrides,
  };
}

function requiredFactor(
  code: string,
  dataType: FactorDataType = FactorDataType.TEXT,
  overrides: Record<string, unknown> = {},
) {
  // Mirrors what the real query returns: it already filters to
  // is_required = true at the SQL level, so every row reaching the service
  // is required by definition.
  return {
    is_required: true,
    factor: configuredFactor(code, dataType, overrides),
  };
}

describe('PremiumCalculationService', () => {
  describe('PERCENTAGE rate type', () => {
    it('applies the minimum floor when the percentage result is below it', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.comprehensive.risk.id,
        sum_insured: 1000000,
        factors: {},
      });

      expect(result.pricing_quote_id).toBe('PQ-2026-00000001');
      expect(result.pricing_status).toBe('CALCULATED');
      expect(result.base_premium).toBe(35000);
      expect(result.gross_premium).toBe(35000);
      expect(result.minimum_applied).toBe(true);
      expect(result.final_premium).toBe(250000);
    });

    it('does not apply the minimum floor once the percentage exceeds it', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.comprehensive.risk.id,
        sum_insured: 10000000,
        factors: {},
      });

      expect(result.base_premium).toBe(350000);
      expect(result.minimum_applied).toBe(false);
      expect(result.final_premium).toBe(350000);
    });
  });

  describe('PERCENTAGE_PLUS_FIXED rate type (the "%+TPP" fix)', () => {
    it('adds the fixed TPP charge on top of the percentage below the crossover point', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.tpft.risk,
        rules: [RISKS.tpft.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.tpft.risk.id,
        sum_insured: 1000000,
        factors: {},
      });

      // 1,000,000 * 2% = 20,000; + 200,000 fixed = 220,000 (above the
      // 200,000 floor, so the floor does not additionally apply).
      expect(result.base_premium).toBe(20000);
      expect(result.fixed_amount).toBe(200000);
      expect(result.gross_premium).toBe(220000);
      expect(result.minimum_applied).toBe(false);
      expect(result.final_premium).toBe(220000);
    });

    it('adds the fixed TPP charge on top of the percentage above the crossover point', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.tpft.risk,
        rules: [RISKS.tpft.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.tpft.risk.id,
        sum_insured: 20000000,
        factors: {},
      });

      // 20,000,000 * 2% = 400,000; + 200,000 fixed = 600,000. Before the
      // fix this risk was plain PERCENTAGE with minimum_amount as a floor,
      // which would have wrongly returned 400,000 here.
      expect(result.base_premium).toBe(400000);
      expect(result.gross_premium).toBe(600000);
      expect(result.final_premium).toBe(600000);
    });
  });

  describe('PERCENTAGE_PLUS_PER_UNIT rate type', () => {
    it('adds the per-seat premium on top of the percentage', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.passengerCarrying.risk,
        rules: [RISKS.passengerCarrying.rule],
        configuredFactors: [
          configuredFactor('seat_capacity', FactorDataType.NUMBER),
        ],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.passengerCarrying.risk.id,
        sum_insured: 10000000,
        factors: { seat_capacity: 10 },
      });

      // 10,000,000 * 5.5% = 550,000; + 10 seats * 15,000 = 150,000 -> 700,000.
      expect(result.base_premium).toBe(550000);
      expect(result.per_unit_value).toBe(10);
      expect(result.per_unit_premium).toBe(150000);
      expect(result.gross_premium).toBe(700000);
      expect(result.final_premium).toBe(700000);
      expect(result.minimum_applied).toBe(false);
    });
  });

  describe('FIXED rate type (zero percentage rate)', () => {
    it('returns the flat amount regardless of sum insured (TPO)', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.tpo.risk,
        rules: [RISKS.tpo.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.tpo.risk.id,
        sum_insured: 999999999,
        factors: {},
      });

      expect(result.percentage_rate).toBe(0);
      expect(result.gross_premium).toBe(100000);
      expect(result.final_premium).toBe(100000);
    });

    it('returns the flat amount regardless of sum insured (motorcycle TPO)', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.motorCycleTpo.risk,
        rules: [RISKS.motorCycleTpo.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.motorCycleTpo.risk.id,
        sum_insured: 5000000,
        factors: {},
      });

      expect(result.percentage_rate).toBe(0);
      expect(result.final_premium).toBe(75000);
    });
  });

  describe('legacy FORMULA migration bridge', () => {
    it('supports legacy structured shorthand formulas by resolving them into safe strategies', async () => {
      const formulaRule = {
        ...RISKS.tpft.rule,
        id: 'rule-legacy-formula',
        rate_type: RateType.FORMULA,
        percentage_rate: null,
        fixed_amount: null,
        formula: '2% + 200,000',
      };
      const { service } = createServiceFixture({
        risk: RISKS.tpft.risk,
        rules: [formulaRule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.tpft.risk.id,
        sum_insured: 1000000,
        factors: {},
      });

      expect(result.base_premium).toBe(20000);
      expect(result.fixed_amount).toBe(200000);
      expect(result.gross_premium).toBe(220000);
      expect(result.final_premium).toBe(220000);
    });

    it('rejects unresolved free-text formulas instead of executing dynamic JavaScript', async () => {
      const formulaRule = {
        ...RISKS.comprehensive.rule,
        id: 'rule-unsupported-formula',
        rate_type: RateType.FORMULA,
        percentage_rate: null,
        minimum_amount: 0,
        formula: 'sum_insured * 0.03',
      };
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [formulaRule],
      });

      await expect(
        service.calculateSingleRisk(COMPANY_ID, {
          risk_id: RISKS.comprehensive.risk.id,
          sum_insured: 1000000,
          factors: {},
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rating-factor validation', () => {
    it('throws a structured validation failure when required factors are missing', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule],
        requiredFactors: [
          requiredFactor('motor_category'),
          requiredFactor('registration_number'),
        ],
      });

      await expect(
        service.calculateSingleRisk(COMPANY_ID, {
          risk_id: RISKS.comprehensive.risk.id,
          sum_insured: 10000000,
          factors: {},
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.calculateSingleRisk(COMPANY_ID, {
          risk_id: RISKS.comprehensive.risk.id,
          sum_insured: 10000000,
          factors: {},
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          status: 'INCOMPLETE',
          calculation_allowed: false,
          validation_errors: [
            expect.stringContaining('motor_category'),
            expect.stringContaining('registration_number'),
          ],
          errors: [
            expect.objectContaining({
              field: 'motor_category',
              code: 'REQUIRED_FACTOR_MISSING',
            }),
            expect.objectContaining({
              field: 'registration_number',
              code: 'REQUIRED_FACTOR_MISSING',
            }),
          ],
        });
      }
    });

    it('throws a structured validation failure when a NUMBER factor is invalid', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule],
        configuredFactors: [
          configuredFactor('vehicle_value', FactorDataType.NUMBER),
        ],
      });

      await expect(
        service.calculateSingleRisk(COMPANY_ID, {
          risk_id: RISKS.comprehensive.risk.id,
          sum_insured: 1000000,
          factors: { vehicle_value: 'not-a-number' as any },
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.calculateSingleRisk(COMPANY_ID, {
          risk_id: RISKS.comprehensive.risk.id,
          sum_insured: 1000000,
          factors: { vehicle_value: 'not-a-number' as any },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          status: 'INCOMPLETE',
          calculation_allowed: false,
          validation_errors: [
            expect.stringContaining('vehicle_value'),
          ],
          errors: [
            expect.objectContaining({
              field: 'vehicle_value',
              code: 'INVALID_NUMBER',
            }),
          ],
        });
      }
    });

    it('returns validation_warnings when a supplied factor is unknown but calculation can proceed', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.comprehensive.risk.id,
        sum_insured: 10000000,
        factors: { mystery_factor: 'surplus' },
      });

      expect(result.validation_errors).toEqual([]);
      expect(result.validation_warnings).toEqual([
        expect.stringContaining('mystery_factor'),
      ]);
      expect(result.final_premium).toBe(350000);
    });

    it('throws "no matching rule" when the rule condition cannot be satisfied because its factor was omitted', async () => {
      const { service } = createServiceFixture({
        risk: CONDITIONAL_RISK.risk,
        rules: [CONDITIONAL_RISK.rule],
      });

      await expect(
        service.calculateSingleRisk(COMPANY_ID, {
          risk_id: CONDITIONAL_RISK.risk.id,
          sum_insured: 1000000,
          factors: {}, // claim_record deliberately omitted
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws a configuration error when multiple active rules match at the same priority', async () => {
      const conflictingRule = {
        ...RISKS.comprehensive.rule,
        id: 'rule-comprehensive-conflict',
        rule_name: 'Another Base Rate From TIRA',
      };
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule, conflictingRule],
      });

      await expect(
        service.calculateSingleRisk(COMPANY_ID, {
          risk_id: RISKS.comprehensive.risk.id,
          sum_insured: 10000000,
          factors: {},
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('explainRisk', () => {
    it('returns the resolved top-priority rule without requiring sum_insured', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.passengerCarrying.risk,
        rules: [RISKS.passengerCarrying.rule],
      });

      const result = await service.explainRisk(
        COMPANY_ID,
        RISKS.passengerCarrying.risk.id,
      );

      expect(result.rate_type).toBe(RateType.PERCENTAGE_PLUS_PER_UNIT);
      expect(result.percentage_rate).toBe(0.055);
      expect(result.per_unit_amount).toBe(15000);
      expect(result.per_unit_factor_code).toBe('seat_capacity');
      expect(result.minimum_amount).toBe(500000);
      expect(result.conditions).toEqual([]);
    });

    it('throws when the risk has no active rating rule', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.tpo.risk,
        rules: [],
      });

      await expect(
        service.explainRisk(COMPANY_ID, RISKS.tpo.risk.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the risk itself is not found', async () => {
      const { service } = createServiceFixture({ risk: null, rules: [] });

      await expect(
        service.explainRisk(COMPANY_ID, 'missing-risk'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
