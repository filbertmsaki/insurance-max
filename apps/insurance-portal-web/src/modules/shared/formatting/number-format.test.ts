import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NUMBER_FORMAT_SETTINGS,
  formatMoney,
  formatNumber,
  formatPercentage,
  parseFormattedNumber,
} from './number-format';

describe('number-format', () => {
  it('formats money with currency before amount by default', () => {
    expect(
      formatMoney(1250000, undefined, DEFAULT_NUMBER_FORMAT_SETTINGS),
    ).toBe('TSh 1,250,000.00');
  });

  it('formats money with currency after amount', () => {
    expect(
      formatMoney(1250000, undefined, {
        ...DEFAULT_NUMBER_FORMAT_SETTINGS,
        currency_symbol_position: 'after',
      }),
    ).toBe('1,250,000.00 TSh');
  });

  it('uses an explicit currency code when it differs from the configured default', () => {
    expect(formatMoney(1250000, 'USD', DEFAULT_NUMBER_FORMAT_SETTINGS)).toBe(
      'USD 1,250,000.00',
    );
  });

  it('formats decimal and thousands separators independently', () => {
    expect(
      formatNumber(1234567.89, 2, {
        ...DEFAULT_NUMBER_FORMAT_SETTINGS,
        thousands_separator: '.',
        decimal_separator: ',',
      }),
    ).toBe('1.234.567,89');
  });

  it('formats negative values with parentheses', () => {
    expect(
      formatMoney(-1234.5, undefined, {
        ...DEFAULT_NUMBER_FORMAT_SETTINGS,
        negative_number_format: 'parentheses',
      }),
    ).toBe('(TSh 1,234.50)');
  });

  it('formats percentages with configured decimal places', () => {
    expect(
      formatPercentage(18, {
        ...DEFAULT_NUMBER_FORMAT_SETTINGS,
        percentage_decimal_places: 3,
      }),
    ).toBe('18.000%');
  });

  it('parses formatted numeric input without currency symbols', () => {
    expect(
      parseFormattedNumber('TSh 1,250,000.50', DEFAULT_NUMBER_FORMAT_SETTINGS),
    ).toBe(1250000.5);
  });

  it('parses parenthesized negative input', () => {
    expect(
      parseFormattedNumber('(TSh 1,250.00)', DEFAULT_NUMBER_FORMAT_SETTINGS),
    ).toBe(-1250);
  });
});
