import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import {
  getTiramisFailureMessage,
  normalizeTiramisPortalResponse,
  resolveSubmissionStatusFromNormalized,
} from './tiramis-response-normalizer.util';

describe('tiramis response normalizer', () => {
  it('maps callback overdue as a waiting warning without a final response', () => {
    const normalized = normalizeTiramisPortalResponse({
      transaction: {
        id: 'txn-1',
        status: 'FAILED',
        currentRequestId: 'REQ-1',
        serviceType: 'MOTOR',
        lastError: 'Final callback was overdue',
      },
      currentAttempt: {
        requestId: 'REQ-1',
        status: 'FINAL_CALLBACK_OVERDUE',
        acknowledgementStatusCode: 'TIRA001',
        acknowledgementStatusDesc: 'Successful',
        errorMessage: 'Final callback was overdue',
      },
    });

    expect(resolveSubmissionStatusFromNormalized(normalized)).toBe(
      TiramisSubmissionStatus.CALLBACK_OVERDUE,
    );
    expect(getTiramisFailureMessage(normalized)).toBe(
      'Final callback was overdue',
    );
  });

  it('maps failed transaction status without final XML as failed', () => {
    const normalized = normalizeTiramisPortalResponse({
      transaction: {
        id: 'txn-1',
        status: 'FAILED',
        currentRequestId: 'REQ-1',
        lastError: 'Maximum retry attempts reached',
      },
      currentAttempt: {
        requestId: 'REQ-1',
        status: 'FAILED',
        errorMessage: 'Maximum retry attempts reached',
      },
    });

    expect(resolveSubmissionStatusFromNormalized(normalized)).toBe(
      TiramisSubmissionStatus.FAILED,
    );
    expect(getTiramisFailureMessage(normalized)).toBe(
      'Maximum retry attempts reached',
    );
  });
});
