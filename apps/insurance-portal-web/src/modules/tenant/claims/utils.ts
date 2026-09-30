import { parseApiError } from '@/lib/api-error';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import type { ClaimCustomerRef, ClaimUserRef, Money } from './types';

export function formatClaimMoney(value?: Money, currency?: string | null) {
  return formatMoney(value ?? 0, currency ?? 'TZS');
}

export function formatClaimDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatClaimDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function claimCustomerName(customer?: ClaimCustomerRef | null) {
  if (!customer) return '-';
  return (
    customer.display_name ||
    customer.company_name ||
    customer.full_name ||
    customer.name ||
    [customer.first_name, customer.middle_name, customer.last_name]
      .filter(Boolean)
      .join(' ') ||
    customer.customer_no ||
    '-'
  );
}

export function claimUserName(user?: ClaimUserRef | null) {
  if (!user) return 'Unassigned';
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.email ||
    'Assigned'
  );
}

/**
 * Every message a failed claim request carries: the headline plus the
 * TIRAMIS rule failures (`errors`) or incomplete-detail lists (`details`),
 * so users see exactly which fields to fix.
 */
export function claimErrorLines(error: unknown): {
  code: string;
  message: string;
  lines: string[];
  details: Record<string, unknown> | null;
} {
  const parsed = parseApiError(error);
  const details = parsed.details ?? null;
  const nested = Array.isArray(details?.details) ? details.details : [];
  const lines = [
    ...(parsed.errors ?? []).map((item) => item.message),
    ...nested.filter((item): item is string => typeof item === 'string'),
  ].filter((line) => line !== parsed.message);

  return { code: parsed.code, message: parsed.message, lines, details };
}

/** `<input type="datetime-local">` value for an ISO timestamp (local time). */
export function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** ISO timestamp for a `datetime-local` value; '' stays undefined. */
export function fromDateTimeLocal(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** The first number a claim number format produces, as the server renders it. */
export function previewNumber(
  prefix: string,
  length: number,
  date = new Date(),
) {
  const year = String(date.getFullYear());
  const rendered = prefix
    .replace(/\{YYYY\}/g, year)
    .replace(/\{YY\}/g, year.slice(-2))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, '0'));
  return `${rendered}${'1'.padStart(Math.min(Math.max(length || 1, 1), 10), '0')}`;
}
