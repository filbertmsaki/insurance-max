import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PolicyTransactionChangeType } from '@insurance-max/contracts';
import { NonMotorEndorsementService } from './non-motor-endorsement.service';

const FIELDS = [
  {
    field_key: 'construction_type',
    label: 'Construction type',
    data_type: 'SELECT',
    is_required: true,
    options: [
      { value: 'CONCRETE', label: 'Concrete' },
      { value: 'TIMBER', label: 'Timber' },
    ],
    validation_rules: null,
  },
  {
    field_key: 'floors',
    label: 'Floors',
    data_type: 'INTEGER',
    is_required: false,
    options: null,
    validation_rules: { min: 1 },
  },
];

function makeManager(
  options: {
    policy?: Record<string, unknown> | null;
    issued?: Record<string, unknown> | null;
    quoted?: Record<string, unknown> | null;
    changes?: Array<Record<string, unknown>>;
  } = {},
) {
  const policy =
    options.policy === undefined
      ? {
          id: 'policy-1',
          company_id: 'company-1',
          quotation_id: 'quotation-1',
          product_id: 'product-1',
          sub_class_id: null,
          business_line: 'NON_MOTOR',
          quotation_flow: 'NON_MOTOR',
        }
      : options.policy;
  const issued =
    options.issued === undefined
      ? {
          risk_data: { construction_type: 'CONCRETE', floors: 2 },
          risk_location: 'Plot 1, Dar es Salaam',
          limit_of_liability: '1000000.00',
        }
      : options.issued;
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM policies policy') && sql.includes('LEFT JOIN')) {
      return policy ? [policy] : [];
    }
    if (sql.includes('FROM policy_non_motor_risk_details')) {
      return issued ? [issued] : [];
    }
    if (sql.includes('FROM quotation_non_motor_details detail')) {
      return [];
    }
    if (sql.includes('FROM quotation_non_motor_details')) {
      return options.quoted ? [options.quoted] : [];
    }
    if (sql.includes('SELECT quotation_id FROM policies')) {
      return [{ quotation_id: 'quotation-1' }];
    }
    return [];
  });
  const fieldQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(FIELDS),
  };
  const changeRepo = {
    find: jest.fn().mockResolvedValue(options.changes ?? []),
  };
  const manager = {
    query,
    transaction: jest.fn(async (work: (m: unknown) => unknown) =>
      work(manager),
    ),
    getRepository: (entity: { name?: string }) => {
      if (entity?.name === 'ProductRiskField') {
        return { createQueryBuilder: () => fieldQuery };
      }
      if (entity?.name === 'PolicyTransactionChange') return changeRepo;
      throw new Error(`Unexpected entity ${entity?.name}`);
    },
  };
  return { manager: manager, query, changeRepo };
}

