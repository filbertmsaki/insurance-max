import {
  formatDateOnly,
  formatTiramisDateTime,
  parseTiramisDateTime,
} from './tiramis-date.util';

describe('TIRAMIS date utility', () => {
  it('interprets a timezone-free value as EAT', () => {
    const date = parseTiramisDateTime('2026-07-13T00:00:00');

    expect(date.toISOString()).toBe('2026-07-12T21:00:00.000Z');
  });

  it('formats the stored value back to Tanzania local time', () => {
    const date = new Date('2026-07-12T21:00:00.000Z');

    expect(formatTiramisDateTime(date)).toBe('2026-07-13T00:00:00');
  });

  it('supports explicit timezone values', () => {
    const date = parseTiramisDateTime('2026-07-13T00:00:00+03:00');

    expect(formatTiramisDateTime(date)).toBe('2026-07-13T00:00:00');
  });

  it('formats PostgreSQL date-only values', () => {
    expect(formatDateOnly('1996-06-30')).toBe('1996-06-30');
  });

  it('rejects invalid date-time values', () => {
    expect(() => parseTiramisDateTime('invalid-date')).toThrow();
  });
});
