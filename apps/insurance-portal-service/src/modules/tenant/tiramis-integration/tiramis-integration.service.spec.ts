import { TiramisIntegrationService } from './tiramis-integration.service';
import { PortalTiraSubmissionStatus } from './enums/portal-tira-submission-status.enum';
import { QuotationLifecycleService } from '../quotations/services/quotation-lifecycle.service';

describe('TiramisIntegrationService callback handling', () => {
  function createFixture() {
    const submission = {
      id: 'submission-1',
      company_id: 'company-1',
      quotation_id: 'quotation-1',
      policy_id: null,
      source_module: 'quotations',
      source_record_id: 'quotation-1',
      business_reference: 'BUS-1',
      status: PortalTiraSubmissionStatus.WAITING_FINAL_RESPONSE,
      status_code: null,
      status_description: null,
      tiramis_transaction_id: null,
      tiramis_request_id: 'REQ-1',
      tiramis_response_id: null,
      service_type: 'COVER_NOTE',
      root_element: 'CoverNoteRes',
      cover_note_reference_number: null,
      policy_reference_number: null,
      sticker_number: null,
      last_error: null,
      last_payload: null,
      submitted_at: new Date('2026-07-24T09:00:00.000Z'),
      last_event_at: new Date('2026-07-24T09:00:00.000Z'),
      completed_at: null,
    } as any;

    const quotation = {
      id: 'quotation-1',
      company_id: 'company-1',
    } as any;

    const submissionRepository = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where?.tiramis_request_id === 'REQ-1') {
          return submission;
        }

        return null;
      }),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
    } as any;

    const eventRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    } as any;

    const policyRepository = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (value) => value),
    } as any;

    const quotationRepository = {
      findOne: jest.fn(async ({ where }: any) =>
        where?.id === 'quotation-1' ? quotation : null,
      ),
    } as any;

    const quotationLifecycleService = {
      markTiraProcessing: jest.fn().mockResolvedValue(undefined),
      markTiraSuccessful: jest.fn().mockResolvedValue(undefined),
      markTiraCancelled: jest.fn().mockResolvedValue(undefined),
      markTiraRejected: jest.fn().mockResolvedValue(undefined),
      markTiraFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as QuotationLifecycleService;

    const service = new TiramisIntegrationService(
      submissionRepository,
      eventRepository,
      policyRepository,
      { save: jest.fn(async (value) => value) } as any,
      quotationRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        findByRequestId: jest.fn().mockResolvedValue(null),
        findByTransactionId: jest.fn().mockResolvedValue(null),
        findBySourceRecordId: jest.fn().mockResolvedValue([]),
        findByBusinessReference: jest.fn().mockResolvedValue([]),
        save: jest.fn(async (value) => value),
      } as any,
      {
        syncFromTracking: jest.fn().mockResolvedValue(undefined),
      } as any,
      {} as any,
      quotationLifecycleService,
      { applyNotification: jest.fn().mockResolvedValue(null) } as any,
      { applyIssuedPolicyIfRenewal: jest.fn().mockResolvedValue(null) } as any,
    );

    return {
      eventRepository,
      quotationLifecycleService,
      service,
      submission,
      submissionRepository,
    };
  }

  it('routes cancellation callbacks to quotation cancellation instead of normal completion', async () => {
    const fixture = createFixture();

    await fixture.service.handleTiramisNotification({
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      requestId: 'REQ-1',
      responseId: 'RES-1',
      statusCode: 'TIRA001',
      statusDescription: '  Transaction Successfully Cancelled  ',
      occurredAt: '2026-07-24T10:15:00.000Z',
    });

    expect(
      fixture.quotationLifecycleService.markTiraCancelled,
    ).toHaveBeenCalledWith(
      'company-1',
      'quotation-1',
      expect.objectContaining({
        reason: '  Transaction Successfully Cancelled  ',
        tiraResponseId: 'RES-1',
        metadata: expect.objectContaining({
          statusCode: 'TIRA001',
          statusDescription: '  Transaction Successfully Cancelled  ',
          callbackOutcome: 'CANCELLED',
          callbackTimestamp: '2026-07-24T10:15:00.000Z',
        }),
      }),
    );
    expect(
      fixture.quotationLifecycleService.markTiraSuccessful,
    ).not.toHaveBeenCalled();
  });

  it('routes the standard successful callback to quotation completion', async () => {
    const fixture = createFixture();

    await fixture.service.handleTiramisNotification({
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      requestId: 'REQ-1',
      responseId: 'RES-1',
      statusCode: 'TIRA001',
      statusDescription: 'Successful',
      occurredAt: '2026-07-24T10:20:00.000Z',
    });

    expect(
      fixture.quotationLifecycleService.markTiraSuccessful,
    ).toHaveBeenCalledWith(
      'company-1',
      'quotation-1',
      expect.objectContaining({
        reason: 'Successful',
        metadata: expect.objectContaining({
          callbackOutcome: 'COMPLETED',
        }),
      }),
    );
    expect(
      fixture.quotationLifecycleService.markTiraCancelled,
    ).not.toHaveBeenCalled();
  });
});
