import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/shared/ContentStates';
import { useUnderwriteLineParam, useUnderwriteRecordCheck } from '../hooks';
import { underwritePaths } from '../paths';

/**
 * Confirms the `:id` in the URL belongs to the `:line` in the URL (backend
 * line endpoint, which also applies data scope) before rendering a shared
 * detail screen. Until the per-line detail screens land, this is what keeps
 * `/underwrite/motor/policies/<fleet policy>` from rendering.
 */
export function UnderwriteRecordGate({
  kind,
  idParam = 'id',
  children,
}: {
  kind: 'quotation' | 'policy';
  /** Route param holding the record id (transaction routes use `policyId`). */
  idParam?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const line = useUnderwriteLineParam();
  const id = useParams()[idParam];
  const check = useUnderwriteRecordCheck(kind, line?.slug ?? 'motor', id);

  if (!line) return null;
  if (check.isLoading) return <TableSkeleton />;

  if (check.isError) {
    const listPath =
      kind === 'quotation'
        ? underwritePaths.quotations(line.slug)
        : underwritePaths.policies(line.slug);

    return (
      <EmptyState
        title={
          kind === 'quotation' ? 'Quotation not found' : 'Policy not found'
        }
        description={`This record does not exist in ${line.label}, or you do not have access to it.`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(listPath)}
          >
            Back to {line.label}{' '}
            {kind === 'quotation' ? 'quotations' : 'policies'}
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
