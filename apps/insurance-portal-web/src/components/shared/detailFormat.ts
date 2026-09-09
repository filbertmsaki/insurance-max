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
  if (value === null || value === undefined || Number.isNaN(value))
    return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'TZS',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value))
    return 'N/A';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);
}

/** "SUBMIT_FOR_APPROVAL" / "submit_for_approval" -> "Submit for approval" */
export function humanizeCode(value: string | null | undefined) {
  if (!value) return 'N/A';
  const words = value.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
