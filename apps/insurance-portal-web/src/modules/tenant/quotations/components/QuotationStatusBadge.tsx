import { Badge } from '@/components/ui/badge';
import type { QuotationDisplayStatus, QuotationStatus } from '../types';

const statusClasses: Record<QuotationDisplayStatus | QuotationStatus, string> =
  {
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    PENDING_REQUIREMENTS: 'bg-amber-100 text-amber-700 border-amber-200',
    READY_FOR_SUBMISSION: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    SUBMITTING_TO_TIRA: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    PENDING_APPROVAL: 'bg-blue-100 text-blue-700 border-blue-200',
    SUBMITTED_TO_TIRA: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    TIRA_PROCESSING: 'bg-sky-100 text-sky-800 border-sky-200',
    COMPLETED: 'bg-green-100 text-green-800 border-green-200',
    FAILED: 'bg-red-100 text-red-800 border-red-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
    EXPIRED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    CANCELLED: 'bg-rose-100 text-rose-700 border-rose-200',
    CHANGES_REQUESTED: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVAL_REJECTED: 'bg-red-100 text-red-700 border-red-200',
    PAYMENT_REQUIRED: 'bg-orange-100 text-orange-800 border-orange-200',
    AWAITING_PAYMENT: 'bg-amber-100 text-amber-800 border-amber-200',
    PAYMENT_PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
    PARTIALLY_PAID: 'bg-amber-100 text-amber-800 border-amber-200',
    PAYMENT_FAILED: 'bg-red-100 text-red-800 border-red-200',
    PAYMENT_REQUEST_EXPIRED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    READY_FOR_TIRA_SUBMISSION:
      'bg-emerald-100 text-emerald-700 border-emerald-200',
    SUBMITTING_TO_TIRAMIS: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    SUBMITTED_TO_TIRAMIS: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    PROCESSING_AT_TIRAMIS: 'bg-sky-100 text-sky-800 border-sky-200',
    REJECTED_BY_TIRAMIS: 'bg-red-100 text-red-700 border-red-200',
    TIRAMIS_SUBMISSION_FAILED: 'bg-red-100 text-red-800 border-red-200',
  };

export function QuotationStatusBadge({
  status,
}: {
  status?: QuotationDisplayStatus | QuotationStatus | string | null;
  label?: string | null;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={statusClasses.DRAFT}>
        Unknown
      </Badge>
    );
  }

  const key = (
    status in statusClasses ? status : 'DRAFT'
  ) as QuotationDisplayStatus;
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
