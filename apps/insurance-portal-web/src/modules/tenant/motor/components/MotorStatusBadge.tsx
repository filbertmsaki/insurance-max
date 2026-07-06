import { Badge } from '@/components/ui/badge';

export function MotorStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized === 'ACTIVE'
      ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
      : normalized === 'INACTIVE'
        ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
        : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100';

  return <Badge className={className}>{normalized.replace(/_/g, ' ')}</Badge>;
}
