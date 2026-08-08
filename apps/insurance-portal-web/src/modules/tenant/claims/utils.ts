import { cn } from '@/lib/utils';
import type { ClaimCustomer, ClaimUser } from './types';

export function formatClaimMoney(
  value?: string | number | null,
  currency = 'TZS',
) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
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

export function claimCustomerName(customer?: ClaimCustomer | null) {
  if (!customer) return '-';
  if (customer.display_name) return customer.display_name;
  if (customer.company_name) return customer.company_name;
  return (
    [customer.first_name, customer.middle_name, customer.last_name]
      .filter(Boolean)
      .join(' ') || '-'
  );
}

export function claimUserName(user?: ClaimUser | null) {
  if (!user) return 'Unassigned';
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.email ||
    'Assigned'
  );
}

export function claimTone(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  return cn(
    'border',
    ['APPROVED', 'PAID', 'CLOSED', 'RESOLVED', 'SETTLED'].some((term) =>
      normalized.includes(term),
    ) && 'border-emerald-200 bg-emerald-50 text-emerald-700',
    ['REJECTED', 'FAILED', 'CANCELLED', 'FRAUD'].some((term) =>
      normalized.includes(term),
    ) && 'border-red-200 bg-red-50 text-red-700',
    ['PENDING', 'REVIEW', 'SUBMITTED', 'OPEN'].some((term) =>
      normalized.includes(term),
    ) && 'border-amber-200 bg-amber-50 text-amber-700',
    !normalized && 'border-slate-200 bg-slate-50 text-slate-700',
  );
}
