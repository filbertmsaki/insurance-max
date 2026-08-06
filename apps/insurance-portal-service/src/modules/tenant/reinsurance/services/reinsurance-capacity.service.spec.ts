import { NotFoundException } from '@nestjs/common';

import { TreatyForm } from '../enums/reinsurance.enums';
import { ReinsuranceCapacityService } from './reinsurance-capacity.service';

function makeQueryBuilder(getRawOneResult: { total: string }) {
  const qb: any = {};
  ['select', 'where', 'andWhere', 'innerJoin'].forEach((method) => {
    qb[method] = jest.fn().mockReturnValue(qb);
  });
  qb.getRawOne = jest.fn().mockResolvedValue(getRawOneResult);
  return qb;
}

function makeService(params: {
  treaty: any;
  section?: any;
  cededTotal?: string;
  admittedRecoveryTotal?: string;
  eligibilityRules?: any[];
}) {
  const treatyRepository = {
    findOne: jest.fn().mockResolvedValue(params.treaty),
  };

  const sectionRepository = {
    findOne: jest.fn().mockResolvedValue(params.section ?? null),
  };

  const cessionRepository = {
    createQueryBuilder: jest
      .fn()
      .mockReturnValue(
        makeQueryBuilder({ total: params.cededTotal ?? '0' }),
      ),
  };

  const recoveryRepository = {
    createQueryBuilder: jest
      .fn()
      .mockReturnValue(
        makeQueryBuilder({ total: params.admittedRecoveryTotal ?? '0' }),
      ),
  };

  const eligibilityRuleRepository = {
    find: jest.fn().mockResolvedValue(params.eligibilityRules ?? []),
  };

  const scopeService = {
    resolve: jest.fn().mockReturnValue({ companyId: 'company-1' }),
  };

  const service = new ReinsuranceCapacityService(
    treatyRepository as any,
    sectionRepository as any,
    cessionRepository as any,
    recoveryRepository as any,
    eligibilityRuleRepository as any,
    scopeService as any,
  );

  return { service };
}

describe('ReinsuranceCapacityService.evaluate', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;

  it('throws when the treaty does not exist in scope', async () => {
    const { service } = makeService({ treaty: null });

    await expect(
      service.evaluate(user, { treatyId: 'treaty-1', exposureAmount: 1000 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('computes remaining capacity for a quota-share treaty from ceded sum insured', async () => {
    const { service } = makeService({
      treaty: {
        id: 'treaty-1',
        treaty_form: TreatyForm.QUOTA_SHARE,
        total_capacity: '1000000.00',
        aggregate_limit: '0',
      },
      cededTotal: '400000.00',
    });

    const result = await service.evaluate(user, {
      treatyId: 'treaty-1',
      exposureAmount: 50000,
    });

    expect(result.availableCapacity).toBe('600000.00');
    expect(result.utilizationPercentage).toBe('40.0000');
  });

  it('computes remaining capacity for an XOL treaty from admitted recoveries against the aggregate limit', async () => {
    const { service } = makeService({
      treaty: {
        id: 'treaty-1',
        treaty_form: TreatyForm.EXCESS_OF_LOSS,
        total_capacity: '0',
        aggregate_limit: '500000.00',
      },
      admittedRecoveryTotal: '150000.00',
    });

    const result = await service.evaluate(user, {
      treatyId: 'treaty-1',
      exposureAmount: 300000,
    });

    expect(result.cededAmountToDate).toBe('150000.00');
    expect(result.availableCapacity).toBe('350000.00');
  });

  it('flags a breached sum-insured-max exclusion rule', async () => {
    const { service } = makeService({
      treaty: {
        id: 'treaty-1',
        treaty_form: TreatyForm.QUOTA_SHARE,
        total_capacity: '1000000.00',
      },
      eligibilityRules: [
        {
          id: 'rule-1',
          rule_type: 'SUM_INSURED_MAX',
          rule_value: '200000',
          is_exclusion: true,
        },
      ],
    });

    const result = await service.evaluate(user, {
      treatyId: 'treaty-1',
      exposureAmount: 500000,
    });

    expect(result.breachedRuleIds).toEqual(['rule-1']);
  });
});
