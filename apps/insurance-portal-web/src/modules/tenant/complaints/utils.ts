import { cn } from '@/lib/utils';

export function complaintTone(value?: string | null) {
  const normalized = String(value ?? '').toUpperCase();
  return cn(
    'border',
    ['RESOLVED', 'CLOSED'].includes(normalized) &&
      'border-emerald-200 bg-emerald-50 text-emerald-700',
    ['CANCELLED', 'REJECTED'].includes(normalized) &&
      'border-red-200 bg-red-50 text-red-700',
    ['ESCALATED', 'APPEAL'].some((term) => normalized.includes(term)) &&
      'border-purple-200 bg-purple-50 text-purple-700',
    ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].some((term) =>
      normalized.includes(term),
    ) && 'border-amber-200 bg-amber-50 text-amber-700',
  );
}

export function formatComplaintDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
