/**
 * View model shared by the quotation and policy detail headers. Each entity
 * maps its own record into a `RecordSummary`; `RecordSummaryHeader` renders
 * it the same way on desktop, tablet and phone.
 */
import { formatMoney } from '@/components/shared/detailFormat';

export type SummaryEntity = 'quotation' | 'policy';
export type SummaryTone = 'success' | 'progress' | 'danger' | 'muted';
export type SummaryTiraState =
  | 'success'
  | 'failed'
  | 'pending'
  | 'not_submitted';

export interface SummaryVehicleFailure {
  name: string;
  message: string;
  code?: string | null;
}

/** The record's counterpart: a quotation's policy, or a policy's quotation. */
export interface SummaryReference {
  label: string;
  /** Shorter label for the phone rows. */
  mobileLabel: string;
  /** undefined while unknown (e.g. no permission): shows a dash. */
  value?: string | null;
  href?: string;
  /** Text when there is no value, e.g. "Not issued yet". */
  emptyText: string;
}

export interface RecordSummary {
  entity: SummaryEntity;
  /** Desktop breadcrumb, e.g. "Underwrite · Motor · Single motor". */
  breadcrumb: string;
  /** Phone type line, e.g. "Single motor". */
  typeLabel: string;
  number: string;
  status: { label: string; tone: SummaryTone };
  customer: string;
  /** "Class · Product". */
  product: string;
  shortProduct: string;
  premium: number | null;
  currency: string | null;
  /** Payment badge; omitted when the payment state is unknown. */
  payment?: { label: string; tone: SummaryTone; note?: string | null } | null;
  period: {
    start?: string | null;
    end?: string | null;
    label: string;
    mobileLabel: string;
    /** e.g. "23 days left". */
    note?: string | null;
  };
  reference: SummaryReference;
  tira: {
    state: SummaryTiraState;
    sticker?: string | null;
    coverRef?: string | null;
    error?: string | null;
    code?: string | null;
    /** Fleets: per-vehicle counts instead of single numbers. */
    fleet?: {
      total: number;
      issued: number;
      failed: SummaryVehicleFailure[];
    } | null;
  };
  /** Fleet vehicle count; null for single motor and non-motor. */
  vehicles: number | null;
  /** Small footer facts, e.g. Approval / Created or Issued by / Issued on. */
  footer: { label: string; value: string }[];
  /** Highlighted notice, e.g. "Expires in 12 days" with a Renew action. */
  notice?: {
    text: string;
    tone: SummaryTone;
    action?: { label: string; onClick: () => void; pending?: boolean };
  } | null;
  /** A failure outside TIRA (payment, approval) with its reason. */
  failure?: { label: string; error?: string | null } | null;
}

export interface SummaryRetry {
  label: string;
  onClick: () => void;
  pending?: boolean;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "MOTOR PRIVATE VEHICLE" -> "Motor private vehicle"; mixed case is kept. */
export function sentenceCase(value: string | null | undefined) {
  if (!value) return null;
  if (value !== value.toUpperCase()) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});
const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "9 Nov – 8 Dec 2026", or with both years when they differ. */
export function compactPeriod(start?: string | null, end?: string | null) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s && !e) return null;
  if (s && e && s.getFullYear() === e.getFullYear())
    return `${SHORT_DATE.format(s)} – ${LONG_DATE.format(e)}`;
  return `${s ? LONG_DATE.format(s) : '…'} – ${e ? LONG_DATE.format(e) : '…'}`;
}

const NUMERIC_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'numeric',
  year: '2-digit',
});

/** ["09/11/26", "08/12/26"] for the compact desktop cell. */
export function numericPeriod(start?: string | null, end?: string | null) {
  const fmt = (value?: string | null) => {
    const date = toDate(value);
    return date ? NUMERIC_DATE.format(date) : '…';
  };
  return start || end ? [fmt(start), fmt(end)] : null;
}

const COMPACT = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** "TSh 23.6K"; amounts under 1,000 stay in full. */
export function shortMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return formatMoney(value, currency);
  if (Math.abs(value) < 1000) return formatMoney(value, currency);
  const prefix = formatMoney(0, currency)
    .replace(/[\d.,\s-]+$/, '')
    .trim();
  return `${prefix ? prefix + ' ' : ''}${COMPACT.format(value)}`;
}

/** Whole days from today to `end` (negative once expired). */
export function daysUntil(end?: string | null, now = new Date()) {
  const e = toDate(end);
  if (!e) return null;
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  return Math.round(
    (startOfEnd.getTime() - startOfToday.getTime()) / 86_400_000,
  );
}

/** Maps any TIRA / submission status string onto four display states. */
export function tiraState(status: string | null | undefined): SummaryTiraState {
  const value = (status ?? '').toUpperCase();
  if (['SUCCESS', 'ENDORSED', 'SYNCED', 'ISSUED', 'ACCEPTED'].includes(value))
    return 'success';
  if (/FAIL|REJECT|ERROR|EXHAUST/.test(value)) return 'failed';
  if (
    /SUBMIT|PROCESS|QUEUE|ACK|RETRY|PENDING/.test(value) &&
    value !== 'NOT_SUBMITTED'
  )
    return 'pending';
  return 'not_submitted';
}
