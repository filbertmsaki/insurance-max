import { Badge } from '@/components/ui/badge';
import type { TiramisSubmissionStatus } from '../types';

const classes: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  VALIDATED: 'bg-blue-100 text-blue-700 border-blue-200',
  SUBMITTED_TO_TIRAMIS: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  SENT_TO_TIRA: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ACK_SUCCESS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ACK_FAILED: 'bg-red-100 text-red-700 border-red-200',
  WAITING_FINAL_RESPONSE: 'bg-amber-100 text-amber-700 border-amber-200',
  FINAL_SUCCESS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FINAL_FAILED: 'bg-red-100 text-red-700 border-red-200',
  FINAL_CALLBACK_OVERDUE: 'bg-orange-100 text-orange-700 border-orange-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
  CALLBACK_REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
  RETRY_PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  RETRYING: 'bg-blue-100 text-blue-700 border-blue-200',
  RETRY_EXHAUSTED: 'bg-red-100 text-red-700 border-red-200',
  UNKNOWN: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function TiramisStatusBadge({
  status,
}: {
  status: TiramisSubmissionStatus | string;
}) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();
  return (
    <Badge variant="outline" className={classes[normalized] ?? classes.UNKNOWN}>
      {normalized.replace(/_/g, ' ')}
    </Badge>
  );
}
