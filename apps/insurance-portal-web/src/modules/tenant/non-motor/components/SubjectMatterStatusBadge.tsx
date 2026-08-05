import { Badge } from '@/components/ui/badge';

export function SubjectMatterStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const value = (status ?? 'ACTIVE').toUpperCase();
  const className =
    value === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <Badge variant="outline" className={className}>
      {value}
    </Badge>
  );
}
