/*
 * Display formatting for every Underwriting list. Dates show as DD/MM/YY and
 * times as 24-hour HH:mm; the API always receives ISO dates (YYYY-MM-DD).
 * Date-only values ("2026-11-09") are read as calendar days, never shifted
 * through UTC, so a cover date shows the same day in every time zone.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export type DateInput = string | Date | null | undefined;

const pad = (value: number) => String(value).padStart(2, '0');

/** Parses an ISO date or date-time; date-only values are local calendar days. */
export function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const dateOnly = DATE_ONLY.exec(value.trim());
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** True when the value carries a time of day (not a bare calendar date). */
export function hasTime(value: DateInput): boolean {
  if (!value) return false;
  if (value instanceof Date) return true;
  return !DATE_ONLY.test(value.trim());
}

/** "09/11/26" */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear() % 100)}`;
}

/** "14:32" (24-hour). Empty for date-only values. */
export function formatTime(value: DateInput): string {
  const date = toDate(value);
  if (!date || !hasTime(value)) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "09/11/26 – 08/12/26" (en dash with a space on each side). */
export function formatRange(start: DateInput, end: DateInput): string {
  if (!toDate(start) && !toDate(end)) return '—';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** "9 November 2026, 14:32" for tooltips; no time for date-only values. */
export function formatFullDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return hasTime(value) ? `${day}, ${formatTime(value)}` : day;
}

/** ISO calendar day (YYYY-MM-DD) in local time, for `<time dateTime>` and the API. */
export function toIsoDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Reads what a user typed as DD/MM/YY (or DD/MM/YYYY, with / . or -) and
 * returns the ISO date, or null when it is not a real calendar day.
 * Two-digit years are 2000–2099.
 */
export function parseDisplayDate(text: string): string | null {
  const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s*$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year =
    match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null;
  return toIsoDate(date);
}

/** Days or fewer of cover left for a record to count as expiring soon. */
export const EXPIRING_SOON_DAYS = 7;

export type HintTone = 'info' | 'success' | 'warning' | 'neutral';

export interface CoverHint {
  kind: 'upcoming' | 'active' | 'expiring' | 'expired';
  text: string;
  tone: HintTone;
  /** Whole calendar days: until the start (upcoming) or until the end. */
  days: number;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(from: Date, to: Date) {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Days-left hint from the cover dates and today. The end date is the last
 * covered day: a cover ending today has 0 days left and is still active.
 */
export function coverHint(
  start: DateInput,
  end: DateInput,
  today: Date = new Date(),
): CoverHint | null {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!endDate) return null;
  if (startDate && dayDiff(today, startDate) > 0) {
    const days = dayDiff(today, startDate);
    return {
      kind: 'upcoming',
      text: `Starts in ${plural(days, 'day')}`,
      tone: 'info',
      days,
    };
  }
  const left = dayDiff(today, endDate);
  if (left < 0)
    return { kind: 'expired', text: 'Expired', tone: 'neutral', days: left };
  if (left <= EXPIRING_SOON_DAYS) {
    return {
      kind: 'expiring',
      text: left === 0 ? 'Expires today' : `Expires in ${plural(left, 'day')}`,
      tone: 'warning',
      days: left,
    };
  }
  return {
    kind: 'active',
    text: `${plural(left, 'day')} left`,
    tone: 'success',
    days: left,
  };
}

export type TiraState = 'success' | 'failed' | 'pending' | 'not_submitted';

/**
 * Groups any TIRA / TIRAMIS submission status into four states. Matches the
 * server's `tiraStateSql()` so filters, counts and badges agree.
 */
export function tiraStateOf(status: string | null | undefined): TiraState {
  const value = (status ?? '').toUpperCase();
  if (
    [
      'SUCCESS',
      'FINAL_SUCCESS',
      'COMPLETED',
      'ENDORSED',
      'SYNCED',
      'ISSUED',
      'ACCEPTED',
      'IN_SYNC',
    ].includes(value)
  )
    return 'success';
  if (/FAIL|REJECT|ERROR|EXHAUST/.test(value)) return 'failed';
  if (
    value !== 'NOT_SUBMITTED' &&
    /SUBMIT|PROCESS|QUEUE|ACK|RETRY|PENDING|WAITING|SENT|OVERDUE|VALIDATED/.test(
      value,
    )
  )
    return 'pending';
  return 'not_submitted';
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

/** "PENDING_REQUIREMENTS" → "Pending requirements" (TIRA kept in capitals). */
export function humanizeStatus(value: string | null | undefined): string {
  const words = String(value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!words) return 'Unknown';
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(
    /\btira(mis)?\b/gi,
    'TIRA',
  );
}

/**
 * Badge tone for a record status. Green: active / completed / paid. Amber:
 * pending / awaiting / in progress. Red: failed / cancelled / rejected.
 * Grey: draft / expired. Blue: endorsed / ready.
 */
export function statusTone(value: string | null | undefined): StatusTone {
  const status = String(value ?? '').toUpperCase();
  if (/FAIL|CANCEL|REJECT|DECLIN|LAPSE|VOID/.test(status)) return 'danger';
  if (/^(DRAFT|EXPIRED|NOT_STARTED|CLOSED)$|EXPIRED$/.test(status))
    return 'neutral';
  if (/ENDORSED|^READY/.test(status)) return 'info';
  if (
    /^(ACTIVE|COMPLETED|PAID|ISSUED|APPROVED|ACCEPTED|RENEWED|APPLIED)$|COVER_NOTE_ISSUED/.test(
      status,
    )
  )
    return 'success';
  return 'warning';
}
