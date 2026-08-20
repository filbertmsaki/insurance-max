import { CompanyTiramisConfigurationService } from './company-tiramis-configuration.service';

describe('CompanyTiramisConfigurationService', () => {
  function createService() {
    const repository = {
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
    };

    const tiramisClientService = {
      validateOrganizationConfiguration: jest.fn(),
    };

    const service = new CompanyTiramisConfigurationService(
      repository as any,
      {} as any,
      tiramisClientService as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    return {
      service,
      repository,
      tiramisClientService,
    };
  }

  it('uses the stored allowExpiredCertificates flag when validation is requested without an override', async () => {
    const { service, repository, tiramisClientService } = createService();
    repository.findOne.mockResolvedValue({
      id: 'config-1',
      companyId: 'company-1',
      environment: 'live',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      insurerCompanyCode: 'ICC110',
      allowExpiredCertificates: true,
      isActive: true,
    });
    tiramisClientService.validateOrganizationConfiguration.mockResolvedValue({
      valid: true,
      message: 'TIRAMIS organization configuration is valid.',
      warnings: [
        'TIRA public certificate expired on 2026-03-03T18:50:06.000Z, but expiry validation was explicitly allowed.',
      ],
      certificates: {
        tiraPublic: {
          isExpired: true,
          validTo: '2026-03-03T18:50:06.000Z',
        },
      },
    });

    const result = await service.validate('company-1', 'live');

    expect(
      tiramisClientService.validateOrganizationConfiguration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExpiredCertificates: true,
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStatus: 'VALID',
        validationMessage:
          'Configuration validated with warning: TIRA public certificate expired on 2026-03-03T18:50:06.000Z, but expiry validation was explicitly allowed.',
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('keeps an expired certificate invalid when the flag is not explicitly enabled', async () => {
    const { service, repository, tiramisClientService } = createService();
    repository.findOne.mockResolvedValue({
      id: 'config-1',
      companyId: 'company-1',
      environment: 'live',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      insurerCompanyCode: 'ICC110',
      allowExpiredCertificates: false,
      isActive: true,
    });
    tiramisClientService.validateOrganizationConfiguration.mockResolvedValue({
      valid: false,
      message:
        'TIRA public certificate has expired on 2026-03-03T18:50:06.000Z',
      warnings: [],
      certificates: {
        tiraPublic: {
          isExpired: true,
          validTo: '2026-03-03T18:50:06.000Z',
        },
      },
    });

    const result = await service.validate('company-1', 'live');

    expect(
      tiramisClientService.validateOrganizationConfiguration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExpiredCertificates: false,
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStatus: 'INVALID',
        validationMessage:
          'TIRA public certificate has expired on 2026-03-03T18:50:06.000Z',
      }),
    );
    expect(result.valid).toBe(false);
  });
});
