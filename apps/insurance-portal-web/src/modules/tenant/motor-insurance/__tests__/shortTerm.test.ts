import { describe, expect, it } from 'vitest';
import {
  SHORT_TERM_COVER,
  isShortTermQuotation,
  shortTermExpiry,
} from '../shortTerm';
import { MOTOR_QUOTATION_KINDS } from '../types';

describe('Short-Term (In-Transit) cover', () => {
  it('uses the existing private vehicle product and transit risk', () => {
    expect(SHORT_TERM_COVER.productCode).toBe('SP014001000000');
    expect(SHORT_TERM_COVER.riskCode).toBe('SP014001000007');
  });

  it('expires 30 calendar days minus one day after the start', () => {
    expect(shortTermExpiry('2026-11-09')).toBe('2026-12-08T23:59:59');
    expect(shortTermExpiry('2026-11-09T10:15:00')).toBe('2026-12-08T23:59:59');
  });

  it('crosses month and year ends', () => {
    expect(shortTermExpiry('2026-12-15')).toBe('2027-01-13T23:59:59');
    expect(shortTermExpiry('2028-02-01')).toBe('2028-03-01T23:59:59');
  });

  it('has no expiry without a start date', () => {
    expect(shortTermExpiry('')).toBe('');
  });

  it('recognises single and fleet short-term quotations', () => {
    expect(
      isShortTermQuotation({
        draft_payload: { risks: [{ risk_code: 'SP014001000007' }] },
      }),
    ).toBe(true);
    expect(
      isShortTermQuotation({
        cover_note_dtl: {
          fleet_dtl: [{ risks_covered: [{ risk_code: 'SP014001000007' }] }],
        },
      }),
    ).toBe(true);
    expect(
      isShortTermQuotation({
        draft_payload: { risks: [{ risk_code: 'SP014001000004' }] },
      }),
    ).toBe(false);
    expect(isShortTermQuotation(undefined)).toBe(false);
  });

  it('offers exactly three motor quotation types', () => {
    expect(MOTOR_QUOTATION_KINDS.map((item) => item.label)).toEqual([
      'Single Motor',
      'Fleet Motor',
      'Short-Term (In-Transit)',
    ]);
  });
});
