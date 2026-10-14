import { describe, expect, it } from 'vitest';
import { isTiramisFinalSuccess } from './utils';

describe('isTiramisFinalSuccess', () => {
  it('recognizes final success and completed records', () => {
    expect(isTiramisFinalSuccess('FINAL_SUCCESS')).toBe(true);
    expect(isTiramisFinalSuccess('COMPLETED')).toBe(true);
  });

  it('leaves failed and pending records eligible for their existing actions', () => {
    expect(isTiramisFinalSuccess('FAILED')).toBe(false);
    expect(isTiramisFinalSuccess('PENDING_FINAL')).toBe(false);
  });
});
