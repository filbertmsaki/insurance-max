import { Badge } from '@/components/ui/badge';

export function PolicyStatusBadge({ status }: { status: string }) {
  const classes =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-700 border-green-200'
      : status === 'DRAFT'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <Badge variant="outline" className={classes}>
      {status}
    </Badge>
  );
}
