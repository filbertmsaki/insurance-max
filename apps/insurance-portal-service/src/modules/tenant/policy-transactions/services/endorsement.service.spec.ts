import { BadRequestException } from '@nestjs/common';
import {
  PolicyChangeCategory,
  PolicyTransactionChangeType,
  PolicyTransactionPremiumEffect,
} from '@insurance-max/contracts';
import { EndorsementService } from './endorsement.service';
import { ProposedPolicySnapshotService } from './proposed-policy-snapshot.service';

function makeHarness() {
  const transaction = {
    id: 'txn-1',
    company_id: 'company-1',
    stage: 'DRAFT',
    source_policy_id: 'policy-1',
    source_policy_snapshot: { entries: [{ risks: [] }] },
  } as any;
  const savedChanges: any[] = [];
  const changeRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn(async () => savedChanges),
    save: jest.fn(async (value: any) => {
      const saved = { id: 'change-1', ...value };
      savedChanges.push(saved);
      return saved;
    }),
    remove: jest.fn(),
  };
  const transactionQuery = {
    innerJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(transaction),
  };
  const manager = {
    getRepository: (entity: { name?: string }) => {
      switch (entity?.name) {
        case 'PolicyTransaction':
          return {
            createQueryBuilder: () => transactionQuery,
            save: jest.fn(async (value: any) => value),
          };
        case 'PolicyEndorsement':
          return {
            findOne: jest.fn().mockResolvedValue({
              endorsement_type_code: 'DETAILS_CHANGE',
            }),
          };
        case 'PolicyTransactionChange':
          return changeRepo;
        case 'PolicyTransactionEvent':
          return { save: jest.fn() };
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };
  const dataSource = {
    transaction: jest.fn(async (work: (m: unknown) => unknown) =>
      work(manager),
    ),
  } as any;
  const hashService = {
    hashDefinition: jest.fn((value: unknown) => JSON.stringify(value)),
  } as any;
  const repricingService = {
    reprice: jest.fn().mockResolvedValue({
      snapshot: {
        snapshotHash: 'pricing-hash',
        premiumEffect: PolicyTransactionPremiumEffect.NONE,
        premiumDifference: '0.0000',
        taxDifference: '0.0000',
        commissionDifference: '0.0000',
      },
      approvalRequired: false,
    }),
  };
  const nonMotorEndorsement = {
    isNonMotorPath: (path: string) => path.startsWith('nonMotor.'),
    hasNonMotorChanges: (changes: Array<{ field_path: string }>) =>
      changes.some((change) => change.field_path.startsWith('nonMotor.')),
    resolveChange: jest.fn().mockResolvedValue({
      sourceValue: 'CONCRETE',
      operation: PolicyTransactionChangeType.MODIFY,
      newValue: 'TIMBER',
    }),
    withCurrentRisk: jest.fn(async (_m, _c, _p, snapshot) => ({
      ...snapshot,
      nonMotor: {
        riskData: { construction_type: 'CONCRETE' },
        riskLocation: null,
        limitOfLiability: null,
      },
    })),
  };
  const dataAccessScopeService = {
    resolve: jest.fn().mockReturnValue({}),
    applyPolicyReadScope: jest.fn(),
  };

  const service = new EndorsementService(
    dataSource,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    new ProposedPolicySnapshotService(hashService),
    repricingService as any,
    {} as any,
    {} as any,
    {} as any,
    hashService,
    {} as any,
    {} as any,
    dataAccessScopeService as any,
    { adjust: jest.fn().mockResolvedValue(false) } as any,
    nonMotorEndorsement as any,
  );

  return {
    service,
    changeRepo,
    repricingService,
    nonMotorEndorsement,
  };
}

const user = { id: 'user-1', companyId: 'company-1' } as any;

describe('EndorsementService non-motor risk details', () => {
  it('records a nonMotor.riskData change with the authoritative old value', async () => {
    const { service, changeRepo, repricingService, nonMotorEndorsement } =
      makeHarness();

    const result = await service.recordChange(user, 'txn-1', {
      category: PolicyChangeCategory.RISK,
      operation: PolicyTransactionChangeType.MODIFY,
      field_path: 'nonMotor.riskData.construction_type',
      old_value: 'anything',
      new_value: 'TIMBER',
    });

    expect(nonMotorEndorsement.resolveChange).toHaveBeenCalledWith(
      expect.anything(),
      'company-1',
      'policy-1',
      'nonMotor.riskData.construction_type',
      PolicyTransactionChangeType.MODIFY,
      'TIMBER',
    );
    expect(changeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        category: PolicyChangeCategory.RISK,
        field_path: 'nonMotor.riskData.construction_type',
        old_value: 'CONCRETE',
        new_value: 'TIMBER',
        is_material: true,
        requires_repricing: false,
        requires_regulatory_submission: false,
      }),
    );
    // The proposed snapshot carries the whole risk block with the change.
    expect(result.proposed_policy_snapshot).toEqual(
      expect.objectContaining({
        nonMotor: {
          riskData: { construction_type: 'TIMBER' },
          riskLocation: null,
          limitOfLiability: null,
        },
      }),
    );
    expect(result.premium_effect).toBe(PolicyTransactionPremiumEffect.NONE);
    expect(repricingService.reprice).toHaveBeenCalled();
  });

  it('rejects a nonMotor change recorded under the wrong category', async () => {
    const { service } = makeHarness();

    await expect(
      service.recordChange(user, 'txn-1', {
        category: PolicyChangeCategory.ASSET,
        operation: PolicyTransactionChangeType.MODIFY,
        field_path: 'nonMotor.riskLocation',
        new_value: 'Plot 9',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects nonMotor paths outside the allowed fields', async () => {
    const { service } = makeHarness();

    await expect(
      service.recordChange(user, 'txn-1', {
        category: PolicyChangeCategory.RISK,
        operation: PolicyTransactionChangeType.MODIFY,
        field_path: 'nonMotor.schemaSnapshot',
        new_value: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
