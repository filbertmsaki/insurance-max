import {
  TIRAMIS_ATTEMPT_STATUS,
  TIRAMIS_TRANSACTION_STATUS,
} from '../constants/tiramis-submission.constants';
import { TiramisRetrySchedulerService } from './tiramis-retry-scheduler.service';

function createService() {
  const attemptRepository = {
    save: jest.fn(async (entity) => entity),
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

  const service = new TiramisRetrySchedulerService(
    attemptRepository as any,
    eventRepository as any,
    transactionRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    portalNotificationService as any,
  );

  return {
    service,
    attemptRepository,
    eventRepository,
    transactionRepository,
    portalNotificationService,
  };
}

describe('TiramisRetrySchedulerService recovery states', () => {
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
    };

    attemptRepository.findFinalCallbackOverdueAttempts.mockResolvedValue([
      attempt,
    ]);
    transactionRepository.findById.mockResolvedValue(transaction);

    await (service as any).detectMissingFinalCallbacks();

    expect(attempt.status).toBe(TIRAMIS_ATTEMPT_STATUS.FINAL_CALLBACK_OVERDUE);
    expect(attempt.finalCallbackOverdueNotified).toBe(1);
    expect(transaction.status).toBe(TIRAMIS_TRANSACTION_STATUS.FAILED);
    expect(portalNotificationService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TIRAMIS_FINAL_CALLBACK_OVERDUE',
        statusCode: 'TIRA001',
        transactionStatus: TIRAMIS_TRANSACTION_STATUS.FAILED,
        attemptStatus: TIRAMIS_ATTEMPT_STATUS.FINAL_CALLBACK_OVERDUE,
      }),
    );
  });
});
