const EAT_OFFSET = '+03:00';
const EAT_OFFSET_MILLISECONDS = 3 * 60 * 60 * 1000;

const EXPLICIT_TIMEZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * TIRAMIS payload examples use Tanzania local date-time values
 * without a timezone suffix.
 */
export function parseTiramisDateTime(value: string): Date {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error('TIRAMIS date-time value is required');
  }

  const valueWithTimezone = EXPLICIT_TIMEZONE_PATTERN.test(normalized)
    ? normalized
    : `${normalized}${EAT_OFFSET}`;

  const date = new Date(valueWithTimezone);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid TIRAMIS date-time value: ${value}`);
  }

  return date;
}

/**
 * Convert a stored Date into the authoritative TIRAMIS format.
 */
export function formatTiramisDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : parseTiramisDateTime(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid stored quotation date-time: ${String(value)}`);
  }

  const eastAfricaDate = new Date(date.getTime() + EAT_OFFSET_MILLISECONDS);

  return eastAfricaDate.toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * PostgreSQL date columns normally return YYYY-MM-DD strings.
 */
export function formatDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid stored quotation date: ${String(value)}`);
  }

  return parsed.toISOString().slice(0, 10);
}
