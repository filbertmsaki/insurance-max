import { BadRequestException, ConflictException } from '@nestjs/common';

import {
  TreatyParticipantStatus,
  TreatyStatus,
} from './enums/reinsurance.enums';
import { PartnerType } from '../insurance-partners/enums/partner-type.enum';
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
  insurancePartnersService?: { findActiveCompanyRelationship: jest.Mock };
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
    update: jest.fn().mockResolvedValue(undefined),
  };

  const scopeService = {
    resolve: jest.fn().mockReturnValue({ companyId: 'company-1' }),
    applyOwnedRecordWriteScope: jest.fn(),
  };
  const insurancePartnersService = params.insurancePartnersService ?? {
    findActiveCompanyRelationship: jest.fn(),
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
    insurancePartnersService as any,
  );

  return {
    service,
    treatyRepository,
    treatyParticipantRepository,
    insurancePartnersService,
  };
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

  it('rejects activation while external participant invitations remain unaccepted', async () => {
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
      { treaty_id: 'treaty-1', status: TreatyParticipantStatus.CONFIRMED },
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

  it('requires separate reinsurer and reinsurance-broker appointments', async () => {
    const links = {
      findActiveCompanyRelationship: jest
        .fn()
        .mockResolvedValue({ id: 'link' }),
    };
    const { service } = makeService({
      treaty: null,
      shareRows: [],
      insurancePartnersService: links,
    });

    await (service as any).assertReinsuranceRelationship(
      'insurer-1',
      'reinsurer-1',
      're-broker-1',
    );

    expect(links.findActiveCompanyRelationship).toHaveBeenNthCalledWith(
      1,
      'insurer-1',
      'reinsurer-1',
      PartnerType.REINSURANCE_COMPANY,
    );
    expect(links.findActiveCompanyRelationship).toHaveBeenNthCalledWith(
      2,
      'insurer-1',
      're-broker-1',
      PartnerType.REINSURANCE_BROKER,
    );
    expect(links.findActiveCompanyRelationship).toHaveBeenNthCalledWith(
      3,
      'reinsurer-1',
      're-broker-1',
      PartnerType.REINSURANCE_BROKER,
    );
  });
});
