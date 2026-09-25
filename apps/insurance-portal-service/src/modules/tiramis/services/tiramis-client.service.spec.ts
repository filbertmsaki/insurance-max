import { of } from 'rxjs';

import { TiramisClientService } from './tiramis-client.service';
import { TIRAMIS_MESSAGE_PATTERNS } from '../constants/tiramis-message-patterns.constant';

describe('TiramisClientService', () => {
  const createService = () =>
    new TiramisClientService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any;

  it('strips portal-only callback URL fields from motor submit payloads', () => {
    const service = createService();

    const payload = service.httpPayload(TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR, {
      payload: {
        companyCode: 'COMPANY',
        systemCode: 'SYSTEM',
        insurerCompanyCode: 'INSURER',
        tranCompanyCode: 'TRANS',
        salePointCode: 'SP500',
        callbackUrl: 'https://portal.example.test/callback',
        callback_url: 'https://portal.example.test/callback-legacy',
        coverNoteNumber: 'CN-001',
      },
    });

    expect(payload).toEqual({
      salePointCode: 'SP500',
      coverNoteNumber: 'CN-001',
    });
  });

  it('extracts readable validation messages from nested error objects', () => {
    const service = createService();

    expect(
      service.extractValidationErrors({
        error: {
          errors: [{ message: 'salePointCode is required' }],
        },
      }),
    ).toEqual(['salePointCode is required']);
  });

  it('keeps non-submission payloads unchanged', () => {
    const service = createService();
    const command = {
      callbackUrl: 'https://portal.example.test/callback',
      requestId: 'REQ-001',
    };

    expect(service.httpPayload(TIRAMIS_MESSAGE_PATTERNS.STATUS, command)).toBe(
      command,
    );
  });

  it('checks service health against the environment the company activated', async () => {
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        serviceApiKeyEncrypted: 'encrypted-live-key',
        baseUrl: 'https://tiramis.example.test',
        sourceService: 'insurance-portal-service',
      }),
    };
    const httpService = {
      request: jest.fn().mockReturnValue(of({ status: 200, data: {} })),
    };
    const organizationContextService = {
      resolveCompanyTiramisEnvironment: jest.fn().mockResolvedValue('live'),
    };
    const service = new TiramisClientService(
      httpService as any,
      // Service-wide default stays on test; the company has activated live.
      { get: jest.fn().mockReturnValue('test') } as any,
      { getRequestId: jest.fn(), getCorrelationId: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      organizationContextService as any,
      {} as any,
      { decrypt: jest.fn().mockReturnValue('live-api-key') } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as any,
    );

    await service.checkTiramisServiceHealth({
      scope: 'company',
      companyId: 'company-1',
    });

    expect(
      organizationContextService.resolveCompanyTiramisEnvironment,
    ).toHaveBeenCalledWith('company-1');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'configuration.environment = :environment',
      { environment: 'live' },
    );
    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'live-api-key' }),
      }),
    );
  });
});
