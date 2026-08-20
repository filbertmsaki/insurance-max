import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TiramisConfigService } from './tiramis-config.service';

describe('TiramisConfigService organization context resolution', () => {
  const configuration = {
    id: 'config-1',
    environment: 'test',
    companyCode: 'COMP-A',
    systemCode: 'SYS-A',
    insurerCompanyCode: 'INS-A',
    tranCompanyCode: 'INS-A',
    callbackBaseUrl: 'https://example.test',
  };

  let clientConfigurationRepository: { findOne: jest.Mock };
  let requestContextService: { getServicePrincipal: jest.Mock };
  let service: TiramisConfigService;

  beforeEach(() => {
    clientConfigurationRepository = {
      findOne: jest.fn().mockResolvedValue(configuration),
    };
    requestContextService = { getServicePrincipal: jest.fn() };

    service = new (TiramisConfigService as any)(
      clientConfigurationRepository,
      {},
      {},
      {},
      {},
      { get: jest.fn() },
      requestContextService,
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
        environment: 'test',
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
          environment: 'test',
          companyCode: 'COMP-A',
          systemCode: 'SYS-A',
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
          environment: 'test',
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
        environment: 'test',
        insurerCompanyCode: 'INS-A',
      },
    });

    const result = await service.resolveSubmissionContext(
      {
        environment: 'live',
        companyCode: 'COMP-OTHER-CLIENT',
        systemCode: 'SYS-OTHER-CLIENT',
      },
      'record-1',
    );

    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
    expect(result.configuration).toBe(configuration);
    expect(clientConfigurationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          environment: 'test',
          companyCode: 'COMP-A',
          systemCode: 'SYS-A',
        }),
      }),
    );
  });

  it('does not reject incoming insurerCompanyCode because it is business context, not authentication', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: {
        companyId: 'company-a',
        companyCode: 'COMP-A',
        systemCode: 'SYS-A',
        environment: 'test',
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
        environment: 'test',
        insurerCompanyCode: 'INS-A',
      },
    });

    const result = await service.resolveSubmissionContext({}, 'record-1');

    expect(result.dto.insurerCompanyCode).toBe('INS-A');
    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
    expect(result.configuration).toBe(configuration);
  });
});

describe('TiramisConfigService certificate validation', () => {
  const baseConfiguration = {
    id: 'config-1',
    environment: 'live',
    companyCode: 'ICC110',
    systemCode: 'LSYS_ALLIANCE_003',
    clientCode: 'ICC110',
    clientKey: '(encrypted)',
    clientKeyEncrypted: 'enc-client-key',
    clientPrivateCertificatePath: 'client.pfx',
    clientPrivateCertificatePassword: null,
    clientPrivateCertificatePasswordEncrypted: null,
    tiraPublicCertificatePath: 'tira.cer',
    tiraPublicCertificatePassword: null,
    tiraPublicCertificatePasswordEncrypted: null,
  };

  function createService() {
    const certificateInspector = {
      assertCertificateHealthy: jest.fn(),
    };
    const secretCrypto = {
      decryptIfEncrypted: jest.fn((value) =>
        value ? `decrypted:${String(value)}` : null,
      ),
      mask: jest.fn((value) => (value ? '***masked***' : null)),
    };

    const service = new (TiramisConfigService as any)(
      { findOne: jest.fn() },
      {},
      {},
      secretCrypto,
      certificateInspector,
      { get: jest.fn() },
      { getServicePrincipal: jest.fn() },
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

  it('still rejects an expired client private certificate even when the override is enabled', async () => {
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

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Client private certificate has expired on 2026-03-03T18:50:06.000Z',
    );
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
      {
        ...baseConfiguration,
        clientKey: null,
        clientKeyEncrypted: null,
      } as any,
      { allowExpiredCertificates: true },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('ClientKey is missing');
  });
});
