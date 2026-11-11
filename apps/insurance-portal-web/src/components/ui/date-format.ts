/** Display an ISO calendar date without applying a time-zone conversion. */
export function formatControlDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1].slice(2)}` : '';
}

/** Parse a calendar date strictly; two-digit years represent 2000–2099. */
export function parseControlDate(value: string): string | undefined {
  if (!value.trim()) return '';
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
