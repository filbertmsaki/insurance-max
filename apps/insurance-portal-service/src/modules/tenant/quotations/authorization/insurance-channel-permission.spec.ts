import { ForbiddenException } from '@nestjs/common';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { InsuranceChannelPermissionService } from './insurance-channel-permission';

describe('InsuranceChannelPermissionService', () => {
  const auditService = {
    logCritical: jest.fn().mockResolvedValue(undefined),
  };
  const service = new InsuranceChannelPermissionService(auditService as any);
  const user = { id: 'user-1', permissions: [] };

  beforeEach(() => {
    auditService.logCritical.mockClear();
  });

  it('normalizes Direct quotation payloads for users without channel permission', async () => {
    const payload = {
      internal_quotation: {
        channel_type: ProductChannelType.DIRECT,
        intermediary_company_id: null,
      },
    } as any;

    const result = await service.authorizeQuotationPayload(
      'company-1',
      payload,
      user,
      'quotation.create',
    );

    expect(result.internal_quotation.channel_type).toBe(
      ProductChannelType.DIRECT,
    );
    expect(result.internal_quotation.intermediary_company_id).toBeNull();
    expect(auditService.logCritical).not.toHaveBeenCalled();
  });

  it('rejects and audits non-Direct quotation attempts without permission', async () => {
    const payload = {
      internal_quotation: {
        channel_type: ProductChannelType.BROKER,
        intermediary_company_id: 'broker-1',
      },
    } as any;

    await expect(
      service.authorizeQuotationPayload(
        'company-1',
        payload,
        user,
        'quotation.create',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'insurance_channel.unauthorized_change',
        companyId: 'company-1',
        resource: 'quotation',
        status: 'failure',
        metadata: expect.objectContaining({
          requestedChannel: ProductChannelType.BROKER,
          requestedIntermediaryCompanyId: 'broker-1',
        }),
      }),
    );
  });

  it('allows non-Direct channels for users with explicit permission', async () => {
    const payload = {
      internal_quotation: {
        channel_type: ProductChannelType.AGENCY,
        intermediary_company_id: 'agency-1',
      },
    } as any;

    await expect(
      service.authorizeQuotationPayload(
        'company-1',
        payload,
        {
          id: 'user-2',
          permissions: ['quotations:select-insurance-channel'],
        },
        'quotation.create',
      ),
    ).resolves.toBe(payload);
    expect(auditService.logCritical).not.toHaveBeenCalled();
  });
});
