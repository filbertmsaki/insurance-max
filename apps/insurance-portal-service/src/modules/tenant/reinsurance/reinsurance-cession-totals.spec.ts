import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ReinsuranceCessionStatus,
  ReinsuranceCessionType,
  TreatyParticipantStatus,
  TreatyStatus,
} from './enums/reinsurance.enums';
import { ReinsuranceService } from './reinsurance.service';

function makeService(overrides: { dataSource?: any; cessionRepository?: any }) {
  return new ReinsuranceService(
    overrides.dataSource ?? {},
    {} as any, // treatyRepository
    {} as any, // sectionRepository
    {} as any, // treatyParticipantRepository
    {} as any, // placementRepository
    {} as any, // offerRepository
    overrides.cessionRepository ?? {},
    {} as any, // cessionParticipantRepository
    {} as any, // declarationRepository
    {} as any, // policyRepository
    {} as any, // policyRiskRepository
    {} as any, // companyRepository
    {} as any, // scopeService
    {} as any, // referenceService
    {} as any, // tiramisSubmitService
    {} as any, // workItemsService
    {} as any, // notificationsService
    {} as any, // auditService
    {} as any, // capacityService
    {} as any, // insurancePartnersService
  );
}

function cession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cession-1',
    policy_id: 'policy-1',
    policy_risk_id: 'risk-1',
    status: ReinsuranceCessionStatus.ACTIVE,
    gross_sum_insured: '1000000.00',
    gross_premium: '10000.00',
    ceded_sum_insured: '600000.00',
    ceded_premium: '6000.00',
    retention_amount: '400000.00',
    ...overrides,
  } as any;
}

describe('ReinsuranceService.combineLiveCessions', () => {
  const service = makeService({});

  it('adds separate cessions on one risk instead of replacing them', () => {
    const { policy, risks } = service.combineLiveCessions([
      cession({ id: 'treaty' }),
      cession({
        id: 'fac',
        ceded_sum_insured: '250000.00',
        ceded_premium: '2500.00',
      }),
    ]);

    expect(risks.get('risk-1')).toEqual({
      retention_amount: '150000.00',
      ceded_sum_insured: '850000.00',
      ceded_premium: '8500.00',
    });
    expect(policy).toEqual(risks.get('risk-1'));
  });

  it('refuses cessions that together cede more than 100% of a risk', () => {
    expect(() =>
      service.combineLiveCessions([
        cession({ id: 'treaty' }),
        cession({ id: 'fac', ceded_sum_insured: '400000.01' }),
      ]),
    ).toThrow(ConflictException);
  });

  it('refuses ceded premium above the gross premium', () => {
    expect(() =>
      service.combineLiveCessions([
        cession({
          id: 'a',
          ceded_sum_insured: '1.00',
          ceded_premium: '6000.00',
        }),
        cession({
          id: 'b',
          ceded_sum_insured: '1.00',
          ceded_premium: '4000.01',
        }),
      ]),
    ).toThrow(ConflictException);
  });

  it('allows exactly 100% ceded', () => {
    const { policy } = service.combineLiveCessions([
      cession({ id: 'a' }),
      cession({
        id: 'b',
        ceded_sum_insured: '400000.00',
        ceded_premium: '4000.00',
      }),
    ]);

    expect(policy.retention_amount).toBe('0.00');
  });

  it('sums per-risk totals into the policy totals', () => {
    const { policy, risks } = service.combineLiveCessions([
      cession({ id: 'a', policy_risk_id: 'risk-1' }),
      cession({
        id: 'b',
        policy_risk_id: 'risk-2',
        gross_sum_insured: '500000.00',
        gross_premium: '5000.00',
        ceded_sum_insured: '100000.00',
        ceded_premium: '1000.00',
      }),
    ]);

    expect(risks.size).toBe(2);
    expect(policy).toEqual({
      retention_amount: '800000.00',
      ceded_sum_insured: '700000.00',
      ceded_premium: '7000.00',
    });
  });

  it('refuses mixing whole-policy and per-risk cessions', () => {
    expect(() =>
      service.combineLiveCessions([
        cession({ id: 'a', policy_risk_id: null }),
        cession({ id: 'b', policy_risk_id: 'risk-1' }),
      ]),
    ).toThrow(/allocation rule is approved/);
  });

  it('counts a cession listed twice only once', () => {
    const single = cession();
    const { policy } = service.combineLiveCessions([single, single]);

    expect(policy.ceded_sum_insured).toBe('600000.00');
  });
});

