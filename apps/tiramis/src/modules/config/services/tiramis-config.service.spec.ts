import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { TiramisConfigService } from './tiramis-config.service';
import { TiramisSystemProfileService } from './tiramis-system-profile.service';

/** Profile service with no stored profiles, so values come from env. */
function envOnlyProfiles(secretCrypto: any, configService: any) {
  return new TiramisSystemProfileService(
    { findOne: jest.fn().mockResolvedValue(null) } as any,
    secretCrypto,
    configService,
  );
}

describe('TiramisConfigService organization context resolution', () => {
  const configuration = {
    id: 'config-1',
    environment: 'uat',
    companyCode: 'COMP-A',
    systemCode: 'SYS-A',
    insurerCompanyCode: 'INS-A',
    tranCompanyCode: 'INS-A',
    callbackBaseUrl: 'https://example.test',
  };

  let clientConfigurationRepository: { findOne: jest.Mock };
  let requestContextService: { getServicePrincipal: jest.Mock };
  let service: TiramisConfigService;
  let configGet: jest.Mock;

  beforeEach(() => {
    clientConfigurationRepository = {
      findOne: jest.fn().mockResolvedValue(configuration),
    };
    requestContextService = { getServicePrincipal: jest.fn() };
    configGet = jest.fn((key: string) => {
      const values: Record<string, string> = {
        TIRAMIS_BASE_URL: 'https://tira.uat',
        'tiramisService.url': 'https://tiramis.example.com',
        TIRAMIS_CERTIFICATE_BASE_DIR: '/opt/apps/tiramis/certificates',
        TIRA_ENV: 'uat',
        TIRA_CLIENT_CODE: 'CLIENT-PLATFORM',
        TIRA_CLIENT_KEY: 'uat-client-key',
        TIRA_SYSTEM_CODE: 'SYS-A',
        TIRA_SYSTEM_NAME: 'Platform System',
        TIRA_CLIENT_CERT_PASSWORD: 'uat-private-password',
        TIRA_PUBLIC_CERT_PASSWORD: 'uat-public-password',
      };
      return values[key];
    });

    service = new (TiramisConfigService as any)(
      clientConfigurationRepository,
      {},
      {},
      { decryptIfEncrypted: (value: string | null) => value || null },
      {},
      { get: configGet },
      requestContextService,
      envOnlyProfiles(
        { decryptIfEncrypted: (value: string | null) => value || null },
        { get: configGet },
      ),
    );
  });

  it('rejects when no organization business context is present', async () => {
    requestContextService.getServicePrincipal.mockReturnValue(undefined);

    await expect(
      service.resolveSubmissionContext({}, 'record-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when organization context is missing companyCode/systemCode', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: { companyId: 'company-a' },
    });

    await expect(
      service.resolveSubmissionContext({}, 'record-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves configuration from service business context', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: {
        companyId: 'company-a',
        companyCode: 'COMP-A',
        systemCode: 'SYS-A',
        environment: 'uat',
        insurerCompanyCode: 'INS-A',
      },
    });
    clientConfigurationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resolveSubmissionContext({}, 'record-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(clientConfigurationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          environment: 'uat',
          companyCode: 'COMP-A',
          isActive: 1,
        }),
      }),
    );
  });

  it('never trusts incoming DTO organization context when there is no authenticated principal', async () => {
    requestContextService.getServicePrincipal.mockReturnValue(undefined);

    await expect(
      service.resolveSubmissionContext(
        {
          environment: 'uat',
          companyCode: 'COMP-A',
          systemCode: 'SYS-A',
          insurerCompanyCode: 'INS-B-FROM-REQUEST',
        },
        'record-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(clientConfigurationRepository.findOne).not.toHaveBeenCalled();
  });

  it('never trusts incoming DTO companyCode/systemCode/environment even when a principal is present', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: {
        companyId: 'company-a',
        companyCode: 'COMP-A',
        systemCode: 'SYS-A',
        environment: 'uat',
        insurerCompanyCode: 'INS-A',
      },
    });

    const result = await service.resolveSubmissionContext(
      {
        environment: 'production',
        companyCode: 'COMP-OTHER-CLIENT',
        systemCode: 'SYS-OTHER-CLIENT',
      },
      'record-1',
    );

    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
    expect(result.configuration).toMatchObject({
      id: configuration.id,
      baseUrl: 'https://tira.uat',
    });
    expect(clientConfigurationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          environment: 'uat',
          companyCode: 'COMP-A',
        }),
      }),
    );
    const where = clientConfigurationRepository.findOne.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('systemCode');
  });

  it('does not reject incoming insurerCompanyCode because it is business context, not authentication', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: {
        companyId: 'company-a',
        companyCode: 'COMP-A',
        systemCode: 'SYS-A',
        environment: 'uat',
        insurerCompanyCode: 'INS-A',
      },
    });

    const result = await service.resolveSubmissionContext(
      { insurerCompanyCode: 'INS-B-FROM-REQUEST' },
      'record-1',
    );

    expect(result.dto.insurerCompanyCode).toBe('INS-B-FROM-REQUEST');
    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
  });

  it('uses service context values when the caller does not provide business codes', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: {
        companyId: 'company-a',
        companyCode: 'COMP-A',
        systemCode: 'SYS-A',
        environment: 'uat',
        insurerCompanyCode: 'INS-A',
      },
    });

    const result = await service.resolveSubmissionContext({}, 'record-1');

    expect(result.dto.insurerCompanyCode).toBe('INS-A');
    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
    expect(result.configuration).toMatchObject({
      id: configuration.id,
      baseUrl: 'https://tira.uat',
    });
  });

  it('gives every company the same platform system identity but its own company codes', async () => {
    const companyB = {
      ...configuration,
      id: 'config-2',
      companyCode: 'COMP-B',
      insurerCompanyCode: 'INS-B',
      tranCompanyCode: 'INS-B',
    };
    clientConfigurationRepository.findOne
      .mockResolvedValueOnce(configuration)
      .mockResolvedValueOnce(companyB);

    const a = await service.getActiveConfiguration({
      environment: 'uat',
      companyCode: 'COMP-A',
    });
    const b = await service.getActiveConfiguration({
      environment: 'uat',
      companyCode: 'COMP-B',
    });

    for (const resolved of [a, b]) {
      expect(resolved).toMatchObject({
        systemCode: 'SYS-A',
        systemName: 'Platform System',
        clientCode: 'CLIENT-PLATFORM',
        clientKey: 'uat-client-key',
        baseUrl: 'https://tira.uat',
      });
    }
    expect(a.companyCode).toBe('COMP-A');
    expect(b.companyCode).toBe('COMP-B');
    expect(b.insurerCompanyCode).toBe('INS-B');
  });

  it('rejects a system code that does not match the platform system code', async () => {
    await expect(
      service.getActiveConfiguration({
        environment: 'uat',
        companyCode: 'COMP-A',
        systemCode: 'SYS-OTHER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('builds TIRA request headers from the platform client identity', async () => {
    await expect(service.getRequestHeaders('local')).resolves.toEqual({
      'Content-Type': 'application/xml',
      ClientCode: 'CLIENT-PLATFORM',
      ClientKey: 'uat-client-key',
    });
  });
});

describe('TiramisConfigService certificate validation', () => {
  const baseConfiguration = {
    id: 'config-1',
    environment: 'production',
    companyCode: 'ICC739',
    systemCode: 'LSYS_DEMO_482',
    clientCode: 'ICC739',
    clientKey: '(encrypted)',
    clientKeyEncrypted: 'enc-client-key',
    clientPrivateCertificatePath: 'client.pfx',
    clientPrivateCertificatePassword: null,
    clientPrivateCertificatePasswordEncrypted: null,
    tiraPublicCertificatePath: 'tira.cer',
    tiraPublicCertificatePassword: null,
    tiraPublicCertificatePasswordEncrypted: null,
  };

  function createService(
    envOverrides: Record<string, string | undefined> = {},
  ) {
    const certificateInspector = {
      assertCertificateHealthy: jest.fn(),
    };
    const secretCrypto = {
      decryptIfEncrypted: jest.fn((value) =>
        value ? `decrypted:${String(value)}` : null,
      ),
      mask: jest.fn((value) => (value ? '***masked***' : null)),
    };
    const configGet = jest.fn((key: string) => {
      const values: Record<string, string | undefined> = {
        TIRAMIS_BASE_URL: 'https://tira.production',
        'tiramisService.url': 'https://tiramis.example.com',
        TIRAMIS_CERTIFICATE_BASE_DIR: '/opt/apps/tiramis/certificates',
        TIRA_ENV: 'production',
        TIRA_CLIENT_CODE: 'CLIENT-PLATFORM',
        TIRA_CLIENT_KEY: 'production-client-key',
        TIRA_SYSTEM_CODE: 'LSYS_DEMO_482',
        TIRA_CLIENT_CERT_PASSWORD: 'production-private-password',
        TIRA_PUBLIC_CERT_PASSWORD: 'production-public-password',
        ...envOverrides,
      };
      return values[key];
    });

    const service = new (TiramisConfigService as any)(
      { findOne: jest.fn() },
      {},
      {},
      secretCrypto,
      certificateInspector,
      { get: configGet },
      { getServicePrincipal: jest.fn() },
      envOnlyProfiles(secretCrypto, { get: configGet }),
    ) as TiramisConfigService;

    return { service, certificateInspector };
  }

  it('accepts healthy certificates regardless of allowExpiredCertificates', async () => {
    const { service, certificateInspector } = createService();
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      })
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      });

    const result = await service.validateConfigurationSecurity(
      baseConfiguration as any,
      { allowExpiredCertificates: false },
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects an expired TIRA public certificate when the override is disabled', async () => {
    const { service, certificateInspector } = createService();
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      })
      .mockReturnValueOnce({
        validTo: '2026-03-03T18:50:06.000Z',
        isExpired: true,
        isExpiringSoon: false,
      });

    const result = await service.validateConfigurationSecurity(
      baseConfiguration as any,
      { allowExpiredCertificates: false },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'TIRA public certificate has expired on 2026-03-03T18:50:06.000Z',
    );
  });

  it('accepts an expired TIRA public certificate with a warning when the override is enabled', async () => {
    const { service, certificateInspector } = createService();
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      })
      .mockReturnValueOnce({
        validTo: '2026-03-03T18:50:06.000Z',
        isExpired: true,
        isExpiringSoon: false,
      });

    const result = await service.validateConfigurationSecurity(
      baseConfiguration as any,
      { allowExpiredCertificates: true },
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain(
      'TIRA public certificate expired on 2026-03-03T18:50:06.000Z, but expiry validation was explicitly allowed.',
    );
  });

  it('accepts an expired client private certificate with a warning when the override is enabled', async () => {
    const { service, certificateInspector } = createService();
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-03-03T18:50:06.000Z',
        isExpired: true,
        isExpiringSoon: false,
      })
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      });

    const result = await service.validateConfigurationSecurity(
      baseConfiguration as any,
      { allowExpiredCertificates: true },
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain(
      'Client private certificate expired on 2026-03-03T18:50:06.000Z, but expiry validation was explicitly allowed.',
    );
  });

  it('honours TIRA_ALLOW_EXPIRED_CERTIFICATES as a validated boolean when no override is given', async () => {
    // Joi turns the env flag into a real boolean before it reaches config.
    const { service, certificateInspector } = createService({
      TIRA_ALLOW_EXPIRED_CERTIFICATES: true as unknown as string,
    });
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      })
      .mockReturnValueOnce({
        validTo: '2026-03-03T18:50:06.000Z',
        isExpired: true,
        isExpiringSoon: false,
      });

    const result = await service.validateConfigurationSecurity(
      baseConfiguration as any,
    );

    expect(result.ok).toBe(true);
    expect(result.allowExpiredCertificates).toBe(true);
  });

  it('rejects a corrupted TIRA public certificate even when the override is enabled', async () => {
    const { service, certificateInspector } = createService();
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      })
      .mockImplementationOnce(() => {
        throw new BadRequestException('TIRA public certificate is invalid');
      });

    const result = await service.validateConfigurationSecurity(
      baseConfiguration as any,
      { allowExpiredCertificates: true },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('TIRA public certificate is invalid');
  });

  it('rejects a missing client key regardless of allowExpiredCertificates', async () => {
    const { service, certificateInspector } = createService({
      TIRA_CLIENT_KEY: '',
    });
    certificateInspector.assertCertificateHealthy
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      })
      .mockReturnValueOnce({
        validTo: '2026-12-31T00:00:00.000Z',
        isExpired: false,
        isExpiringSoon: false,
      });

    const result = await service.validateConfigurationSecurity(
      {
        ...baseConfiguration,
        clientKey: null,
        clientKeyEncrypted: null,
      } as any,
      { allowExpiredCertificates: true },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'ClientKey is not configured (set TIRA_CLIENT_KEY)',
    );
  });
});
