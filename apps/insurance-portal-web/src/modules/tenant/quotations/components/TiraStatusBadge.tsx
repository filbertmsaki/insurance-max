import { Badge } from '@/components/ui/badge';
import type { TiraStatus } from '../types';

const statusClasses: Record<TiraStatus, string> = {
  NOT_SUBMITTED: 'bg-slate-100 text-slate-600 border-slate-200',
  SUBMITTING: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  SUBMITTED: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  PROCESSING: 'bg-sky-100 text-sky-800 border-sky-200',
  SUCCESS: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  FAILED: 'bg-red-100 text-red-800 border-red-200',
};

export function TiraStatusBadge({
  status,
}: {
  status?: TiraStatus | string | null;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={statusClasses.NOT_SUBMITTED}>
        Not Submitted
      </Badge>
    );
  }

  const key = (
    status in statusClasses ? status : 'NOT_SUBMITTED'
  ) as TiraStatus;
  const text = String(status)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <Badge variant="outline" className={statusClasses[key]}>
      {text}
    </Badge>
  );
}
