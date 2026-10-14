import {
  normalizeQuotationCoverPeriod,
  pricingCoverEndDate,
} from './quotation-cover-period.util';

describe('normalizeQuotationCoverPeriod', () => {
  it('preserves exactly 30 days when the start time is adjusted', () => {
    const result = normalizeQuotationCoverPeriod(
      '2026-10-14T07:53:11',
      '2026-11-13T07:53:11',
      new Date('2026-10-14T04:53:11.000Z'),
    );

    expect(result).toMatchObject({
      startDateTime: '2026-10-14T07:53:21',
      endDateTime: '2026-11-13T07:53:21',
      durationMilliseconds: 30 * 86_400_000,
    });
    expect(pricingCoverEndDate(result.endDateTime)).toBe('2026-11-12');
  });

  it('keeps a legacy inclusive end-of-day pricing date', () => {
    expect(pricingCoverEndDate('2026-11-12T23:59:59')).toBe('2026-11-12');
  });
  it('preserves duration while moving a past period ahead of server time', () => {
    const result = normalizeQuotationCoverPeriod(
      '2026-08-01T10:03:28',
      '2026-08-31T10:03:28',
      new Date('2026-08-20T07:03:28.000Z'),
    );

    expect(result).toMatchObject({
      startDateTime: '2026-08-20T10:03:38',
      endDateTime: '2026-09-19T10:03:38',
      adjusted: true,
    });
  });

  it('leaves a sufficiently future period unchanged', () => {
    const result = normalizeQuotationCoverPeriod(
      '2026-08-21T10:03:28',
      '2026-09-20T10:03:28',
      new Date('2026-08-20T07:03:28.000Z'),
    );

    expect(result).toMatchObject({
      startDateTime: '2026-08-21T10:03:28',
      endDateTime: '2026-09-20T10:03:28',
      adjusted: false,
    });
  });
});
