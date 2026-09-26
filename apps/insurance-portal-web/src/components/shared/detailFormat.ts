import {
  formatMoney as formatConfiguredMoney,
  formatNumber as formatConfiguredNumber,
} from '@/modules/shared/formatting/number-format';

export function displayValue(value: unknown) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string' && !value.trim()) return 'N/A';
  if (Array.isArray(value) && value.length === 0) return 'N/A';
  return String(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
) {
  return formatConfiguredMoney(value, currency);
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  return formatConfiguredNumber(value, digits);
}

/** "SUBMIT_FOR_APPROVAL" / "submit_for_approval" -> "Submit for approval" */
export function humanizeCode(value: string | null | undefined) {
  if (!value) return 'N/A';
  const words = value.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
