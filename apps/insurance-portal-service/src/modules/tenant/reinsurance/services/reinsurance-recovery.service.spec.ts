import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import {
  ReinsuranceCessionStatus,
  TreatyForm,
} from '../enums/reinsurance.enums';
import {
  ReinsuranceRecoveryService,
  recoveryBalances,
} from './reinsurance-recovery.service';

describe('recovery balances', () => {
  it('separates unadmitted from uncollected amounts without double counting', () => {
    expect(
      recoveryBalances({
        expected_recovery: '100.00',
        admitted_recovery: '60.00',
        received_recovery: '20.00',
      }),
    ).toEqual({ unadmitted_recovery: '40.00', uncollected_recovery: '40.00' });
  });
});

function makeHarness(params: {
  claim: any;
  cessions: any[];
  participantsByCession: Record<string, any[]>;
  treatiesById: Record<string, any>;
  sectionsById: Record<string, any>;
  legacyRecovery?: any;
}) {
  const claimRepository = {
    findOne: jest.fn().mockResolvedValue(params.claim),
  };

  const cessionRepository = {
    find: jest.fn().mockResolvedValue(params.cessions),
  };

  const referenceService = {
    next: jest.fn().mockResolvedValue('REC-2026-00001'),
  };
  const recoveryRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'recovery-1',
      company_id: 'company-1',
      participant_company_id: 'reinsurer-1',
      expected_recovery: '100.00',
      admitted_recovery: '0.00',
      received_recovery: '0.00',
      currency: 'TZS',
    }),
    save: jest.fn(async (value: any) => value),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: () => recoveryRepository.findOne(),
    })),
  };

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'InsuranceClaim':
          return {
            createQueryBuilder: () => ({
              setLock: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(params.claim),
            }),
          };
        case 'PolicyCessionParticipant':
          return {
            find: jest
              .fn()
              .mockImplementation(
                async ({ where }: any) =>
                  params.participantsByCession[where.cession_id] ?? [],
              ),
          };
        case 'ReinsuranceTreaty':
          return {
            findOne: jest
              .fn()
              .mockImplementation(
                async ({ where }: any) => params.treatiesById[where.id] ?? null,
              ),
          };
        case 'ReinsuranceTreatySection':
          return {
            findOne: jest
              .fn()
              .mockImplementation(
                async ({ where }: any) => params.sectionsById[where.id] ?? null,
              ),
          };
        case 'ReinsuranceClaimRecovery':
          return {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((value: any) => value),
            save: recoveryRepository.save,
            createQueryBuilder: recoveryRepository.createQueryBuilder,
          };
        case 'ClaimRecovery':
          return {
            findOne: jest.fn().mockResolvedValue(params.legacyRecovery ?? null),
          };
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  };

  const service = new ReinsuranceRecoveryService(
    dataSource as any,
    claimRepository as any,
    cessionRepository as any,
    {} as any, // cessionParticipantRepository (unused directly, only via manager)
    recoveryRepository as any,
    {} as any, // receiptRepository
    {} as any, // treatyRepository (unused directly, only via manager)
    {} as any, // sectionRepository (unused directly, only via manager)
    referenceService as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
  );

  return { service, recoveryRepository };
}

describe('ReinsuranceRecoveryService.calculateRecoveries', () => {
  const user = {
    id: 'user-1',
    companyId: 'company-1',
    companyType: CompanyType.INSURANCE_COMPANY,
  } as any;

  it('requires reconciliation of legacy generic reinsurance recoveries', async () => {
    const { service } = makeHarness({
      claim: {
        id: 'claim-1',
        company_id: 'company-1',
        policy_id: 'policy-1',
        approved_amount: '100.00',
      },
      cessions: [{ id: 'cession-1' }],
      participantsByCession: {},
      treatiesById: {},
      sectionsById: {},
      legacyRecovery: { id: 'legacy-1' },
    });
    await expect(service.calculateRecoveries(user, 'claim-1')).rejects.toThrow(
      'legacy claim reinsurance recovery',
    );
  });

  it('apportions the raw claim amount by premium share for a proportional treaty', async () => {
    const { service } = makeHarness({
      claim: {
        id: 'claim-1',
        company_id: 'company-1',
        branch_id: null,
        policy_id: 'policy-1',
        approved_amount: '100000.00',
        currency_code: 'TZS',
      },
      cessions: [
        {
          id: 'cession-1',
          treaty_id: 'treaty-1',
          treaty_section_id: null,
          status: ReinsuranceCessionStatus.ACTIVE,
        },
      ],
      participantsByCession: {
        'cession-1': [
          {
            id: 'participant-1',
            participant_company_id: 'pc-1',
            premium_share: '50',
          },
        ],
      },
      treatiesById: {
        'treaty-1': {
          id: 'treaty-1',
          treaty_form: TreatyForm.QUOTA_SHARE,
          company_retention: '0',
          total_capacity: '1000000',
        },
      },
      sectionsById: {},
    });

    const recoveries = await service.calculateRecoveries(user, 'claim-1');

    expect(recoveries).toHaveLength(1);
    expect(recoveries[0].expected_recovery).toBe('50000.00');
  });

  it('caps recovery at the layer limit above the attachment point for an XOL treaty', async () => {
    const { service } = makeHarness({
      claim: {
        id: 'claim-1',
        company_id: 'company-1',
        branch_id: null,
        policy_id: 'policy-1',
        approved_amount: '500000.00',
        currency_code: 'TZS',
      },
      cessions: [
        {
          id: 'cession-1',
          treaty_id: 'treaty-1',
          treaty_section_id: 'section-1',
          status: ReinsuranceCessionStatus.ACTIVE,
        },
      ],
      participantsByCession: {
        'cession-1': [
          {
            id: 'participant-1',
            participant_company_id: 'pc-1',
            premium_share: '100',
          },
        ],
      },
      treatiesById: {
        'treaty-1': {
          id: 'treaty-1',
          treaty_form: TreatyForm.EXCESS_OF_LOSS,
          company_retention: '0',
          total_capacity: '0',
        },
      },
      sectionsById: {
        'section-1': {
          id: 'section-1',
          retention_amount: '100000',
          treaty_limit: '200000',
        },
      },
    });

    const recoveries = await service.calculateRecoveries(user, 'claim-1');

    // loss 500000, attachment 100000 -> excess 400000, capped at layer limit 200000
    expect(recoveries[0].expected_recovery).toBe('200000.00');
  });
});

