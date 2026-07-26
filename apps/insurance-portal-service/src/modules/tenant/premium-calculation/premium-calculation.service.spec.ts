import { NotFoundException } from '@nestjs/common';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
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
      percentage_rate: 3.5,
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
      percentage_rate: 2,
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
      percentage_rate: 5.5,
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
    percentage_rate: 3,
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
}) {
  const riskRepository = {
    findOne: jest.fn().mockResolvedValue(options.risk),
  };
  const requiredFactorRepository = {
    find: jest.fn().mockResolvedValue(options.requiredFactors ?? []),
  };
  const ruleRepository = {
    find: jest.fn().mockResolvedValue(options.rules),
  };

  const service = new PremiumCalculationService(
    riskRepository as any,
    requiredFactorRepository as any,
    ruleRepository as any,
  );

  return { service, riskRepository, requiredFactorRepository, ruleRepository };
}

function requiredFactor(code: string) {
  // Mirrors what the real query returns: it already filters to
  // is_required = true at the SQL level, so every row reaching the service
  // is required by definition.
  return { is_required: true, factor: { code, name: code } };
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

  describe('missing required factors', () => {
    it('populates validation_errors but still returns a result when the matched rule has no conditions on the missing factors', async () => {
      const { service } = createServiceFixture({
        risk: RISKS.comprehensive.risk,
        rules: [RISKS.comprehensive.rule],
        // The real query filters to is_required: true at the SQL level
        // (WHERE is_required = true), so only required rows are ever
        // returned here — seat_capacity (not required for this risk) never
        // reaches the service at all, which is exactly why it must not
        // appear in validation_errors below.
        requiredFactors: [
          requiredFactor('motor_category'),
          requiredFactor('registration_number'),
        ],
      });

      const result = await service.calculateSingleRisk(COMPANY_ID, {
        risk_id: RISKS.comprehensive.risk.id,
        sum_insured: 10000000,
        factors: {},
      });

      expect(result.validation_errors).toEqual([
        expect.stringContaining('motor_category'),
        expect.stringContaining('registration_number'),
      ]);
      expect(result.validation_errors).toHaveLength(2);
      // The calculation itself doesn't hard-fail just because business
      // factors are missing — only a rule condition referencing the
      // missing factor would block the match (see the next test).
      expect(result.final_premium).toBe(350000);
    });

    it('throws "no matching rule" when the missing factor is required by the matched rule condition', async () => {
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
      expect(result.percentage_rate).toBe(5.5);
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
