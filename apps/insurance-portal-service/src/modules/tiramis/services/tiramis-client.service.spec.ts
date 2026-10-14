import { of } from 'rxjs';
import { ConflictException } from '@nestjs/common';

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

  it('blocks resubmission after final success even when the payload changed', async () => {
    const service = createService();
    const send = jest.spyOn(service, 'send');
    jest
      .spyOn(service, 'assertConfiguredIntegrationPermission')
      .mockResolvedValue(undefined);
    service.auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service.trackingRepository = {
      findLatestSubmissionForSameBusiness: jest.fn().mockResolvedValue({
        id: 'tracking-1',
        status: 'FINAL_SUCCESS',
        requestPayload: { coverNoteNumber: 'OLD' },
      }),
    };

    await expect(
      service.submit({
        requestType: 'MOTOR',
        sourceCompanyId: 'company-1',
        sourceModule: 'quotations',
        sourceRecordId: 'quote-1',
        businessReference: 'CN-1',
        payload: { coverNoteNumber: 'NEW' },
        forceResubmit: true,
      }),
    ).rejects.toThrow('Sync its status and data');
    expect(send).not.toHaveBeenCalled();
  });

  it('blocks a direct resend after final success', async () => {
    const service = createService();
    service.trackingRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'tracking-1',
        status: 'FINAL_SUCCESS',
        requestPayload: { coverNoteNumber: 'CN-1' },
      }),
    };
    await expect(
      service.resendTrackingRecord('tracking-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps request callbackUrl overrides on motor submit payloads', async () => {
    const service = createService();

    const payload = await service.httpPayload(
      TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR,
      {
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
      },
      'uat',
    );

    expect(payload).toEqual({
      salePointCode: 'SP500',
      callbackUrl: 'https://portal.example.test/callback',
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

  it('keeps non-submission payloads unchanged', async () => {
    const service = createService();
    const command = {
      callbackUrl: 'https://portal.example.test/callback',
      requestId: 'REQ-001',
    };

    expect(
      await service.httpPayload(
        TIRAMIS_MESSAGE_PATTERNS.STATUS,
        command,
        'uat',
      ),
    ).toBe(command);
  });

  it('always sends the portal webhook URL in submission source metadata', async () => {
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

    const header = await service.encodeSourceMetadata(
      {
        sourceService: 'insurance-portal-service',
        sourceCompanyId: 'company-1',
        sourceModule: 'quotations',
        businessReference: 'AICL260929004',
        requestType: 'MOTOR',
      },
      'uat',
    );

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
      // No platform key yet: the company's legacy key is the fallback.
      {
        getServiceApiKey: jest.fn().mockResolvedValue(null),
        getActiveEnvironment: jest.fn().mockResolvedValue('production'),
        getBaseUrl: jest.fn().mockResolvedValue('https://tiramis.example.test'),
        getIntegrationPermissions: jest
          .fn()
          .mockResolvedValue(['submit', 'read_status']),
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
      { environment: 'production' },
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
      {
        getBaseUrl: jest.fn().mockResolvedValue('https://tiramis.example.test'),
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
      tiramisEnvironment: 'uat',
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
        tiramisEnvironment: 'uat',
      }),
    );
  });

  it('checks readiness against a pinned environment instead of the active one', async () => {
    const requireTiramisReady = jest.fn().mockResolvedValue({
      company: { id: 'company-1' },
      tiramis: {
        companyCode: 'ICC110',
        insurerCompanyCode: 'ICC110',
        environment: 'uat',
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
      tiramisEnvironment: 'uat',
    });

    expect(requireTiramisReady).toHaveBeenCalledWith(
      'user-1',
      'company-1',
      'uat',
      { followUp: false },
    );
    expect(context.environment).toBe('uat');
  });

  it("uses the platform service key for the submission's environment", async () => {
    const getServiceApiKey = jest.fn().mockResolvedValue('platform-live-key');
    const service = new TiramisClientService(
      {} as any,
      {
        get: jest.fn(),
        getOrThrow: jest.fn().mockReturnValue('portal'),
      } as any,
      { getRequestId: jest.fn(), getCorrelationId: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { createQueryBuilder: jest.fn() } as any,
      {
        getServiceApiKey,
        getActiveEnvironment: jest.fn(),
        getBaseUrl: jest.fn().mockResolvedValue('https://tiramis.example.test'),
      } as any,
    );

    const connection = await (service as any).resolveConnectionConfig(
      'company-1',
      'production',
    );

    expect(getServiceApiKey).toHaveBeenCalledWith('production');
    expect(connection.apiKey).toBe('platform-live-key');
  });

  it('marks status-sync reads as follow-ups so a later revoke never strands them', async () => {
    const requireTiramisReady = jest.fn().mockResolvedValue({
      company: { id: 'company-1' },
      tiramis: {
        companyCode: 'C',
        insurerCompanyCode: 'C',
        environment: 'uat',
      },
      activeBranch: { id: 'b', code: 'B' },
      activeDepartment: null,
      defaultSalePoint: { id: 's', code: 'S' },
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

    await (service as any).buildTiramisReadyTenantContext({
      id: 'user-1',
      companyId: 'company-1',
      tiramisEnvironment: 'uat',
      tiramisFollowUp: true,
    });

    expect(requireTiramisReady).toHaveBeenCalledWith(
      'user-1',
      'company-1',
      'uat',
      { followUp: true },
    );
  });
});
