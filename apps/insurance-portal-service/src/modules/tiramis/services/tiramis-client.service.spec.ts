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

  it('always sends the portal webhook URL in submission source metadata', () => {
    const config: Record<string, string> = {
      'app.apiBaseUrl': 'https://portal.example.test/api',
      'app.version': 'v1',
    };
    const service = new TiramisClientService(
      {} as any,
      { get: jest.fn((key: string) => config[key]) } as any,
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

    const header = service.encodeSourceMetadata({
      sourceService: 'insurance-portal-service',
      sourceCompanyId: 'company-1',
      sourceModule: 'quotations',
      businessReference: 'AICL260929004',
      requestType: 'MOTOR',
    });

    expect(
      JSON.parse(Buffer.from(header, 'base64url').toString('utf8')),
    ).toMatchObject({
      sourceCompanyId: 'company-1',
      businessReference: 'AICL260929004',
      portalWebhookUrl:
        'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
    });
    expect(
      service.isSubmissionPattern(TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR),
    ).toBe(true);
    expect(
      service.isSubmissionPattern(TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NON_MOTOR),
    ).toBe(true);
    expect(service.isSubmissionPattern(TIRAMIS_MESSAGE_PATTERNS.STATUS)).toBe(
      false,
    );
  });

  it('checks service health against the environment the company activated', async () => {
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        serviceApiKeyEncrypted: 'encrypted-live-key',
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
      {
        get: jest.fn((key: string) =>
          key === 'tiramisClient.baseUrl'
            ? 'https://tiramis.example.test'
            : 'test',
        ),
        getOrThrow: jest.fn().mockReturnValue('insurance-portal-service'),
      } as any,
      { getRequestId: jest.fn(), getCorrelationId: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      organizationContextService as any,
      {} as any,
      { decrypt: jest.fn().mockReturnValue('live-api-key') } as any,
      {
        findOne: jest.fn().mockResolvedValue({ integrationPermissions: null }),
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      } as any,
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

  it('updates capabilities atomically when rotating the portal system key', async () => {
    const httpService = {
      request: jest
        .fn()
        .mockReturnValueOnce(
          of({
            status: 200,
            data: [
              {
                id: 'key-1',
                serviceName: 'insurance-portal-service-live',
                isActive: true,
                revokedAt: null,
              },
            ],
          }),
        )
        .mockReturnValueOnce(
          of({
            status: 201,
            data: { apiKey: 'new-service-key' },
          }),
        ),
    };
    const service = new TiramisClientService(
      httpService as any,
      {
        get: jest.fn().mockReturnValue('https://tiramis.example.test'),
        getOrThrow: jest.fn().mockReturnValue('insurance-portal-service'),
      } as any,
      { getRequestId: jest.fn(), getCorrelationId: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        findOne: jest.fn().mockResolvedValue({ isActive: true }),
      } as any,
    );

    await expect(
      service.rotateOrganizationApiKey({
        companyId: 'company-1',
        environment: 'live',
        companyCode: 'COMPANY-1',
        adminAccessToken: 'admin-access-token',
        allowedIps: ['203.0.113.10'],
      }),
    ).resolves.toBe('new-service-key');

    expect(httpService.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopes: ['tiramis:submit', 'tiramis:read', 'tiramis:verify'],
        }),
      }),
    );
  });

  it('retries a submission on the environment it was originally sent to', async () => {
    const tracking = {
      id: 'tracking-1',
      requestType: 'NON_MOTOR_COVER_NOTE',
      requestPayload: { coverNoteNumber: 'CN-1' },
      sourceCompanyId: 'company-1',
      sourceUserId: 'user-1',
      tiramisEnvironment: 'test',
    };
    const service = new TiramisClientService(
      {} as any,
      { get: jest.fn() } as any,
      { getRequestId: jest.fn(), getCorrelationId: jest.fn() } as any,
      { findById: jest.fn().mockResolvedValue(tracking) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (service as any).submitPatternMap = { NON_MOTOR_COVER_NOTE: 'pattern' };
    const send = jest
      .spyOn(service as any, 'send')
      .mockResolvedValue({ success: true });

    await service.resendTrackingRecord('tracking-1');

    expect(send).toHaveBeenCalledWith(
      'pattern',
      expect.anything(),
      expect.objectContaining({
        companyId: 'company-1',
        tiramisEnvironment: 'test',
      }),
    );
  });

  it('checks readiness against a pinned environment instead of the active one', async () => {
    const requireTiramisReady = jest.fn().mockResolvedValue({
      company: { id: 'company-1' },
      tiramis: {
        companyCode: 'ICC110',
        insurerCompanyCode: 'ICC110',
        environment: 'test',
      },
      activeBranch: { id: 'branch-1', code: 'BR1' },
      activeDepartment: null,
      defaultSalePoint: { id: 'sp-1', code: 'SP500' },
    });
    const service = new TiramisClientService(
      {} as any,
      { get: jest.fn() } as any,
      { getRequestId: jest.fn(), getCorrelationId: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { requireTiramisReady } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const context = await (service as any).buildTiramisReadyTenantContext({
      id: 'user-1',
      companyId: 'company-1',
      tiramisEnvironment: 'test',
    });

    expect(requireTiramisReady).toHaveBeenCalledWith(
      'user-1',
      'company-1',
      'test',
    );
    expect(context.environment).toBe('test');
  });
});
