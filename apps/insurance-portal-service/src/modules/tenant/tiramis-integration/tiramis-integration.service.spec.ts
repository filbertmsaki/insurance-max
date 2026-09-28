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
      markTiraAcknowledged: jest.fn().mockResolvedValue(undefined),
      markTiraSuccessful: jest.fn().mockResolvedValue(undefined),
      markTiraCancelled: jest.fn().mockResolvedValue(undefined),
      markTiraRejected: jest.fn().mockResolvedValue(undefined),
      markTiraFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as QuotationLifecycleService;

    const notificationPublisher = {
      publishQuotationTiramisUpdated: jest.fn(),
    };

    const service = new TiramisIntegrationService(
      submissionRepository,
      eventRepository,
      policyRepository,
      { save: jest.fn(async (value) => value) } as any,
      quotationRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any, // policyTransactionRepository
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
      {} as any, // policyTransactionLifecycleService
      {} as any, // policyTransactionApplyService
      {} as any, // policyTransactionRegulatoryOutcomeService
      notificationPublisher as any,
    );

    return {
      eventRepository,
      quotationLifecycleService,
      service,
      submission,
      submissionRepository,
      notificationPublisher,
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

  it('keeps an acknowledged quotation completed while waiting for callback', async () => {
    const fixture = createFixture();

    await fixture.service.handleTiramisNotification({
      eventType: 'TIRAMIS_ACK_RECEIVED',
      requestId: 'REQ-1',
      statusCode: 'TIRA001',
      statusDescription: 'Successful',
      occurredAt: '2026-07-24T10:20:00.000Z',
    });

    expect(
      fixture.quotationLifecycleService.markTiraAcknowledged,
    ).toHaveBeenCalledWith(
      'company-1',
      'quotation-1',
      expect.objectContaining({
        tiraRequestId: 'REQ-1',
        metadata: expect.objectContaining({ statusCode: 'TIRA001' }),
      }),
    );
    expect(
      fixture.quotationLifecycleService.markTiraFailed,
    ).not.toHaveBeenCalled();
  });

  it('treats callback overdue as a warning after successful acknowledgement', async () => {
    const fixture = createFixture();

    await fixture.service.handleTiramisNotification({
      eventType: 'TIRAMIS_FINAL_CALLBACK_OVERDUE',
      requestId: 'REQ-1',
      statusCode: 'TIRA001',
      statusDescription: 'Final callback is overdue after 10 minutes',
      errorMessage: 'Final callback is overdue after 10 minutes',
      occurredAt: '2026-07-24T10:30:00.000Z',
    });

    expect(
      fixture.quotationLifecycleService.markTiraAcknowledged,
    ).toHaveBeenCalled();
    expect(
      fixture.quotationLifecycleService.markTiraFailed,
    ).not.toHaveBeenCalled();
  });

  it('matches a delayed callback to the exact historical request attempt', async () => {
    const fixture = createFixture();
    const historicalAttempt = {
      ...fixture.submission,
      id: 'submission-old',
      tiramis_request_id: 'REQ-OLD',
      tiramis_transaction_id: 'TX-OLD',
    };
    const latestAttempt = {
      ...fixture.submission,
      id: 'submission-latest',
      tiramis_request_id: 'REQ-LATEST',
      tiramis_transaction_id: 'TX-LATEST',
    };

    fixture.submissionRepository.findOne.mockImplementation(
      async ({ where }: any) => {
        if (where?.tiramis_request_id === 'REQ-OLD') {
          return historicalAttempt;
        }

        if (where?.tiramis_transaction_id === 'TX-LATEST') {
          return latestAttempt;
        }

        return null;
      },
    );

    const matched = await (fixture.service as any).findExistingSubmission({
      requestId: 'REQ-OLD',
      tiramisTransactionId: 'TX-LATEST',
      sourceCompanyId: 'company-1',
      sourceRecordId: 'quotation-1',
      businessReference: 'BUS-1',
    });

    expect(matched).toBe(historicalAttempt);
    expect(fixture.submissionRepository.findOne).toHaveBeenCalledTimes(1);
    expect(fixture.submissionRepository.findOne).toHaveBeenCalledWith({
      where: { tiramis_request_id: 'REQ-OLD' },
    });
  });

  it('does not attach an unknown callback to the latest quotation attempt', async () => {
    const fixture = createFixture();
    fixture.submissionRepository.findOne.mockResolvedValue(null);

    const matched = await (fixture.service as any).findExistingSubmission({
      requestId: 'REQ-UNKNOWN',
      sourceCompanyId: 'company-1',
      sourceRecordId: 'quotation-1',
      businessReference: 'BUS-1',
    });

    expect(matched).toBeNull();
    expect(fixture.submissionRepository.findOne).toHaveBeenCalledTimes(1);
    expect(fixture.submissionRepository.findOne).toHaveBeenCalledWith({
      where: { tiramis_request_id: 'REQ-UNKNOWN' },
    });
  });

  it('does not apply a policy transaction from an acknowledgement event', async () => {
    const transaction = {
      id: 'txn-1',
      company_id: 'company-1',
      transaction_type: 'ENDORSEMENT',
    } as any;
    const policyTransactionRepository = {
      findOne: jest.fn().mockResolvedValue(transaction),
    };
    const lifecycleService = {
      markSubmissionAccepted: jest.fn().mockResolvedValue(undefined),
      markSubmissionRejected: jest.fn().mockResolvedValue(undefined),
      markSubmissionFailed: jest.fn().mockResolvedValue(undefined),
    };
    const applyService = {
      applyEndorsement: jest.fn().mockResolvedValue(undefined),
      applyCancellation: jest.fn().mockResolvedValue(undefined),
    };
    const regulatoryOutcomeService = {
      captureFinalSuccess: jest.fn().mockResolvedValue({
        transaction,
      }),
      captureFinalRejection: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TiramisIntegrationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      policyTransactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      lifecycleService as any,
      applyService as any,
      regulatoryOutcomeService as any,
      { publishQuotationTiramisUpdated: jest.fn() } as any,
    );

    await (service as any).updateLinkedPolicyTransaction(
      {
        company_id: 'company-1',
        source_module: 'policy-transactions',
        source_record_id: 'txn-1',
        status: PortalTiraSubmissionStatus.SUBMITTED_TO_TIRAMIS,
      },
      {
        eventType: 'TIRAMIS_RESPONSE_ACK_SENT',
        requestId: 'REQ-1',
      },
      null,
    );

    expect(lifecycleService.markSubmissionAccepted).not.toHaveBeenCalled();
    expect(regulatoryOutcomeService.captureFinalSuccess).not.toHaveBeenCalled();
    expect(applyService.applyEndorsement).not.toHaveBeenCalled();
  });

  it('applies a policy transaction only after final TIRAMIS success', async () => {
    const transaction = {
      id: 'txn-1',
      company_id: 'company-1',
      transaction_type: 'ENDORSEMENT',
    } as any;
    const policyTransactionRepository = {
      findOne: jest.fn().mockResolvedValue(transaction),
    };
    const lifecycleService = {
      markSubmissionAccepted: jest.fn().mockResolvedValue(undefined),
      markSubmissionRejected: jest.fn().mockResolvedValue(undefined),
      markSubmissionFailed: jest.fn().mockResolvedValue(undefined),
    };
    const applyService = {
      applyEndorsement: jest.fn().mockResolvedValue(undefined),
      applyCancellation: jest.fn().mockResolvedValue(undefined),
    };
    const regulatoryOutcomeService = {
      captureFinalSuccess: jest.fn().mockResolvedValue({
        transaction,
      }),
      captureFinalRejection: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TiramisIntegrationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      policyTransactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      lifecycleService as any,
      applyService as any,
      regulatoryOutcomeService as any,
      { publishQuotationTiramisUpdated: jest.fn() } as any,
    );

    await (service as any).updateLinkedPolicyTransaction(
      {
        company_id: 'company-1',
        source_module: 'policy-transactions',
        source_record_id: 'txn-1',
        status: PortalTiraSubmissionStatus.COMPLETED,
        tiramis_transaction_id: 'TX-1',
        tiramis_request_id: 'REQ-1',
      },
      {
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        requestId: 'REQ-1',
        tiramisTransactionId: 'TX-1',
        coverNoteReferenceNumber: 'CN-NEW',
        regulatoryResponse: {
          success: true,
          requestId: 'REQ-1',
          responseId: 'RESP-1',
          transactionId: 'TX-1',
          responsePayloadHash: 'hash',
          coverNotes: [
            {
              coverNoteReferenceNumber: 'CN-NEW',
            },
          ],
        },
      },
      { id: 'tracking-1' },
    );

    expect(regulatoryOutcomeService.captureFinalSuccess).toHaveBeenCalled();
    expect(lifecycleService.markSubmissionAccepted).toHaveBeenCalled();
    expect(applyService.applyEndorsement).toHaveBeenCalledWith(
      'company-1',
      'txn-1',
    );
  });
});
