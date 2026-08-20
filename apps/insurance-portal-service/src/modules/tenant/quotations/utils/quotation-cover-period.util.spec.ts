import { normalizeQuotationCoverPeriod } from './quotation-cover-period.util';

describe('normalizeQuotationCoverPeriod', () => {
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
