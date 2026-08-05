import { Badge } from '@/components/ui/badge';

/**
 * Invoice.status is a free-text varchar backend-side (no enum exists in the
 * billing-commission module) — these are just the conventions this wizard
 * itself writes (see QuotationPaymentPage), not a backend-enforced contract.
 * Unknown values still render, just with a neutral style.
 */
const STATUS_VARIANTS: Record<
  string,
  'muted' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'muted',
  ISSUED: 'warning',
  NOT_INITIATED: 'warning',
  REQUESTED: 'warning',
  PROCESSING: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  REFUNDED: 'muted',
  FAILED: 'danger',
  EXPIRED: 'danger',
  CANCELLED: 'danger',
  OVERDUE: 'danger',
};

export function PaymentStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="muted">No Invoice</Badge>;
  const variant = STATUS_VARIANTS[status.toUpperCase()] ?? 'muted';
  return <Badge variant={variant}>{status}</Badge>;
}