describe('NonMotorEndorsementService', () => {
  const service = new NonMotorEndorsementService();

  describe('loadPolicyRisk', () => {
    it('reads the current values from policy_non_motor_risk_details', async () => {
      const { manager } = makeManager();

      const context = await service.loadPolicyRisk(
        manager,
        'company-1',
        'policy-1',
      );

      expect(context?.current).toEqual({
        riskData: { construction_type: 'CONCRETE', floors: 2 },
        riskLocation: 'Plot 1, Dar es Salaam',
        limitOfLiability: 1000000,
      });
    });

    it('falls back to the quotation details for older policies', async () => {
      const { manager } = makeManager({
        issued: null,
        quoted: {
          risk_data: { construction_type: 'TIMBER' },
          risk_location: null,
          limit_of_liability: null,
        },
      });

      const context = await service.loadPolicyRisk(
        manager,
        'company-1',
        'policy-1',
      );

      expect(context?.current.riskData).toEqual({
        construction_type: 'TIMBER',
      });
    });

    it('returns null for a policy of another line', async () => {
      const { manager } = makeManager({
        policy: {
          id: 'policy-1',
          company_id: 'company-1',
          quotation_id: 'quotation-1',
          product_id: 'product-1',
          sub_class_id: null,
          business_line: 'MOTOR',
          quotation_flow: 'MOTOR',
        },
      });

      await expect(
        service.loadPolicyRisk(manager, 'company-1', 'policy-1'),
      ).resolves.toBeNull();
    });
  });

  describe('resolveChange', () => {
    it('returns the authoritative source value and the normalised new value', async () => {
      const { manager } = makeManager();

      const resolved = await service.resolveChange(
        manager,
        'company-1',
        'policy-1',
        'nonMotor.riskData.floors',
        PolicyTransactionChangeType.MODIFY,
        '3',
      );

      expect(resolved).toEqual({
        sourceValue: 2,
        operation: PolicyTransactionChangeType.MODIFY,
        newValue: 3,
      });
    });

    it('rejects a value that does not satisfy the risk schema', async () => {
      const { manager } = makeManager();

      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.riskData.construction_type',
          PolicyTransactionChangeType.MODIFY,
          'STRAW',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a key that is not a field of the product', async () => {
      const { manager } = makeManager();

      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.riskData.unknown_key',
          PolicyTransactionChangeType.MODIFY,
          'x',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to remove a required field and turns a blank optional value into a removal', async () => {
      const { manager } = makeManager();

      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.riskData.construction_type',
          PolicyTransactionChangeType.REMOVE,
          null,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.riskData.floors',
          PolicyTransactionChangeType.MODIFY,
          '',
        ),
      ).resolves.toEqual({
        sourceValue: 2,
        operation: PolicyTransactionChangeType.REMOVE,
        newValue: null,
      });
    });

    it('validates the risk location and limit of liability', async () => {
      const { manager } = makeManager();

      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.limitOfLiability',
          PolicyTransactionChangeType.MODIFY,
          '2500000.456',
        ),
      ).resolves.toEqual({
        sourceValue: 1000000,
        operation: PolicyTransactionChangeType.MODIFY,
        newValue: 2500000.46,
      });
      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.limitOfLiability',
          PolicyTransactionChangeType.MODIFY,
          -1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.riskLocation',
          PolicyTransactionChangeType.MODIFY,
          '  Plot 9  ',
        ),
      ).resolves.toEqual({
        sourceValue: 'Plot 1, Dar es Salaam',
        operation: PolicyTransactionChangeType.MODIFY,
        newValue: 'Plot 9',
      });
    });

    it('rejects risk-detail changes on a non Non-Motor policy', async () => {
      const { manager } = makeManager({ policy: null });

      await expect(
        service.resolveChange(
          manager,
          'company-1',
          'policy-1',
          'nonMotor.riskLocation',
          PolicyTransactionChangeType.MODIFY,
          'x',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('withCurrentRisk', () => {
    it('adds the current risk details under nonMotor', async () => {
      const { manager } = makeManager();

      const snapshot = await service.withCurrentRisk(
        manager,
        'company-1',
        'policy-1',
        { entries: [] },
      );

      expect(snapshot).toEqual({
        entries: [],
        nonMotor: {
          riskData: { construction_type: 'CONCRETE', floors: 2 },
          riskLocation: 'Plot 1, Dar es Salaam',
          limitOfLiability: 1000000,
        },
      });
    });
  });

  describe('applyToPolicy', () => {
    it('does nothing without Non-Motor changes', async () => {
      const { manager, query } = makeManager({
        changes: [
          {
            field_path: 'cover.endDate',
            operation: 'MODIFY',
            new_value: '2027-01-01',
          },
        ],
      });

      await expect(
        service.applyToPolicy(manager, 'company-1', 'txn-1', 'policy-1'),
      ).resolves.toBe(false);
      expect(query).not.toHaveBeenCalled();
    });

    it('writes the endorsed values back to policy_non_motor_risk_details', async () => {
      const { manager, query } = makeManager({
        changes: [
          {
            field_path: 'nonMotor.riskData.construction_type',
            operation: 'MODIFY',
            new_value: 'TIMBER',
          },
          {
            field_path: 'nonMotor.riskData.floors',
            operation: 'REMOVE',
            new_value: null,
          },
          {
            field_path: 'nonMotor.limitOfLiability',
            operation: 'MODIFY',
            new_value: 2500000,
          },
        ],
      });

      await expect(
        service.applyToPolicy(manager, 'company-1', 'txn-1', 'policy-1'),
      ).resolves.toBe(true);

      const update = query.mock.calls.find(([sql]) =>
        String(sql).startsWith('UPDATE policy_non_motor_risk_details'),
      ) as unknown as [string, unknown[]];
      expect(update[1]).toEqual([
        'policy-1',
        'company-1',
        ['floors'],
        JSON.stringify({ construction_type: 'TIMBER' }),
        false,
        null,
        true,
        '2500000.00',
      ]);
      // The policy's row is ensured before the update.
      expect(
        query.mock.calls.some(([sql]) =>
          String(sql).includes('ON CONFLICT (policy_id) DO NOTHING'),
        ),
      ).toBe(true);
    });
  });
});
