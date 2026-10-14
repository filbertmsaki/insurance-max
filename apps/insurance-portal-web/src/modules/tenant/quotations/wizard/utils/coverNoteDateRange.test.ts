import { describe, expect, it } from 'vitest';

import {
  computeCoverNoteDateRange,
  computeCoverNoteEndFromStart,
  dateOnlyPart,
  matchPresetDays,
  pricingCoverEndDate,
  resolveCoverDurationDays,
} from './coverNoteDateRange';

describe('cover note date range', () => {
  it('ends a 30-day period on the preceding calendar day', () => {
    const range = computeCoverNoteDateRange(
      30,
      new Date('2026-10-14T07:53:11'),
    );

    expect(range.validFrom).toBe('2026-10-14T07:53:11');
    expect(range.validUntil).toBe('2026-11-12T23:59:59');
    expect(pricingCoverEndDate(range.validUntil)).toBe('2026-11-12');
    expect(resolveCoverDurationDays(range.validFrom, range.validUntil)).toBe(
      30,
    );
  });

  it('ends one calendar year the day before its anniversary, including leap years', () => {
    const range = computeCoverNoteDateRange(
      365,
      new Date('2026-10-14T07:53:11'),
    );

    expect(range.validUntil).toBe('2027-10-13T23:59:59');
    expect(computeCoverNoteEndFromStart('2027-10-14', 365)).toBe(
      '2028-10-13T23:59:59',
    );
    expect(dateOnlyPart(range.validUntil)).toBe('2027-10-13');
    expect(matchPresetDays(range.validFrom, range.validUntil)).toBe('365');
    expect(resolveCoverDurationDays(range.validFrom, range.validUntil)).toBe(
      365,
    );
    expect(matchPresetDays('2027-10-14', '2028-10-13T23:59:59')).toBe('365');
  });

  it.each([
    [60, '2026-12-12T23:59:59', '2026-12-12'],
    [90, '2027-01-11T23:59:59', '2027-01-11'],
  ])(
    'ends %i days inclusively across month boundaries',
    (days, end, pricingEnd) => {
      const range = computeCoverNoteDateRange(
        days,
        new Date('2026-10-14T07:53:11'),
      );

      expect(range.validUntil).toBe(end);
      expect(pricingCoverEndDate(range.validUntil)).toBe(pricingEnd);
      expect(resolveCoverDurationDays(range.validFrom, range.validUntil)).toBe(
        days,
      );
    },
  );

  it('retains inclusive pricing for legacy date-only ends', () => {
    expect(pricingCoverEndDate('2026-11-12')).toBe('2026-11-12');
    expect(matchPresetDays('2026-10-14', '2026-11-12')).toBe('30');
  });
});
