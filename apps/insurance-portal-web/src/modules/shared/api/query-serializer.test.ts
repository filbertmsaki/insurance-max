import { describe, expect, it } from 'vitest';

import { serializeQueryParameters } from './query-serializer';

describe('serializeQueryParameters', () => {
  it('removes null and undefined values', () => {
    expect(
      serializeQueryParameters({
        page: 1,
        search: '',
        status: undefined,
        companyId: null,
      }),
    ).toBe('page=1');
  });

  it('serializes arrays as repeated parameters', () => {
    expect(
      serializeQueryParameters({
        status: ['DRAFT', 'APPROVED'],
      }),
    ).toBe('status=DRAFT&status=APPROVED');
  });

  it('serializes dates as ISO strings', () => {
    expect(
      serializeQueryParameters({
        from: new Date('2026-08-04T00:00:00.000Z'),
      }),
    ).toBe('from=2026-08-04T00%3A00%3A00.000Z');
  });
});
