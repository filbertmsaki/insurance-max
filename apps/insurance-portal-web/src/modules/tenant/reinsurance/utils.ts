import { cn } from '@/lib/utils';

export function reinsuranceTone(value?: string | null) {
  const normalized = String(value ?? '').toUpperCase();
  return cn(
    'border',
    ['ACTIVE', 'APPROVED', 'APPLIED', 'PAID'].some((term) =>
      normalized.includes(term),
    ) && 'border-emerald-200 bg-emerald-50 text-emerald-700',
    ['REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED'].some((term) =>
      normalized.includes(term),
    ) && 'border-red-200 bg-red-50 text-red-700',
    ['DRAFT', 'PENDING', 'SUBMITTED', 'REVIEW'].some((term) =>
      normalized.includes(term),
    ) && 'border-amber-200 bg-amber-50 text-amber-700',
  );
}

export function formatReinsuranceMoney(
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

export function formatReinsuranceDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
