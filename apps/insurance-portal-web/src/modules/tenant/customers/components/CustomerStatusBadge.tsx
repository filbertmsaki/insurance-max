import { Badge } from '@/components/ui/badge';
import type { CustomerStatus } from '../types';

const STATUS_STYLES: Record<CustomerStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100',
  BLACKLISTED: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
  MERGED: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge className={STATUS_STYLES[status]}>{status.replace(/_/g, ' ')}</Badge>
  );
}
