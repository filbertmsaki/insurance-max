import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

import {
  ReinsuranceAccountStatus,
  ReinsuranceBordereauStatus,
  ReinsuranceBordereauType,
} from '../enums/reinsurance.enums';
import { ReinsuranceAccountingService } from './reinsurance-accounting.service';

function makeQueryBuilder(rows: any[]) {
  const qb: any = {};
  ['innerJoin', 'select', 'addSelect', 'where', 'andWhere'].forEach(
    (method) => {
      qb[method] = jest.fn().mockReturnValue(qb);
    },
  );
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return qb;
}

function makeRepository() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) =>
      Array.isArray(value)
        ? value
        : {
            id: value.id ?? 'saved-id',
            ...value,
          },
    ),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

function makeService(rows: any[]) {
  const bordereauRepository = makeRepository();
  const bordereauItemRepository = makeRepository();
  const premiumAccountRepository = makeRepository();
  const premiumAccountItemRepository = makeRepository();
  const cessionParticipantRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(rows)),
  };
  const scopeService = {
    resolve: jest.fn().mockReturnValue({ companyId: 'company-1' }),
  };
  const referenceService = {
    next: jest.fn(async ({ documentType }: { documentType: string }) =>
      documentType === 'REINSURANCE_BORDEREAU'
        ? 'RIB-2026-000001'
        : 'RIA-2026-000001',
    ),
  };

  bordereauRepository.findOne.mockImplementation(async ({ where }: any) => ({
    id: where.id,
    company_id: where.company_id,
    status: ReinsuranceBordereauStatus.GENERATED,
    items: [],
  }));
  premiumAccountRepository.findOne.mockImplementation(
    async ({ where }: any) => ({
      id: where.id,
      company_id: where.company_id,
      status: ReinsuranceAccountStatus.GENERATED,
      items: [],
    }),
  );

  const service = new ReinsuranceAccountingService(
    bordereauRepository as any,
    bordereauItemRepository as any,
    premiumAccountRepository as any,
    premiumAccountItemRepository as any,
    cessionParticipantRepository as any,
    scopeService as any,
    referenceService as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
  );

  return {
    service,
    bordereauRepository,
    bordereauItemRepository,
    premiumAccountRepository,
    premiumAccountItemRepository,
    scopeService,
  };
}

describe('ReinsuranceAccountingService', () => {
  const user = {
    id: 'user-1',
    companyId: 'company-1',
    activeBranchId: 'branch-1',
  } as any;

  const sourceRows = [
    {
      cession_id: 'cession-1',
      participant_id: 'participant-1',
      policy_id: 'policy-1',
      cession_no: 'CES-1',
      treaty_id: 'treaty-1',
      branch_id: 'branch-1',
      participant_company_id: 'reinsurer-1',
      reinsurance_broker_company_id: null,
      currency: 'TZS',
      gross_sum_insured: '100000.00',
      ceded_sum_insured: '60000.00',
      gross_premium: '1000.00',
      ceded_premium_share: '600.00',
      reinsurance_commission: '10.00',
      brokerage_commission: '2.50',
    },
  ];

  it('generates a bordereau from active cession participant rows', async () => {
    const { service, bordereauRepository, bordereauItemRepository } =
      makeService(sourceRows);

    await service.generateBordereau(user, {
      bordereau_type: ReinsuranceBordereauType.PREMIUM,
      treaty_id: 'treaty-1',
      participant_company_id: 'reinsurer-1',
      period_from: '2026-01-01',
      period_to: '2026-01-31',
      currency: 'TZS',
    });

    expect(bordereauRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bordereau_no: 'RIB-2026-000001',
        gross_sum_insured: '100000.00',
        ceded_sum_insured: '60000.00',
        ceded_premium: '600.00',
        commission_amount: '60.00',
        brokerage_amount: '15.00',
        status: ReinsuranceBordereauStatus.GENERATED,
      }),
    );
    expect(bordereauItemRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        reference_number: 'CES-1',
        commission_amount: '60.00',
        brokerage_amount: '15.00',
      }),
    ]);
  });

  it('generates a premium account net of reinsurance and brokerage commission', async () => {
    const { service, premiumAccountRepository, premiumAccountItemRepository } =
      makeService(sourceRows);

    await service.generatePremiumAccount(user, {
      treaty_id: 'treaty-1',
      participant_company_id: 'reinsurer-1',
      period_from: '2026-01-01',
      period_to: '2026-01-31',
      currency: 'TZS',
      tax_amount: '5.00',
      other_adjustments: '-10.00',
    });

    expect(premiumAccountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        account_no: 'RIA-2026-000001',
        gross_ceded_premium: '600.00',
        reinsurance_commission: '60.00',
        brokerage_commission: '15.00',
        net_premium_due: '520.00',
        outstanding_amount: '520.00',
        status: ReinsuranceAccountStatus.GENERATED,
      }),
    );
    expect(premiumAccountItemRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        gross_ceded_premium: '600.00',
        net_premium_due: '525.00',
      }),
    ]);
  });

  it('rejects generation when there are no source cessions', async () => {
    const { service } = makeService([]);

    await expect(
      service.generateBordereau(user, {
        bordereau_type: ReinsuranceBordereauType.RISK,
        period_from: '2026-01-01',
        period_to: '2026-01-31',
        currency: 'TZS',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets only the participating reinsurer confirm a submitted account', async () => {
    const { service, premiumAccountRepository, scopeService } = makeService([]);
    scopeService.resolve.mockReturnValue({ companyId: 'reinsurer-1' });
    premiumAccountRepository.findOne.mockResolvedValue({
      id: 'account-1',
      company_id: 'cedant-1',
      participant_company_id: 'reinsurer-1',
      status: ReinsuranceAccountStatus.SUBMITTED,
    });
    const reinsurer = {
      id: 'reinsurer-user',
      companyId: 'reinsurer-1',
      companyType: CompanyType.REINSURANCE_COMPANY,
    } as any;

    const result = await service.confirmPremiumAccount(reinsurer, 'account-1');
    expect(result.status).toBe(ReinsuranceAccountStatus.CONFIRMED);
    expect(result.confirmed_by).toBe('reinsurer-user');
    expect(result.confirmed_at).toBeInstanceOf(Date);
  });

  it('records a reason when the reinsurer disputes a premium account', async () => {
    const { service, premiumAccountRepository, scopeService } = makeService([]);
    scopeService.resolve.mockReturnValue({ companyId: 'reinsurer-1' });
    premiumAccountRepository.findOne.mockResolvedValue({
      id: 'account-1',
      company_id: 'cedant-1',
      participant_company_id: 'reinsurer-1',
      status: ReinsuranceAccountStatus.SUBMITTED,
    });

    const result = await service.respondPremiumAccount(
      {
        id: 'reinsurer-user',
        companyId: 'reinsurer-1',
        companyType: CompanyType.REINSURANCE_COMPANY,
      } as any,
      'account-1',
      {
        decision: 'DISPUTE',
        note: 'Premium total does not match the bordereau',
      },
    );
    expect(result.status).toBe(ReinsuranceAccountStatus.DISPUTED);
    expect(result.response_note).toContain('does not match');
  });

  it('does not allow the cedant or a broker to acknowledge its own premium account', async () => {
    const { service, premiumAccountRepository } = makeService([]);
    await expect(
      service.confirmPremiumAccount(
        { ...user, companyType: CompanyType.INSURANCE_COMPANY },
        'account-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(premiumAccountRepository.findOne).not.toHaveBeenCalled();
  });
});
