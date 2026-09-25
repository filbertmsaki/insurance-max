import { describe, expect, it } from 'vitest';
import {
  formatDateRange,
  formatPeriodCount,
  formatTrendPeriod,
  getDateRangeError,
  groupByForRange,
  resolveDatePreset,
} from '../dateRange';

// Thursday 25 September 2026, early morning local time.
const NOW = new Date(2026, 8, 25, 1, 30);

describe('resolveDatePreset', () => {
  it.each([
    ['today', '2026-09-25', '2026-09-25'],
    ['yesterday', '2026-09-24', '2026-09-24'],
    ['this_week', '2026-09-21', '2026-09-25'],
    ['last_week', '2026-09-14', '2026-09-20'],
    ['this_month', '2026-09-01', '2026-09-25'],
    ['last_month', '2026-08-01', '2026-08-31'],
    ['this_year', '2026-01-01', '2026-09-25'],
    ['last_year', '2025-01-01', '2025-12-31'],
  ] as const)('resolves %s to %s – %s', (preset, from, to) => {
    expect(resolveDatePreset(preset, NOW)).toEqual({ from, to });
  });

  it('rolls last month back across a year boundary', () => {
    expect(resolveDatePreset('last_month', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
});

describe('getDateRangeError', () => {
  it('accepts a valid range', () => {
    expect(getDateRangeError({ from: '2026-09-01', to: '2026-09-25' })).toBe(
      null,
    );
  });

  it('rejects missing dates', () => {
    expect(getDateRangeError({ from: '', to: '2026-09-25' })).toMatch(
      /start and an end/,
    );
  });

  it('rejects a start after the end', () => {
    expect(getDateRangeError({ from: '2026-09-26', to: '2026-09-25' })).toMatch(
      /on or before/,
    );
  });

  it('allows a full leap year but not more', () => {
    expect(getDateRangeError({ from: '2028-01-01', to: '2028-12-31' })).toBe(
      null,
    );
    expect(getDateRangeError({ from: '2025-01-01', to: '2026-01-02' })).toMatch(
      /366 days/,
    );
  });
});

describe('groupByForRange', () => {
  it('groups by day up to 31 days', () => {
    expect(groupByForRange({ from: '2026-08-01', to: '2026-08-31' })).toBe(
      'DAY',
    );
  });

  it('groups by week up to a quarter', () => {
    expect(groupByForRange({ from: '2026-07-01', to: '2026-09-25' })).toBe(
      'WEEK',
    );
  });

  it('groups by month for longer ranges', () => {
    expect(groupByForRange({ from: '2026-01-01', to: '2026-09-25' })).toBe(
      'MONTH',
    );
  });
});

describe('formatting', () => {
  it('formats ranges compactly', () => {
    expect(formatDateRange({ from: '2026-09-25', to: '2026-09-25' })).toBe(
      '25 Sep 2026',
    );
    expect(formatDateRange({ from: '2026-09-01', to: '2026-09-25' })).toBe(
      '1 Sep – 25 Sep 2026',
    );
    expect(formatDateRange({ from: '2025-12-29', to: '2026-01-04' })).toBe(
      '29 Dec 2025 – 4 Jan 2026',
    );
  });

  it('labels trend buckets by grouping', () => {
    expect(formatTrendPeriod('2026-09-21', 'DAY')).toBe('21 Sep');
    expect(formatTrendPeriod('2026-09-21', 'WEEK')).toBe('Wk 21 Sep');
    expect(formatTrendPeriod('2026-09', 'MONTH')).toBe('Sep 2026');
    expect(formatTrendPeriod('2026-09-21')).toBe('2026-09-21');
    expect(formatTrendPeriod('Unknown', 'DAY')).toBe('Unknown');
  });

  it('pluralises period counts', () => {
    expect(formatPeriodCount(1, 'WEEK')).toBe('1 week');
    expect(formatPeriodCount(3, 'MONTH')).toBe('3 months');
    expect(formatPeriodCount(2)).toBe('2 periods');
  });
});
