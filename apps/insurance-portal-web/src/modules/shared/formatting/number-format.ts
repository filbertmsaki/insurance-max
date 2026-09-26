export type CurrencySymbolPosition = 'before' | 'after';
export type NegativeNumberFormat = 'minus' | 'parentheses';
export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';

export interface NumberFormatSettings {
  currency_code: string;
  currency_symbol: string;
  currency_symbol_position: CurrencySymbolPosition;
  money_decimal_places: number;
  number_decimal_places: number;
  thousands_separator: string;
  decimal_separator: string;
  negative_number_format: NegativeNumberFormat;
  percentage_decimal_places: number;
  locale: string;
  date_format: string;
  rounding_mode: RoundingMode;
}

export const DEFAULT_NUMBER_FORMAT_SETTINGS: NumberFormatSettings = {
  currency_code: 'TZS',
  currency_symbol: 'TSh',
  currency_symbol_position: 'before',
  money_decimal_places: 2,
  number_decimal_places: 2,
  thousands_separator: ',',
  decimal_separator: '.',
  negative_number_format: 'minus',
  percentage_decimal_places: 2,
  locale: 'en-TZ',
  date_format: 'yyyy-MM-dd',
  rounding_mode: 'half_up',
};

let activeSettings = DEFAULT_NUMBER_FORMAT_SETTINGS;

export function setActiveNumberFormatSettings(
  settings?: Partial<NumberFormatSettings> | null,
) {
  activeSettings = normalizeNumberFormatSettings(settings);
}

export function getActiveNumberFormatSettings() {
  return activeSettings;
}

export function normalizeNumberFormatSettings(
  settings?: Partial<NumberFormatSettings> | null,
): NumberFormatSettings {
  const merged = { ...DEFAULT_NUMBER_FORMAT_SETTINGS, ...(settings ?? {}) };
  const decimalSeparator = merged.decimal_separator === ',' ? ',' : '.';
  const thousandsSeparator = [',', '.', ' ', "'", ''].includes(
    merged.thousands_separator,
  )
    ? merged.thousands_separator
    : DEFAULT_NUMBER_FORMAT_SETTINGS.thousands_separator;

  return {
    ...merged,
    currency_code: /^[A-Z]{3}$/.test(merged.currency_code)
      ? merged.currency_code
      : DEFAULT_NUMBER_FORMAT_SETTINGS.currency_code,
    currency_symbol: merged.currency_symbol || merged.currency_code,
    currency_symbol_position:
      merged.currency_symbol_position === 'after' ? 'after' : 'before',
    money_decimal_places: clampDigits(merged.money_decimal_places, 2),
    number_decimal_places: clampDigits(merged.number_decimal_places, 2),
    thousands_separator:
      thousandsSeparator === decimalSeparator ? ',' : thousandsSeparator,
    decimal_separator: decimalSeparator,
    negative_number_format:
      merged.negative_number_format === 'parentheses' ? 'parentheses' : 'minus',
    percentage_decimal_places: clampDigits(merged.percentage_decimal_places, 2),
    locale: merged.locale || DEFAULT_NUMBER_FORMAT_SETTINGS.locale,
    date_format:
      merged.date_format || DEFAULT_NUMBER_FORMAT_SETTINGS.date_format,
    rounding_mode:
      merged.rounding_mode ?? DEFAULT_NUMBER_FORMAT_SETTINGS.rounding_mode,
  };
}

export function formatMoney(
  value: number | string | null | undefined,
  currencyCode?: string | null,
  settings = activeSettings,
) {
  const amount = toFiniteNumber(value);
  if (amount === null) return 'N/A';

  const resolvedCurrencyCode = currencyCode || settings.currency_code;
  const normalized = normalizeNumberFormatSettings({
    ...settings,
    currency_code: resolvedCurrencyCode,
  });
  const number = formatNumberValue(amount, normalized.money_decimal_places, {
    ...normalized,
    negative_number_format: 'minus',
  });
  const symbol =
    resolvedCurrencyCode === settings.currency_code
      ? normalized.currency_symbol || normalized.currency_code
      : resolvedCurrencyCode;
  const absoluteNumber = number.startsWith('-') ? number.slice(1) : number;
  const spaced =
    normalized.currency_symbol_position === 'after'
      ? `${absoluteNumber} ${symbol}`
      : `${symbol} ${absoluteNumber}`;

  if (amount < 0 && normalized.negative_number_format === 'parentheses') {
    return `(${spaced})`;
  }

  return amount < 0 ? `-${spaced}` : spaced;
}

export function formatNumber(
  value: number | string | null | undefined,
  digits = activeSettings.number_decimal_places,
  settings = activeSettings,
) {
  const amount = toFiniteNumber(value);
  if (amount === null) return 'N/A';
  return formatNumberValue(amount, digits, settings);
}

export function formatPercentage(
  value: number | string | null | undefined,
  settings = activeSettings,
) {
  const amount = toFiniteNumber(value);
  if (amount === null) return 'N/A';
  return `${formatNumberValue(
    amount,
    settings.percentage_decimal_places,
    settings,
  )}%`;
}

export function parseFormattedNumber(
  value: string | number | null | undefined,
  settings = activeSettings,
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) return null;

  const normalized = normalizeNumberFormatSettings(settings);
  const trimmed = value.trim();
  const isParenthesized = trimmed.startsWith('(') && trimmed.endsWith(')');
  const withoutDecorations = trimmed
    .replace(normalized.currency_symbol, '')
    .replace(normalized.currency_code, '')
    .replace(/[()%]/g, '')
    .replaceAll(normalized.thousands_separator, '')
    .replace(normalized.decimal_separator, '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(withoutDecorations);

  if (!Number.isFinite(parsed)) return null;
  return isParenthesized ? -Math.abs(parsed) : parsed;
}

function formatNumberValue(
  value: number,
  digits: number,
  settings: NumberFormatSettings,
) {
  const normalized = normalizeNumberFormatSettings(settings);
  const negative = value < 0;
  const absolute = Math.abs(value);
  const fixed = roundForDisplay(
    absolute,
    clampDigits(digits, normalized.number_decimal_places),
    normalized.rounding_mode,
  ).toFixed(clampDigits(digits, normalized.number_decimal_places));
  const [integer, decimal] = fixed.split('.');
  const grouped = integer.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    normalized.thousands_separator,
  );
  const result = decimal
    ? `${grouped}${normalized.decimal_separator}${decimal}`
    : grouped;

  if (!negative) return result;
  return normalized.negative_number_format === 'parentheses'
    ? `(${result})`
    : `-${result}`;
}

function roundForDisplay(
  value: number,
  digits: number,
  roundingMode: RoundingMode,
) {
  const factor = 10 ** digits;

  switch (roundingMode) {
    case 'down':
      return Math.trunc(value * factor) / factor;
    case 'up':
      return Math.ceil(value * factor) / factor;
    case 'half_even':
    case 'half_up':
    default:
      return Math.round(value * factor) / factor;
  }
}

function toFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampDigits(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.min(6, Math.max(0, numeric));
}
