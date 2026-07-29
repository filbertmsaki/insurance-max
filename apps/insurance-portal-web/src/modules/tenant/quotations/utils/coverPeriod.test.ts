import { describe, expect, it } from 'vitest';
import { formatCoverDate, formatCoverPeriod } from './coverPeriod';

describe('cover period formatting', () => {
  it('formats ISO dates without timezone conversion', () => {
    expect(formatCoverDate('2026-07-29T00:00:00.000Z')).toBe('29/07/2026');
    expect(formatCoverDate('2028-07-28')).toBe('28/07/2028');
  });

  it('formats a complete cover period', () => {
    expect(
      formatCoverPeriod('2026-07-29T00:00:00.000Z', '2028-07-28T23:59:59.000Z'),
    ).toBe('29/07/2026 - 28/07/2028');
  });

  it('shows N/A for missing dates', () => {
    expect(formatCoverPeriod('2026-07-29', null)).toBe('29/07/2026 - N/A');
    expect(formatCoverPeriod(null, '2028-07-28')).toBe('N/A - 28/07/2028');
    expect(formatCoverPeriod(null, undefined)).toBe('N/A');
  });
});