describe('ReinsuranceRecoveryService.admitRecovery', () => {
  it('preserves exact cents for large admitted amounts', async () => {
    const { service, recoveryRepository } = makeHarness({
      claim: null,
      cessions: [],
      participantsByCession: {},
      treatiesById: {},
      sectionsById: {},
    });
    recoveryRepository.findOne.mockResolvedValueOnce({
      id: 'recovery-1',
      company_id: 'company-1',
      participant_company_id: 'reinsurer-1',
      expected_recovery: '90071992547409.93',
      admitted_recovery: '0.00',
      received_recovery: '0.00',
      currency: 'TZS',
    });
    const result = await service.admitRecovery(
      {
        id: 'reinsurer-user',
        companyId: 'reinsurer-1',
        companyType: CompanyType.REINSURANCE_COMPANY,
      } as any,
      'recovery-1',
      '90071992547409.92',
    );
    expect(result.admitted_recovery).toBe('90071992547409.92');
    expect(result.outstanding_recovery).toBe('90071992547409.92');
  });
  it('rejects admission below receipts already recorded', async () => {
    const { service, recoveryRepository } = makeHarness({
      claim: null,
      cessions: [],
      participantsByCession: {},
      treatiesById: {},
      sectionsById: {},
    });
    recoveryRepository.findOne.mockResolvedValueOnce({
      id: 'recovery-1',
      company_id: 'company-1',
      participant_company_id: 'reinsurer-1',
      expected_recovery: '100.00',
      admitted_recovery: '60.00',
      received_recovery: '40.00',
      currency: 'TZS',
    });
    await expect(
      service.admitRecovery(
        {
          id: 'user',
          companyId: 'reinsurer-1',
          companyType: CompanyType.REINSURANCE_COMPANY,
        } as any,
        'recovery-1',
        '39.99',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('does not allow an insurer to admit a reinsurer recovery', async () => {
    const { service, recoveryRepository } = makeHarness({
      claim: null,
      cessions: [],
      participantsByCession: {},
      treatiesById: {},
      sectionsById: {},
    });
    await expect(
      service.admitRecovery(
        {
          id: 'insurer-user',
          companyId: 'company-1',
          companyType: CompanyType.INSURANCE_COMPANY,
        } as any,
        'recovery-1',
        50,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(recoveryRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects admitted recovery above the expected participant share', async () => {
    const { service, recoveryRepository } = makeHarness({
      claim: null,
      cessions: [],
      participantsByCession: {},
      treatiesById: {},
      sectionsById: {},
    });
    await expect(
      service.admitRecovery(
        {
          id: 'reinsurer-user',
          companyId: 'reinsurer-1',
          companyType: CompanyType.REINSURANCE_COMPANY,
        } as any,
        'recovery-1',
        101,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(recoveryRepository.save).not.toHaveBeenCalled();
  });

  it('does not allow a reinsurer to record a cedant receipt', async () => {
    const { service } = makeHarness({
      claim: null,
      cessions: [],
      participantsByCession: {},
      treatiesById: {},
      sectionsById: {},
    });
    await expect(
      service.recordReceipt(
        {
          id: 'reinsurer-user',
          companyId: 'reinsurer-1',
          companyType: CompanyType.REINSURANCE_COMPANY,
        } as any,
        'recovery-1',
        { amount: 50 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
