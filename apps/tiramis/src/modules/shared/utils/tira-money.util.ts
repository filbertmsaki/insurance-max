/**
 * Formats a money amount for TIRA with exactly two decimal places
 * ("20000" -> "20000.00"). Blank values stay blank so optional elements
 * such as EndorsementPremiumEarned are still sent empty.
 */
export function toTiraMoney(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return (Math.round(amount * 100) / 100).toFixed(2);
}
