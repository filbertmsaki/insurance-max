import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TiramisConfigService } from './tiramis-config.service';

describe('TiramisConfigService — cross-company rejection', () => {
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

  it('rejects when no signed tenant context is present on the service principal', async () => {
    requestContextService.getServicePrincipal.mockReturnValue(undefined);

    await expect(
      service.resolveSubmissionContext({}, 'record-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the signed tenant context is missing companyCode/systemCode/environment', async () => {
    requestContextService.getServicePrincipal.mockReturnValue({
      serviceId: 'svc-1',
      scopes: [],
      tenant: { companyId: 'company-a' },
    });

    await expect(
      service.resolveSubmissionContext({}, 'record-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves the configuration scoped to the signed company/system, never a mismatched one', async () => {
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

  it('rejects when the incoming DTO insurerCompanyCode conflicts with the signed tenant context (one company cannot submit under another company’s code)', async () => {
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

    await expect(
      service.resolveSubmissionContext(
        { insurerCompanyCode: 'INS-B-FROM-ANOTHER-COMPANY' },
        'record-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('overrides the resolved dto with the signed tenant insurerCompanyCode rather than trusting the caller-supplied value', async () => {
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
      { insurerCompanyCode: 'INS-A' },
      'record-1',
    );

    expect(result.dto.insurerCompanyCode).toBe('INS-A');
    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
    expect(result.configuration).toBe(configuration);
  });
});
