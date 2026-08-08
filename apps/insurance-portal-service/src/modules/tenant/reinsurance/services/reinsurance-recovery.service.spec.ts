import {
  ReinsuranceCessionStatus,
  TreatyForm,
} from '../enums/reinsurance.enums';
import { ReinsuranceRecoveryService } from './reinsurance-recovery.service';

function makeHarness(params: {
  claim: any;
  cessions: any[];
  participantsByCession: Record<string, any[]>;
  treatiesById: Record<string, any>;
  sectionsById: Record<string, any>;
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

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
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
            save: jest.fn().mockImplementation(async (value: any) => value),
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
    {} as any, // recoveryRepository (unused directly, only via manager)
    {} as any, // treatyRepository (unused directly, only via manager)
    {} as any, // sectionRepository (unused directly, only via manager)
    referenceService as any,
  );

  return { service };
}

describe('ReinsuranceRecoveryService.calculateRecoveries', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;

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
