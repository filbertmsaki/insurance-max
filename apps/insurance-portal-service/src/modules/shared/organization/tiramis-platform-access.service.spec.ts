import { ForbiddenException } from '@nestjs/common';

import { TiramisCompanyLinkStatus } from '../../tiramis/entities/tiramis-company-link.entity';
import { TiramisPlatformAccessService } from './tiramis-platform-access.service';

function createService(link: Record<string, unknown> | null) {
  return new TiramisPlatformAccessService(
    {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => v),
    } as any,
    { findOne: jest.fn().mockResolvedValue(null) } as any,
    { findOne: jest.fn().mockResolvedValue(link) } as any,
    { decrypt: jest.fn() } as any,
    { get: jest.fn().mockReturnValue('test') } as any,
  );
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return ((error as ForbiddenException).getResponse() as any).code;
  }
}

describe('TiramisPlatformAccessService', () => {
  it('lets a company with active access transact', async () => {
    const service = createService({ status: TiramisCompanyLinkStatus.ACTIVE });
    await expect(
      service.assertCompanyCanTransact('company-1'),
    ).resolves.toBeUndefined();
  });

  it.each([
    [null, 'TIRAMIS_ACCESS_NOT_ACTIVE'],
    [{ status: TiramisCompanyLinkStatus.LINKED }, 'TIRAMIS_ACCESS_NOT_ACTIVE'],
    [{ status: TiramisCompanyLinkStatus.REVOKED }, 'TIRAMIS_ACCESS_REVOKED'],
  ])('blocks new business when the link is %j', async (link, code) => {
    const service = createService(link);
    await expect(
      errorCode(service.assertCompanyCanTransact('company-1')),
    ).resolves.toBe(code);
  });

  it('falls back to UAT when the configured environment is unsupported', async () => {
    const service = createService(null);
    await expect(service.getActiveEnvironment()).resolves.toBe('uat');
  });
});
