import { Badge } from '@/components/ui/badge';
import { humanizeCode } from '@/components/shared/detailFormat';
import { CLAIM_STATUS_META, REGULATORY_STATUS_META } from '../constants';
import type { ClaimStatus } from '../types';

export function ClaimStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="muted">-</Badge>;
  const meta = CLAIM_STATUS_META[status as ClaimStatus];
  return (
    <Badge variant={meta?.tone ?? 'muted'}>
      {meta?.label ?? humanizeCode(status)}
    </Badge>
  );
}

/** Status of one TIRAMIS submission (claim_regulatory_operations.status). */
export function RegulatoryStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="muted">Not submitted</Badge>;
  const meta = REGULATORY_STATUS_META[status];
  return (
    <Badge variant={meta?.tone ?? 'muted'}>
      {meta?.label ?? humanizeCode(status)}
    </Badge>
  );
}
