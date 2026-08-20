import { buildTiramisIdempotencyKey } from './tiramis-idempotency.util';

describe('buildTiramisIdempotencyKey', () => {
  const submission = {
    sourceCompanyId: 'company-1',
    requestType: 'MOTOR_COVER_NOTE_NON_FLEET',
    sourceModule: 'quotations',
    sourceRecordId: 'quotation-1',
    businessReference: 'AICL260820002',
  };

  it('keeps ordinary submissions idempotent', () => {
    expect(buildTiramisIdempotencyKey(submission)).toBe(
      buildTiramisIdempotencyKey(submission),
    );
  });

  it('gives every forced resubmission a distinct submission identity', () => {
    const first = buildTiramisIdempotencyKey({
      ...submission,
      forceResubmit: true,
      resubmissionId: 'resubmission-1',
    });
    const second = buildTiramisIdempotencyKey({
      ...submission,
      forceResubmit: true,
      resubmissionId: 'resubmission-2',
    });

    expect(first).not.toBe(second);
  });
});
