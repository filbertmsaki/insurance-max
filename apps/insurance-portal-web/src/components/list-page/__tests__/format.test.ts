import { describe, expect, it } from 'vitest';
import {
  coverHint,
  formatDate,
  formatFullDate,
  formatRange,
  formatTime,
  parseDisplayDate,
  statusTone,
  tiraStateOf,
  toIsoDate,
} from '../format';

// Local times (no "Z") so results don't depend on the machine's time zone.
const ISSUED = '2026-11-09T14:32:00';

describe('list date format', () => {
  it('shows dates as DD/MM/YY with leading zeros and times as HH:mm', () => {
    expect(formatDate(ISSUED)).toBe('09/11/26');
    expect(formatDate('2026-01-05')).toBe('05/01/26');
    expect(formatTime(ISSUED)).toBe('14:32');
    expect(formatTime('2026-11-09T09:05:00')).toBe('09:05');
  });

  it('has no time for date-only values and never shifts the day', () => {
    expect(formatTime('2026-11-09')).toBe('');
    expect(formatDate('2026-11-09')).toBe('09/11/26');
    expect(toIsoDate('2026-11-09')).toBe('2026-11-09');
  });

  it('joins ranges with a spaced en dash', () => {
    expect(formatRange('2026-11-09', '2026-12-08')).toBe('09/11/26 – 08/12/26');
  });

  it('spells out the full date for tooltips', () => {
    expect(formatFullDate(ISSUED)).toBe('9 November 2026, 14:32');
    expect(formatFullDate('2026-11-09')).toBe('9 November 2026');
  });

  it('shows a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatRange(null, undefined)).toBe('—');
  });

  it('reads typed DD/MM/YY dates as ISO and rejects impossible days', () => {
    expect(parseDisplayDate('09/11/26')).toBe('2026-11-09');
    expect(parseDisplayDate('9/11/2026')).toBe('2026-11-09');
    expect(parseDisplayDate('09-11-26')).toBe('2026-11-09');
    expect(parseDisplayDate('31/02/26')).toBeNull();
    expect(parseDisplayDate('2026-11-09')).toBeNull();
    expect(parseDisplayDate('')).toBeNull();
  });
});

describe('days-left hint', () => {
  const today = new Date(2026, 10, 9, 10, 0);

  it('counts down to a future start in blue', () => {
    expect(coverHint('2026-11-12', '2026-12-11', today)).toMatchObject({
      kind: 'upcoming',
      text: 'Starts in 3 days',
      tone: 'info',
    });
  });

  it('shows days left in green while more than 7 remain', () => {
    expect(coverHint('2026-11-01', '2026-11-21', today)).toMatchObject({
      kind: 'active',
      text: '12 days left',
      tone: 'success',
    });
  });

  it('warns in amber with 7 days or fewer left, including the last day', () => {
    expect(coverHint('2026-11-01', '2026-11-14', today)).toMatchObject({
      kind: 'expiring',
      text: 'Expires in 5 days',
      tone: 'warning',
    });
    expect(coverHint('2026-11-01', '2026-11-16', today)?.kind).toBe('expiring');
    expect(coverHint('2026-11-01', '2026-11-17', today)?.kind).toBe('active');
    expect(coverHint('2026-11-01', '2026-11-09', today)?.text).toBe(
      'Expires today',
    );
  });

  it('marks ended cover as expired in grey', () => {
    expect(coverHint('2026-10-01', '2026-11-08', today)).toMatchObject({
      kind: 'expired',
      text: 'Expired',
      tone: 'neutral',
    });
  });
});

describe('status grouping', () => {
  it('groups TIRA statuses into four states', () => {
    for (const value of ['SUCCESS', 'FINAL_SUCCESS', 'COMPLETED', 'ENDORSED'])
      expect(tiraStateOf(value)).toBe('success');
    for (const value of [
      'FAILED',
      'REJECTED',
      'ACK_FAILED',
      'CALLBACK_REJECTED',
    ])
      expect(tiraStateOf(value)).toBe('failed');
    for (const value of [
      'SUBMITTING',
      'PROCESSING',
      'WAITING_FINAL_RESPONSE',
      'PENDING',
    ])
      expect(tiraStateOf(value)).toBe('pending');
    for (const value of ['NOT_SUBMITTED', null, ''])
      expect(tiraStateOf(value)).toBe('not_submitted');
  });

  it('gives record statuses the standard badge tones', () => {
    expect(statusTone('ACTIVE')).toBe('success');
    expect(statusTone('COMPLETED')).toBe('success');
    expect(statusTone('PENDING_REQUIREMENTS')).toBe('warning');
    expect(statusTone('CANCELLED')).toBe('danger');
    expect(statusTone('TIRAMIS_SUBMISSION_FAILED')).toBe('danger');
    expect(statusTone('DRAFT')).toBe('neutral');
    expect(statusTone('EXPIRED')).toBe('neutral');
    expect(statusTone('ENDORSED')).toBe('info');
  });
});
