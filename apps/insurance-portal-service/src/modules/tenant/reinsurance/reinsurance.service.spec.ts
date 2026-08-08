import { BadRequestException, ConflictException } from '@nestjs/common';

import {
  TreatyParticipantStatus,
  TreatyStatus,
} from './enums/reinsurance.enums';
import { ReinsuranceService } from './reinsurance.service';

function makeQueryBuilder(overrides: Record<string, any>) {
  const qb: any = {};
  ['where', 'andWhere', 'select', 'addSelect', 'groupBy', 'orderBy'].forEach(
    (method) => {
      qb[method] = jest.fn().mockReturnValue(qb);
    },
  );
  Object.assign(qb, overrides);
  return qb;
}

function makeService(params: {
  treaty: any;
  shareRows: Array<{ sectionId: string | null; share: string }>;
}) {
  const treatyRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(
      makeQueryBuilder({
        getOne: jest.fn().mockResolvedValue(params.treaty),
      }),
    ),
    save: jest.fn().mockImplementation(async (value: any) => value),
  };

  const treatyParticipantRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(
      makeQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue(params.shareRows),
      }),
    ),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const scopeService = {
    resolve: jest.fn().mockReturnValue({ companyId: 'company-1' }),
    applyOwnedRecordWriteScope: jest.fn(),
  };

  const service = new ReinsuranceService(
    {} as any, // dataSource
    treatyRepository as any,
    {} as any, // sectionRepository
    treatyParticipantRepository as any,
    {} as any, // placementRepository
    {} as any, // offerRepository
    {} as any, // cessionRepository
    {} as any, // cessionParticipantRepository
    {} as any, // declarationRepository
    {} as any, // policyRepository
    {} as any, // policyRiskRepository
    {} as any, // companyRepository
    scopeService as any,
    {} as any, // referenceService
    {} as any, // tiramisSubmitService
    {} as any, // workItemsService
    {} as any, // notificationsService
    {} as any, // auditService
    {} as any, // capacityService
  );

  return { service, treatyRepository, treatyParticipantRepository };
}

describe('ReinsuranceService.activateTreaty', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;

  it('rejects activation when participant shares do not total 100%', async () => {
    const { service } = makeService({
      treaty: { id: 'treaty-1', status: TreatyStatus.APPROVED },
      shareRows: [{ sectionId: null, share: '90' }],
    });

    await expect(
      service.activateTreaty(user, 'treaty-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects activation when a treaty has no participants at all', async () => {
    const { service } = makeService({
      treaty: { id: 'treaty-1', status: TreatyStatus.APPROVED },
      shareRows: [],
    });

    await expect(
      service.activateTreaty(user, 'treaty-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates a treaty once every section totals exactly 100%', async () => {
    const { service, treatyRepository, treatyParticipantRepository } =
      makeService({
        treaty: { id: 'treaty-1', status: TreatyStatus.APPROVED },
        shareRows: [{ sectionId: null, share: '100.0000000000' }],
      });

    const result = await service.activateTreaty(user, 'treaty-1');

    expect(result.status).toBe(TreatyStatus.ACTIVE);
    expect(treatyParticipantRepository.update).toHaveBeenCalledWith(
      { treaty_id: 'treaty-1', status: TreatyParticipantStatus.INVITED },
      { status: TreatyParticipantStatus.ACTIVE },
    );
    expect(treatyRepository.save).toHaveBeenCalled();
  });

  it('still enforces the status check once the shares check passes', async () => {
    const { service } = makeService({
      treaty: { id: 'treaty-1', status: TreatyStatus.DRAFT },
      shareRows: [{ sectionId: null, share: '100' }],
    });

    await expect(
      service.activateTreaty(user, 'treaty-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