describe('ReinsuranceService.applyCession', () => {
  function harness(params: { approved: any; live: any[] }) {
    const policyUpdate = jest.fn();
    const riskUpdate = jest.fn();
    const cessionSave = jest.fn(async (value) => value);
    const lockBuilder = (result: any) => {
      const builder: any = {
        setLock: jest.fn(() => builder),
        where: jest.fn(() => builder),
        getOne: jest.fn().mockResolvedValue(result),
        getOneOrFail: jest.fn().mockResolvedValue(result),
      };
      return builder;
    };
    const manager = {
      getRepository: (entity: any) => {
        switch (entity?.name) {
          case 'Policy':
            return {
              createQueryBuilder: () => lockBuilder({ id: 'policy-1' }),
              update: policyUpdate,
            };
          case 'PolicyRisk':
            return { update: riskUpdate };
          case 'PolicyCession':
            return {
              createQueryBuilder: () => lockBuilder(params.approved),
              find: jest.fn().mockResolvedValue(params.live),
              save: cessionSave,
            };
          default:
            throw new Error(`Unexpected entity ${entity?.name}`);
        }
      },
    };
    const service = makeService({
      dataSource: { transaction: jest.fn(async (fn: any) => fn(manager)) },
      cessionRepository: {
        findOneOrFail: jest.fn().mockResolvedValue(params.approved),
      },
    });
    jest
      .spyOn(service as any, 'getCessionForWrite')
      .mockResolvedValue({ ...params.approved });
    jest.spyOn(service as any, 'auditTransition').mockResolvedValue(undefined);

    return { service, policyUpdate, riskUpdate, cessionSave };
  }

  const user = { id: 'user-1', companyId: 'company-1' } as any;

  it('writes the combined totals of all live cessions to the policy and risk', async () => {
    const approved = cession({
      id: 'fac',
      status: ReinsuranceCessionStatus.APPROVED,
      ceded_sum_insured: '250000.00',
      ceded_premium: '2500.00',
    });
    const h = harness({ approved, live: [cession({ id: 'treaty' })] });

    await h.service.applyCession(user, 'fac');

    const expected = {
      retention_amount: '150000.00',
      ceded_sum_insured: '850000.00',
      ceded_premium: '8500.00',
    };
    expect(h.policyUpdate).toHaveBeenCalledWith(
      { id: 'policy-1' },
      expect.objectContaining(expected),
    );
    expect(h.riskUpdate).toHaveBeenCalledWith(
      { id: 'risk-1' },
      expect.objectContaining(expected),
    );
    expect(h.cessionSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: ReinsuranceCessionStatus.ACTIVE }),
    );
  });

  it('does not activate a cession that would over-cede the risk', async () => {
    const approved = cession({
      id: 'fac',
      status: ReinsuranceCessionStatus.APPROVED,
      ceded_sum_insured: '500000.00',
    });
    const h = harness({ approved, live: [cession({ id: 'treaty' })] });

    await expect(h.service.applyCession(user, 'fac')).rejects.toThrow(
      ConflictException,
    );
    expect(h.cessionSave).not.toHaveBeenCalled();
    expect(h.policyUpdate).not.toHaveBeenCalled();
  });

  it('re-checks the status under the row lock', async () => {
    const h = harness({
      approved: cession({ status: ReinsuranceCessionStatus.ACTIVE }),
      live: [],
    });
    jest
      .spyOn(h.service as any, 'getCessionForWrite')
      .mockResolvedValue(
        cession({ status: ReinsuranceCessionStatus.APPROVED }),
      );

    await expect(h.service.applyCession(user, 'cession-1')).rejects.toThrow(
      'Only an approved cession can be applied',
    );
    expect(h.policyUpdate).not.toHaveBeenCalled();
  });
});

describe('ReinsuranceService treaty participant reinsurance form', () => {
  function manager(section: any) {
    const participantBuilder: any = {
      where: jest.fn(() => participantBuilder),
      andWhere: jest.fn(() => participantBuilder),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'tp-1',
          participant_company_id: 'reinsurer-1',
          reinsurance_broker_company_id: null,
          participant_code: 'RE-1',
          re_broker_code: null,
          brokerage_commission_rate: '0',
          reinsurance_commission_rate: '0',
          share_percent: '100',
          status: TreatyParticipantStatus.ACTIVE,
          effective_from: null,
          effective_to: null,
        },
      ]),
    };
    return {
      getRepository: (entity: any) => {
        switch (entity?.name) {
          case 'ReinsuranceTreaty':
            return {
              findOne: jest.fn().mockResolvedValue({
                id: 'treaty-1',
                status: TreatyStatus.ACTIVE,
                effective_from: '2000-01-01',
                effective_to: '2999-12-31',
              }),
            };
          case 'ReinsuranceTreatySection':
            return { findOne: jest.fn().mockResolvedValue(section) };
          case 'ReinsuranceTreatyParticipant':
            return { createQueryBuilder: () => participantBuilder };
          default:
            throw new Error(`Unexpected entity ${entity?.name}`);
        }
      },
    };
  }

  const dto = {
    cession_type: ReinsuranceCessionType.TREATY,
    treaty_id: 'treaty-1',
    treaty_section_id: 'section-1',
  } as any;

  it('reports the section form and type (e.g. non-proportional)', async () => {
    const service = makeService({});
    const participants = await (service as any).resolveParticipantsForCession(
      manager({ id: 'section-1', reinsurance_form: 2, reinsurance_type: 3 }),
      dto,
      'company-1',
    );

    expect(participants[0]).toMatchObject({
      reinsurance_form: 2,
      reinsurance_type: 3,
    });
  });

  it('rejects a section that does not belong to the treaty', async () => {
    const service = makeService({});

    await expect(
      (service as any).resolveParticipantsForCession(
        manager(null),
        dto,
        'company-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
