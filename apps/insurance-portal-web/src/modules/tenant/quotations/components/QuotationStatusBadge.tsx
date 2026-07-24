import { Badge } from '@/components/ui/badge';
import type { QuotationStatus } from '../types';

const statusClasses: Record<QuotationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  RATED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REFERRED: 'bg-amber-100 text-amber-700 border-amber-200',
  PENDING_APPROVAL: 'bg-blue-100 text-blue-700 border-blue-200',
  SUBMITTED_TO_TIRA: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  CONVERTED: 'bg-violet-100 text-violet-700 border-violet-200',
  EXPIRED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  CANCELLED: 'bg-rose-100 text-rose-700 border-rose-200',
};

export function QuotationStatusBadge({
  status,
}: {
  status?: QuotationStatus | string | null;
}) {
  if (!status) {
    return <Badge variant="outline" className={statusClasses.DRAFT}>Unknown</Badge>;
  }

  const key = (status in statusClasses ? status : 'DRAFT') as QuotationStatus;
  return <Badge variant="outline" className={statusClasses[key]}>{status}</Badge>;
}

