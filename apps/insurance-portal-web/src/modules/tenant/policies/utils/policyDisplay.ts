import {
  daysUntil,
  type SummaryTone,
} from '@/components/record-summary/record-summary';

/** Statuses during which a policy is in force. */
export const IN_FORCE_STATUSES = ['ACTIVE', 'ENDORSED', 'COVER_NOTE_ISSUED'];

/** List filter value handled by the API: in force and ending within 30 days. */
export const EXPIRING_SOON = 'EXPIRING_SOON';
export const EXPIRING_WINDOW_DAYS = 30;

export type PolicyKind = 'single' | 'fleet' | 'non_motor';

export function policyKind(businessLine?: string | null): PolicyKind {
  if (businessLine === 'FLEET') return 'fleet';
  if (businessLine === 'NON_MOTOR') return 'non_motor';
  return 'single';
}

export const POLICY_KIND_LABEL: Record<
  PolicyKind,
  { short: string; long: string }
> = {
  single: { short: 'Single', long: 'Single motor' },
  fleet: { short: 'Fleet', long: 'Fleet motor' },
  non_motor: { short: 'Non-motor', long: 'Non-motor' },
};

export const POLICY_BREADCRUMB: Record<PolicyKind, string> = {
  single: 'Underwrite · Motor · Single motor',
  fleet: 'Underwrite · Motor · Fleet',
  non_motor: 'Underwrite · Non-motor',
};

function humanize(value: string) {
  const words = value.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Display status for a policy: the stored status, except that an in-force
 * policy within 30 days of its end date reads "Expiring soon" (warning).
 */
export function policyStatusView(
  status: string | null | undefined,
  endDate?: string | null,
  now = new Date(),
): { label: string; tone: SummaryTone; daysLeft: number | null } {
  const value = String(status ?? '').toUpperCase();
  const daysLeft = daysUntil(endDate, now);
  const inForce = IN_FORCE_STATUSES.includes(value);
  if (
    inForce &&
    daysLeft !== null &&
    daysLeft >= 0 &&
    daysLeft <= EXPIRING_WINDOW_DAYS
  ) {
    return { label: 'Expiring soon', tone: 'progress', daysLeft };
  }
  if (inForce) return { label: humanize(value), tone: 'success', daysLeft };
  if (['CANCELLED', 'REJECTED', 'VOID', 'SUSPENDED'].includes(value))
    return { label: humanize(value), tone: 'danger', daysLeft };
  if (['DRAFT', 'PENDING'].includes(value))
    return { label: humanize(value), tone: 'progress', daysLeft };
  return {
    label: value ? humanize(value) : 'Unknown',
    tone: 'muted',
    daysLeft,
  };
}

/** "23 days left", "Ends today", "Expired 4 days ago". */
export function daysLeftLabel(daysLeft: number | null) {
  if (daysLeft === null) return null;
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'Ends today';
  const ago = Math.abs(daysLeft);
  return `Expired ${ago} day${ago === 1 ? '' : 's'} ago`;
}
