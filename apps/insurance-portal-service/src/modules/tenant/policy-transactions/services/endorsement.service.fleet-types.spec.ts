import { UnprocessableEntityException } from '@nestjs/common';
import { EndorsementService } from './endorsement.service';
import { EndorsementTypesController } from '../controllers/endorsement-types.controller';

const user = { id: 'user-1', companyId: 'company-1' } as any;

function setup(options: {
  policy: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  typeCode: string;
}) {
  const saved: unknown[] = [];
  const policyQuery = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: 'policy-1', ...options.policy }),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => policyQuery),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (value: Record<string, unknown>) => {
      saved.push(value);
      return { id: 'transaction-1', stage: 'DRAFT', ...value };
    }),
  };
  const manager = { getRepository: jest.fn(() => repository) };
  const service = new EndorsementService(
    { transaction: jest.fn((work: any) => work(manager)) } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      validate: jest.fn().mockResolvedValue({
        eligible: true,
        blockers: [],
        currentVersion: {
          id: 'version-1',
          version_number: 1,
          regulatory_reference: 'REF-1',
          policy_snapshot: options.snapshot,
          policy_snapshot_hash: 'hash',
        },
      }),
    },
    {} as any,
    {} as any,
    {} as any,
    {
      requireActive: jest.fn().mockResolvedValue({
        id: 'type-1',
        code: options.typeCode,
        name: 'Fleet - Add Vehicle',
        tira_endorsement_type: 1,
        requires_new_cover_note: true,
      }),
    } as any,
    {
      generatePolicyTransactionNumber: jest.fn().mockResolvedValue('END-1'),
    } as any,
    {} as any,
    {} as any,
    {} as any,
    { resolve: jest.fn(), applyPolicyReadScope: jest.fn() } as any,
    {} as any,
  );
  return { service, saved };
}

const dto = {
  effective_date: '2026-10-01',
  endorsement_type_code: 'FLEET_ADD_VEHICLE',
  reason: 'Add a truck',
  idempotency_key: 'key-1',
};

describe('EndorsementService.create fleet-only types', () => {
  it('refuses a fleet vehicle type on a single-motor policy', async () => {
    const { service, saved } = setup({
      policy: { business_line: 'MOTOR', currency: 'TZS' },
      snapshot: { source: { quotationFlow: 'MOTOR_SINGLE' } },
      typeCode: 'FLEET_ADD_VEHICLE',
    });

    const error = await service.create(user, 'policy-1', dto).catch((e) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({
      code: 'ENDORSEMENT_TYPE_FLEET_ONLY',
    });
    expect(saved).toHaveLength(0);
  });

  it('refuses it on a legacy policy whose snapshot is not a fleet', async () => {
    const { service } = setup({
      policy: { business_line: null, currency: 'TZS' },
      snapshot: { source: { quotationFlow: 'NON_MOTOR', isFleet: false } },
      typeCode: 'FLEET_REMOVE_VEHICLE',
    });

    await expect(
      service.create(user, 'policy-1', {
        ...dto,
        endorsement_type_code: 'FLEET_REMOVE_VEHICLE',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('accepts it on a fleet policy', async () => {
    const { service, saved } = setup({
      policy: { business_line: null, currency: 'TZS' },
      snapshot: { source: { quotationFlow: 'MOTOR_FLEET', isFleet: true } },
      typeCode: 'FLEET_ADD_VEHICLE',
    });

    const transaction = await service.create(user, 'policy-1', dto);

    expect(transaction).toMatchObject({ transaction_no: 'END-1' });
    expect(saved.length).toBeGreaterThan(0);
  });

  it('does not restrict ordinary types on non-fleet policies', async () => {
    const { service } = setup({
      policy: { business_line: 'MOTOR', currency: 'TZS' },
      snapshot: { source: { quotationFlow: 'MOTOR_SINGLE' } },
      typeCode: 'RISK_CORRECTION',
    });

    await expect(
      service.create(user, 'policy-1', {
        ...dto,
        endorsement_type_code: 'RISK_CORRECTION',
      }),
    ).resolves.toMatchObject({ transaction_no: 'END-1' });
  });
});

describe('EndorsementTypesController.findAll', () => {
  it('flags the fleet add/remove vehicle types', async () => {
    const controller = new EndorsementTypesController({
      findAll: jest
        .fn()
        .mockResolvedValue([
          { code: 'FLEET_ADD_VEHICLE' },
          { code: 'FLEET_REMOVE_VEHICLE' },
          { code: 'RISK_CORRECTION' },
        ]),
    } as any);

    const types = await controller.findAll(user);

    expect(types.map((type) => type.is_fleet_only)).toEqual([
      true,
      true,
      false,
    ]);
  });
});
