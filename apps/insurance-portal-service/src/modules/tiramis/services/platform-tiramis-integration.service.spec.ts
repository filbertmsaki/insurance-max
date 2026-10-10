import { BadRequestException } from '@nestjs/common';

import { TiramisCompanyLinkStatus } from '../entities/tiramis-company-link.entity';
import { PlatformTiramisIntegrationService } from './platform-tiramis-integration.service';

function createService(
  overrides: {
    settings?: Record<string, unknown>;
    validation?: { valid: boolean; message: string };
    serviceKey?: string | null;
    link?: Record<string, unknown> | null;
    pending?: number;
  } = {},
) {
  const settings = {
    id: 'platform',
    activeEnvironment: 'uat',
    validationStatus: 'VALID',
    ...overrides.settings,
  };
  const queryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(settings),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  const settingsRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    save: jest.fn(async (value) => Object.assign(settings, value)),
  };
  const link = overrides.link ?? null;
  const linkRepository = {
    findOne: jest.fn().mockResolvedValue(link),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };
  const trackingRepository = {
    count: jest.fn().mockResolvedValue(overrides.pending ?? 0),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };
  const tiramisClientService = {
    platformAdminRequest: jest.fn(async (request: { url: string }) =>
      request.url.endsWith('/validate')
        ? (overrides.validation ?? { valid: true, message: 'Valid.' })
        : {},
    ),
  };
  const platformAccess = {
    getSettings: jest.fn().mockResolvedValue(settings),
    getActiveEnvironment: jest.fn().mockResolvedValue('uat'),
    getServiceApiKey: jest
      .fn()
      .mockResolvedValue(
        overrides.serviceKey === undefined ? 'key' : overrides.serviceKey,
      ),
  };
  const auditService = { logCritical: jest.fn() };
  const service = new PlatformTiramisIntegrationService(
    settingsRepository as any,
    linkRepository as any,
    trackingRepository as any,
    {} as any,
    platformAccess as any,
    tiramisClientService as any,
    {} as any,
    {} as any,
    auditService as any,
  );
  return { service, settings, auditService, linkRepository };
}

describe('PlatformTiramisIntegrationService', () => {
  it('reports the single server environment from TIRA_ENV', async () => {
    const { service } = createService();

    const overview = await service.getOverview();

    expect(overview.activeEnvironment).toBe('uat');
    expect(overview.environment.name).toBe('uat');
  });

  it('revokes access with a reason and reports pending submissions', async () => {
    const { service } = createService({
      link: { companyId: 'company-1', status: TiramisCompanyLinkStatus.ACTIVE },
      pending: 3,
    });

    await expect(
      service.revokeCompany('company-1', ' ', 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const result = await service.revokeCompany(
      'company-1',
      'License suspended',
      'admin',
    );
    expect(result).toMatchObject({
      status: TiramisCompanyLinkStatus.REVOKED,
      revokeReason: 'License suspended',
      pendingSubmissions: 3,
    });
  });

  it('only restores revoked access', async () => {
    const { service } = createService({
      link: { companyId: 'company-1', status: TiramisCompanyLinkStatus.ACTIVE },
    });
    await expect(
      service.restoreCompany('company-1', 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
