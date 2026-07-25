export const COVER_NOTE_DATE_RANGE_OPTIONS = [
  { value: '30', label: '30 Days', days: 30 },
  { value: '60', label: '60 Days', days: 60 },
  { value: '90', label: '90 Days', days: 90 },
  { value: '365', label: '1 Year', days: 365 },
] as const;

export type CoverNoteDateRangeValue =
  (typeof COVER_NOTE_DATE_RANGE_OPTIONS)[number]['value'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Formats a Date using its local wall-clock fields (no UTC shift, unlike toISOString()). */
export function formatLocalDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Adds calendar days to a date, letting JS normalize month/year/DST rollover. */
export function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function computeCoverNoteDateRange(days: number, from: Date = new Date()) {
  const validFrom = formatLocalDateTime(from);
  const validUntil = formatLocalDateTime(addLocalDays(from, days - 1));
  return { validFrom, validUntil };
}

export function dateOnlyPart(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function todayLocalDatePart(): string {
  return dateOnlyPart(formatLocalDateTime(new Date()));
}

/** Parses a "YYYY-MM-DD[THH:mm:ss]" string as a local Date (safe for both date-only and full datetime values). */
function parseLocal(value: string): Date {
  const datePart = dateOnlyPart(value);
  const timePart = value.length > 10 ? value.slice(11, 19) || '00:00:00' : '00:00:00';
  return new Date(`${datePart}T${timePart}`);
}

/** Recomputes the end date from a (possibly just-edited) start date, keeping the same day-count rule as the modal. */
export function computeCoverNoteEndFromStart(
  validFrom: string,
  days: number,
): string {
  if (!validFrom) return '';
  const start = parseLocal(validFrom);
  if (Number.isNaN(start.getTime())) return '';
  return formatLocalDateTime(addLocalDays(start, days - 1));
}

/** Inclusive day count between two date/datetime strings (30 days = valid_until is 29 days after valid_from). */
export function inclusiveDayCount(
  validFrom?: string | null,
  validUntil?: string | null,
): number | null {
  if (!validFrom || !validUntil) return null;
  const start = new Date(`${dateOnlyPart(validFrom)}T00:00:00`);
  const end = new Date(`${dateOnlyPart(validUntil)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diffDays + 1;
}

/** Date-only check (ignores time of day) — a start date picker only lets the user pick a day. */
export function isBeforeToday(value?: string | null): boolean {
  if (!value) return false;
  return dateOnlyPart(value) < todayLocalDatePart();
}

/** Finds the preset (if any) whose day count matches the given range, for cosmetic preselection on reopen. */
export function matchPresetDays(
  validFrom?: string | null,
  validUntil?: string | null,
): CoverNoteDateRangeValue | '' {
  const totalDays = inclusiveDayCount(validFrom, validUntil);
  if (totalDays === null) return '';
  const match = COVER_NOTE_DATE_RANGE_OPTIONS.find((option) => option.days === totalDays);
  return match?.value ?? '';
}

export function formatCoverDateLabel(value?: string): string {
  if (!value) return 'Not set';

  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}
