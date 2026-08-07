import { format } from 'date-fns';

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, 'dd MMM yyyy, HH:mm');
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, 'dd MMM yyyy');
}

export function safeInternalLink(link: string | null | undefined) {
  if (!link) {
    return null;
  }

  if (!link.startsWith('/')) {
    return null;
  }

  if (link.startsWith('//')) {
    return null;
  }

  return link;
}

export function statusTone(value: string | null | undefined) {
  switch ((value ?? '').toUpperCase()) {
    case 'AVAILABLE':
    case 'DELIVERED':
    case 'COMPLETED':
    case 'SENT':
    case 'SUCCESS':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ARCHIVED':
    case 'READ':
    case 'IN_PROGRESS':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'OPEN':
    case 'CREATED':
    case 'PENDING':
    case 'SCAN_PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'REJECTED':
    case 'CANCELLED':
    case 'FAILED':
    case 'DISMISSED':
    case 'OVERDUE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
