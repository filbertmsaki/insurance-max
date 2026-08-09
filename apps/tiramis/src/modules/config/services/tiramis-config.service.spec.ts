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

  it('uses incoming DTO organization context when service context is absent', async () => {
    requestContextService.getServicePrincipal.mockReturnValue(undefined);

    const result = await service.resolveSubmissionContext(
      {
        environment: 'test',
        companyCode: 'COMP-A',
        systemCode: 'SYS-A',
        insurerCompanyCode: 'INS-B-FROM-REQUEST',
      },
      'record-1',
    );

    expect(result.dto.insurerCompanyCode).toBe('INS-B-FROM-REQUEST');
    expect(result.dto.companyCode).toBe('COMP-A');
    expect(result.dto.systemCode).toBe('SYS-A');
    expect(result.configuration).toBe(configuration);
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
