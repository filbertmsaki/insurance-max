import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import {
  getTiramisFailureMessage,
  isTiraSuccessCode,
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

  it('maps the TIRA214 cancellation callback as final success', () => {
    const normalized = normalizeTiramisPortalResponse({
      tiraResponse: {
        rootName: 'MotorCoverNoteRefRes',
        ResponseId: '202609281631296962065',
        RequestId: 'AIC20260928163130629158',
        CoverNoteReferenceNumber: '11026-27176-67612',
        StickerNumber: '26001-27194-88212',
        ResponseStatusCode: 'TIRA214',
        ResponseStatusDesc: 'Transaction successfully cancelled',
      },
    });

    expect(isTiraSuccessCode('TIRA214')).toBe(true);
    expect(normalized.final.statusCode).toBe('TIRA214');
    expect(normalized.final.statusDesc).toBe(
      'Transaction successfully cancelled',
    );
    expect(normalized.final.isSuccess).toBe(true);
    expect(resolveSubmissionStatusFromNormalized(normalized)).toBe(
      TiramisSubmissionStatus.FINAL_SUCCESS,
    );
  });
});
