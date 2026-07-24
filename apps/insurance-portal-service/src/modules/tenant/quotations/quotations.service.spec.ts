import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ApprovalStatus } from './enums/approval-status.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from './enums/quotation-status-transition-action.enum';
import { TiraStatus } from './enums/tira-status.enum';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationPreviewMapper } from './mappers/quotation-preview.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationLifecycleService } from './services/quotation-lifecycle.service';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { QuotationsService } from './quotations.service';
import { createMotorSingleQuotationPayload } from './testing/quotation-payload.fixture';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';

describe('QuotationsService', () => {
  function createServiceFixture(overrides?: Partial<Record<string, unknown>>) {
    const authoritativePayload = createMotorSingleQuotationPayload();
    const quotation = {
      id: 'quotation-1',
      quotation_no: 'QTN-MTR-2026-000001',
      quotation_flow: authoritativePayload.internal_quotation.quotation_flow,
      channel_type: authoritativePayload.internal_quotation.channel_type,
      status: QuotationStatus.READY_FOR_SUBMISSION,
      approval_status: ApprovalStatus.NOT_REQUIRED,
      payment_status: PaymentStatus.NOT_REQUIRED,
      tira_status: TiraStatus.NOT_SUBMITTED,
      requires_approval: false,
      requires_payment: false,
      submitted_at: null,
      submitted_by: null,
      branch_id: null,
      company_id: 'company-1',
      cover_note: {
        payment_mode: 1,
      },
      ...overrides,
    } as any;

    const dataSource = {} as DataSource;

    const quotationsRepository = {
      findOneAggregate: jest.fn().mockResolvedValue(quotation),
    } as unknown as QuotationsRepository;

    const payloadMapper = {
      toAuthoritativePayload: jest.fn().mockReturnValue(authoritativePayload),
      businessReference: jest.fn().mockReturnValue('AICL-MTR-2026-000001'),
      toResponse: jest.fn().mockImplementation((value: any) => value),
    } as unknown as QuotationPayloadMapper;

    const previewMapper = {} as QuotationPreviewMapper;

    const payloadValidator = {
      assertValid: jest.fn(),
    } as unknown as QuotationPayloadValidator;

    const tiramisBusinessSubmitService = {
      submitAnyBusinessRecord: jest.fn().mockResolvedValue({
        requestId: 'request-1',
        tracking_id: 'tracking-1',
      }),
    } as unknown as TiramisBusinessSubmitService;

    const quotationLifecycleService = {
      startTiraSubmission: jest.fn().mockResolvedValue(undefined),
      markTiraSubmitted: jest.fn().mockResolvedValue(undefined),
      markTiraFailed: jest.fn().mockResolvedValue(undefined),
      evaluateRequirements: jest.fn().mockResolvedValue(undefined),
      submitForApproval: jest.fn().mockResolvedValue(undefined),
      approveQuotation: jest.fn().mockResolvedValue(undefined),
      requestChanges: jest.fn().mockResolvedValue(undefined),
      rejectApproval: jest.fn().mockResolvedValue(undefined),
      markPaymentRequested: jest.fn().mockResolvedValue(undefined),
      markPaymentProcessing: jest.fn().mockResolvedValue(undefined),
      markPartiallyPaid: jest.fn().mockResolvedValue(undefined),
      markPaymentPaid: jest.fn().mockResolvedValue(undefined),
      markPaymentFailed: jest.fn().mockResolvedValue(undefined),
      markPaymentExpired: jest.fn().mockResolvedValue(undefined),
      markPaymentRefunded: jest.fn().mockResolvedValue(undefined),
      cancelQuotation: jest.fn().mockResolvedValue(undefined),
      expireQuotation: jest.fn().mockResolvedValue(undefined),
      convertQuotation: jest.fn().mockResolvedValue(undefined),
    } as unknown as QuotationLifecycleService;

    const tiramisTrackingRepository = {} as TiramisSubmissionTrackingRepository;
    const identifierGeneratorService = {} as IdentifierGeneratorService;

    const service = new QuotationsService(
      dataSource,
      quotationsRepository,
      payloadMapper,
      previewMapper,
      new QuotationTiramisPayloadMapper(),
      payloadValidator,
      tiramisBusinessSubmitService,
      tiramisTrackingRepository,
      identifierGeneratorService,
      quotationLifecycleService,
    );

    return {
      authoritativePayload,
      quotation,
      payloadMapper,
      quotationLifecycleService,
      tiramisBusinessSubmitService,
      service,
    };
  }

  it('submits the final outbound payload to TIRAMIS using camelCase fields', async () => {
    const fixture = createServiceFixture();

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      undefined,
      {
        id: 'user-1',
      } as any,
    );

    expect(
      (
        fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).toMatchObject({
      coverNoteNumber: 'AICL-MTR-2026-000001',
      salePointCode: 'SP502',
      productCode: 'SP005001000000',
      risks: [
        {
          riskCode: 'SP005001000001',
          taxes: [
            {
              taxCode: 'VAT-MAINLAND',
            },
          ],
        },
      ],
      policyHolders: [
        {
          policyHolderName: 'Filbert Elisaia Msaki',
          phoneNumber: '255762650393',
        },
      ],
      motorDetail: {
        registrationNumber: 'T123ABC',
        chassisNumber: 'MOCKCHASSIS123456',
      },
      isFleet: false,
    });

    expect(
      (
        fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('cover_note_dtl');
    expect(
      (
        fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('internal_quotation');

    expect(
      fixture.quotationLifecycleService.startTiraSubmission,
    ).toHaveBeenCalledWith(
      'company-1',
      fixture.quotation.id,
      expect.objectContaining({
        changedBy: 'user-1',
        reason: 'Quotation submitted to TIRAMIS',
      }),
      {
        allowRetryFromFailure: false,
      },
    );

    expect(
      fixture.quotationLifecycleService.markTiraSubmitted,
    ).toHaveBeenCalledWith(
      'company-1',
      fixture.quotation.id,
      expect.objectContaining({
        changedBy: 'user-1',
        tiraRequestId: 'request-1',
      }),
    );
  });

  it('reuses the existing submission without re-triggering lifecycle transitions', async () => {
    const fixture = createServiceFixture({
      status: QuotationStatus.SUBMITTED_TO_TIRA,
      tira_status: TiraStatus.SUBMITTED,
      submitted_at: new Date('2026-07-01T08:00:00.000Z'),
    });

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      {
        return_existing: true,
      },
      {
        id: 'user-1',
      } as any,
    );

    expect(
      fixture.quotationLifecycleService.startTiraSubmission,
    ).not.toHaveBeenCalled();
    expect(
      fixture.quotationLifecycleService.markTiraSubmitted,
    ).not.toHaveBeenCalled();
  });

  it('requires a reason when rejecting a quotation', async () => {
    const fixture = createServiceFixture();

    await expect(
      fixture.service.transitionStatus(
        'company-1',
        fixture.quotation.id,
        {
          action: QuotationStatusTransitionAction.REJECT_APPROVAL,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
