import {
  TIRAMIS_ATTEMPT_STATUS,
  TIRAMIS_TRANSACTION_STATUS,
} from '../constants/tiramis-submission.constants';
import { TiramisRetrySchedulerService } from './tiramis-retry-scheduler.service';
import { TiramisCoverPeriodService } from '../../shared/services/tiramis-cover-period.service';

function createService() {
  const attemptRepository = {
    save: jest.fn(async (entity) => entity),
    findById: jest.fn(),
    findRetryableDueAttempts: jest.fn(),
    findFinalCallbackOverdueAttempts: jest.fn(),
  };
  const eventRepository = {
    createEvent: jest.fn(),
  };
  const transactionRepository = {
    save: jest.fn(async (entity) => entity),
    findById: jest.fn(),
  };
  const portalNotificationService = {
    publish: jest.fn(),
  };
  const tiramisConfigService = {
    getRuntimeConfigurationById: jest
      .fn()
      .mockResolvedValue({ id: 'config-1' }),
    getFullEndpointUrlForConfiguration: jest
      .fn()
      .mockResolvedValue('https://tira.example.test/submit'),
    getRequestHeadersForConfiguration: jest.fn().mockResolvedValue({}),
    getPfxPathsForConfiguration: jest.fn().mockResolvedValue({
      clientPrivateCertificatePath: 'client.pfx',
      clientPrivateCertificatePassword: 'secret',
    }),
    isSuccessResponse: jest.fn().mockResolvedValue(true),
  };
  const httpClient = {
    postXml: jest.fn().mockResolvedValue({
      statusCode: 200,
      rawXml: '<Acknowledgement/>',
    }),
  };
  const xmlParser = {
    parseTiraMessage: jest.fn().mockReturnValue({
      contentXml:
        '<MotorCoverNoteReq><RequestId>REQ-2</RequestId></MotorCoverNoteReq>',
    }),
    extractAcknowledgement: jest.fn().mockReturnValue({
      ok: true,
      acknowledgementId: 'ACK-2',
      statusCode: 'TIRA001',
      statusDesc: 'Successful',
    }),
  };
  const xmlBuilder = {
    buildSignedTiraMessageFromContent: jest
      .fn()
      .mockReturnValue('<SignedRequest/>'),
  };
  const signatureService = {
    signXmlContent: jest.fn().mockReturnValue('signature-2'),
  };
  const resubmissionService = {
    prepareResubmission: jest.fn(),
  };
  const coverNoteRepository = {
    update: jest.fn().mockResolvedValue(undefined),
  };

  const service = new TiramisRetrySchedulerService(
    attemptRepository as any,
    eventRepository as any,
    transactionRepository as any,
    tiramisConfigService as any,
    httpClient as any,
    xmlParser as any,
    xmlBuilder as any,
    signatureService as any,
    new TiramisCoverPeriodService(),
    portalNotificationService as any,
    resubmissionService as any,
    coverNoteRepository as any,
  );

  return {
    service,
    attemptRepository,
    eventRepository,
    coverNoteRepository,
    transactionRepository,
    portalNotificationService,
    resubmissionService,
    httpClient,
    xmlParser,
    eventRepository,
  };
}

