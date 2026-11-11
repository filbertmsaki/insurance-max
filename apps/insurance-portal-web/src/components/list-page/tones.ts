/*
 * Badge colour pairs and payment grouping shared by the list cells. Every
 * colour pair meets 4.5:1 contrast.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-[#E3F4EC] text-[#146C43]',
  warning: 'bg-[#FDEFD9] text-[#8A4B08]',
  danger: 'bg-[#FDE8E8] text-[#B42318]',
  neutral: 'bg-[#EEF0F4] text-[#4A5165]',
  info: 'bg-[#E6ECFA] text-[#2A3D80]',
};

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-[#146C43]',
  warning: 'text-[#8A4B08]',
  danger: 'text-[#B42318]',
  neutral: 'text-[#5B6275]',
  info: 'text-[#2A3D80]',
};

export type PaymentState = 'paid' | 'partial' | 'unpaid' | null;

/** PAID / PARTIAL / UNPAID from any payment status value. */
export function paymentStateOf(
  status: string | null | undefined,
): PaymentState {
  const value = (status ?? '').toUpperCase();
  if (!value || value === 'NOT_REQUIRED') return null;
  if (value === 'PAID') return 'paid';
  if (value.startsWith('PARTIAL')) return 'partial';
  if (value === 'REFUNDED' || value === 'CANCELLED') return null;
  return 'unpaid';
}
