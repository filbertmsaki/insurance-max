/**
 * Display formatting for the quotation detail screen. Display text only:
 * stored values, API keys and field names are never changed.
 */
import {
  displayValue as baseDisplayValue,
  formatMoney,
  formatNumber,
} from '@/components/shared/detailFormat';

export { formatMoney, formatNumber };

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

function parse(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "9 Nov 2026" */
export function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const date = parse(value);
  return date ? DATE.format(date) : value;
}

/** "9 Nov 2026, 2:33 PM" */
export function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const date = parse(value);
  return date ? `${DATE.format(date)}, ${TIME.format(date)}` : value;
}

/** "9 Nov 2026 – 8 Nov 2027" */
export function formatPeriod(start?: string | null, end?: string | null) {
  if (!start && !end) return 'N/A';
  return `${start ? formatDate(start) : '…'} – ${end ? formatDate(end) : '…'}`;
}

/** One name for the regulator integration on screen: "TIRA". */
export function tiraText(value: string): string {
  return value
    .replace(/\btira\s*mis\b/gi, 'TIRA')
    .replace(/\btiramis\b/gi, 'TIRA')
    .replace(/\btira\b/gi, 'TIRA');
}

export function displayValue(value: unknown) {
  const text = baseDisplayValue(value);
  return text === 'N/A' ? text : tiraText(text);
}

/** "SUBMITTED_TO_TIRAMIS" -> "Submitted to TIRA" */
export function humanizeCode(value: string | null | undefined) {
  if (!value) return 'N/A';
  const words = value.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return tiraText(words.charAt(0).toUpperCase() + words.slice(1));
}

const ZERO_AMOUNT =
  /^(?:[A-Za-z]{1,4}\.?\s?)?0(?:[.,]0+)?(?:\s?[A-Za-z]{1,4})?$/;

/** Values that carry no information: missing, N/A, dashes, or a zero amount. */
export function isEmptyDisplay(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return (
    !text ||
    text === 'N/A' ||
    text === '-' ||
    text === '—' ||
    ZERO_AMOUNT.test(text)
  );
}