describe('TiramisRetrySchedulerService recovery states', () => {
  it('creates a new request ID and preserves the prior attempt on manual retry', async () => {
    const {
      service,
      attemptRepository,
      transactionRepository,
      resubmissionService,
      httpClient,
    } = createService();
    const priorAttempt = {
      id: 'attempt-1',
      transactionId: 'txn-1',
      requestId: 'REQ-1',
      rootElement: 'ClaimReq',
      requestXml: '<ClaimReq><RequestId>REQ-1</RequestId></ClaimReq>',
      retryCount: 0,
      maxRetries: 5,
    };
    const retryAttempt = {
      id: 'attempt-2',
      transactionId: 'txn-1',
      requestId: 'REQ-2',
      previousRequestId: 'REQ-1',
      rootElement: 'ClaimReq',
    };
    const transaction = {
      id: 'txn-1',
      clientConfigurationId: 'config-1',
      serviceType: 'CLAIM_NOTIFICATION',
    };
    attemptRepository.findById.mockResolvedValue(priorAttempt);
    transactionRepository.findById.mockResolvedValue(transaction);
    resubmissionService.prepareResubmission.mockResolvedValue(retryAttempt);

    const result = await service.retryAttemptManually('attempt-1');

    expect(resubmissionService.prepareResubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'txn-1',
        reason: 'Retry after request REQ-1',
      }),
    );
    expect(httpClient.postXml).toHaveBeenCalledWith(
      expect.objectContaining({ xml: '<SignedRequest/>' }),
    );
    expect(result).toMatchObject({
      attemptId: 'attempt-2',
      requestId: 'REQ-2',
      previousRequestId: 'REQ-1',
    });
    expect(priorAttempt.requestId).toBe('REQ-1');
  });

  it('moves a stale motor cover period on manual retry and audits the outbound dates', async () => {
    const {
      service,
      attemptRepository,
      transactionRepository,
      resubmissionService,
      xmlParser,
      eventRepository,
      httpClient,
      coverNoteRepository,
    } = createService();
    const priorAttempt = {
      id: 'attempt-1',
      transactionId: 'txn-1',
      requestId: 'REQ-1',
      rootElement: 'MotorCoverNoteRefReq',
      status: TIRAMIS_ATTEMPT_STATUS.FAILED,
      requestXml:
        '<TiraMsg><MotorCoverNoteRefReq><RequestId>REQ-1</RequestId><CoverNoteStartDate>2020-01-01T10:00:00</CoverNoteStartDate><CoverNoteEndDate>2020-01-31T10:00:00</CoverNoteEndDate><CallBackUrl>https://old.example</CallBackUrl></MotorCoverNoteRefReq></TiraMsg>',
      retryCount: 0,
      maxRetries: 5,
    };
    const transaction = {
      id: 'txn-1',
      clientConfigurationId: 'config-1',
      serviceType: 'MOTOR_COVER_NOTE_NON_FLEET',
      status: TIRAMIS_TRANSACTION_STATUS.FAILED,
    };
    attemptRepository.findById.mockResolvedValue(priorAttempt);
    transactionRepository.findById.mockResolvedValue(transaction);
    resubmissionService.prepareResubmission.mockResolvedValue({
      id: 'attempt-2',
      transactionId: 'txn-1',
      requestId: 'REQ-2',
      previousRequestId: 'REQ-1',
    });
    (service as any).tiramisConfigService.getTiraCallbackUrlForServiceType =
      jest.fn().mockReturnValue('https://new.example');

    await service.retryAttemptManually('attempt-1');

    const preparedXml = xmlParser.parseTiraMessage.mock.calls[0][0] as string;
    expect(preparedXml).toContain('<RequestId>REQ-2</RequestId>');
    expect(preparedXml).toContain(
      '<CallBackUrl>https://new.example</CallBackUrl>',
    );
    const start = /<CoverNoteStartDate>([^<]+)</.exec(preparedXml)![1];
    const end = /<CoverNoteEndDate>([^<]+)</.exec(preparedXml)![1];
    expect(start).not.toBe('2020-01-01T10:00:00');
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(eventRepository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COVER_PERIOD_VALIDATED',
        rawPayload: expect.stringContaining(
          '"originalStartDateTime":"2020-01-01T10:00:00"',
        ),
      }),
    );
    expect(httpClient.postXml).toHaveBeenCalledTimes(1);
    expect(coverNoteRepository.update).toHaveBeenCalledWith(
      { transactionId: 'txn-1' },
      expect.objectContaining({ currentAttemptId: 'attempt-2' }),
    );
  });

  it('refuses to retry an acknowledged cover note', async () => {
    const { service, attemptRepository, transactionRepository, httpClient } =
      createService();
    attemptRepository.findById.mockResolvedValue({
      id: 'attempt-1',
      transactionId: 'txn-1',
      requestId: 'REQ-1',
      status: TIRAMIS_ATTEMPT_STATUS.ACK_SUCCESS,
      requestXml: '<TiraMsg/>',
    });
    transactionRepository.findById.mockResolvedValue({
      id: 'txn-1',
      status: TIRAMIS_TRANSACTION_STATUS.PROCESSING,
    });

    await expect(service.retryAttemptManually('attempt-1')).rejects.toThrow(
      'Cannot resend an accepted or unresolved TIRA submission',
    );
    expect(httpClient.postXml).not.toHaveBeenCalled();
  });

  it('notifies the portal when retry attempts are exhausted', async () => {
    const {
      service,
      attemptRepository,
      transactionRepository,
      portalNotificationService,
    } = createService();

    const attempt = {
      id: 'attempt-1',
      transactionId: 'txn-1',
      requestId: 'REQ-1',
      rootElement: 'MotorCoverNoteReq',
    };
    const transaction = {
      id: 'txn-1',
      sourceCompanyId: 'company-1',
      sourceModule: 'quotations',
      sourceRecordId: 'quote-1',
      businessReference: 'Q-001',
      serviceType: 'MOTOR',
      portalWebhookUrl:
        'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
    };

    await (service as any).markRetryExhausted({
      attempt,
      transaction,
      errorMessage: 'Maximum retry attempts reached',
    });

    expect(attempt.status).toBe(TIRAMIS_ATTEMPT_STATUS.FAILED);
    expect(transaction.status).toBe(TIRAMIS_TRANSACTION_STATUS.FAILED);
    expect(attemptRepository.save).toHaveBeenCalledWith(attempt);
    expect(transactionRepository.save).toHaveBeenCalledWith(transaction);
    expect(portalNotificationService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TIRAMIS_SUBMISSION_FAILED',
        transactionStatus: TIRAMIS_TRANSACTION_STATUS.FAILED,
        attemptStatus: TIRAMIS_ATTEMPT_STATUS.FAILED,
        errorMessage: 'Maximum retry attempts reached',
      }),
      {
        webhookUrl:
          'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
        clientConfigurationId: null,
      },
    );
  });

  it('marks overdue final callbacks as terminal and notifies the portal', async () => {
    const {
      service,
      attemptRepository,
      transactionRepository,
      portalNotificationService,
    } = createService();

    const attempt = {
      id: 'attempt-1',
      transactionId: 'txn-1',
      requestId: 'REQ-1',
      rootElement: 'CoverNoteRefReq',
      acknowledgementStatusCode: 'TIRA001',
    };
    const transaction = {
      id: 'txn-1',
      sourceCompanyId: 'company-1',
      sourceModule: 'quotations',
      sourceRecordId: 'quote-1',
      businessReference: 'Q-001',
      serviceType: 'NON_MOTOR',
      status: TIRAMIS_TRANSACTION_STATUS.PROCESSING,
      portalWebhookUrl:
        'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
    };

    attemptRepository.findFinalCallbackOverdueAttempts.mockResolvedValue([
      attempt,
    ]);
    transactionRepository.findById.mockResolvedValue(transaction);

    await (service as any).detectMissingFinalCallbacks();

    expect(attempt.status).toBe(TIRAMIS_ATTEMPT_STATUS.FINAL_CALLBACK_OVERDUE);
    expect(attempt.finalCallbackOverdueNotified).toBe(1);
    expect(transaction.status).toBe(TIRAMIS_TRANSACTION_STATUS.PROCESSING);
    expect(portalNotificationService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TIRAMIS_FINAL_CALLBACK_OVERDUE',
        statusCode: 'TIRA001',
        transactionStatus: TIRAMIS_TRANSACTION_STATUS.PROCESSING,
        attemptStatus: TIRAMIS_ATTEMPT_STATUS.FINAL_CALLBACK_OVERDUE,
      }),
      {
        webhookUrl:
          'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
        clientConfigurationId: null,
      },
    );
  });
});
