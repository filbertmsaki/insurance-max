import { Badge } from '@/components/ui/badge';

export function BillingStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const classes =
    normalized === 'PAID' ||
    normalized === 'RECEIVED' ||
    normalized === 'SUCCESS' ||
    normalized === 'APPROVED'
      ? 'bg-green-100 text-green-700 border-green-200'
      : normalized === 'PARTIALLY_PAID' || normalized === 'PENDING'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : normalized === 'DRAFT'
          ? 'bg-slate-100 text-slate-600 border-slate-200'
          : 'bg-rose-100 text-rose-700 border-rose-200';

  return (
    <Badge variant="outline" className={classes}>
      {status}
    </Badge>
  );
}
