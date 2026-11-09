import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  UnderwriteAction,
  UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/shared/ContentStates';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  FleetQuotationWizard,
  ShortTermQuotationWizard,
  SingleMotorQuotationWizard,
} from '../lazy-pages';
import { underwriteApi } from '@/modules/tenant/underwrite/api';
import { underwriteKeys } from '@/modules/tenant/underwrite/hooks';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import { isShortTermQuotation } from '../shortTerm';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { MotorWizardNavigation } from '../components/MotorWizardNavigation';
import { motorInsurancePaths } from '../paths';

/**
 * Edit a Motor or Fleet quotation in the wizard for its stored line. The type
 * is locked: it comes from the saved quotation, not from the user.
 */
export function MotorQuotationEditPage() {
  const { id = '' } = useParams<{ id: string }>();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const query = useQuery({
    queryKey: motorInsuranceKeys.line('quotation', id),
    queryFn: () => motorInsuranceApi.resolveQuotationLine(id),
    enabled: Boolean(id),
    retry: false,
  });

  if (query.isPending) return <TableSkeleton />;

  const line = query.data?.line;
  const allowed =
    line !== undefined &&
    hasPermission(underwritePermission(line, UnderwriteAction.EDIT)) &&
    hasPermission('quotations:update');

  if (query.isError || !line || !allowed) {
    return (
      <EmptyState
        title="Quotation not available"
        description="It does not exist, or you do not have permission to edit it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={motorInsurancePaths.quotations}>Back to quotations</Link>
          </Button>
        }
      />
    );
  }

  return <EditWizard id={id} isFleet={line === UnderwriteLine.FLEET} />;
}

/**
 * Picks the wizard. A quotation on the Short-Term transit risk reopens in the
 * Short-Term wizard; the record is read with the wizard's own query key, so
 * the wizard reuses it instead of fetching again.
 */
function EditWizard({ id, isFleet }: { id: string; isFleet: boolean }) {
  const slug = getUnderwriteLineMeta(
    isFleet ? UnderwriteLine.FLEET : UnderwriteLine.MOTOR,
  ).slug;
  const record = useQuery({
    queryKey: [...underwriteKeys.all, slug, 'edit', id],
    queryFn: () => underwriteApi.getQuotationForEdit(slug, id),
    staleTime: 30_000,
  });

  // Errors are shown by the wizard, which owns the same query.
  if (record.isPending) return <TableSkeleton />;

  const isShortTerm = isShortTermQuotation(record.data);
  const label = isShortTerm
    ? `Short-Term (In-Transit) · ${isFleet ? 'Fleet' : 'Single'}`
    : isFleet
      ? 'Fleet'
      : 'Single Motor';

  return (
    <MotorWizardNavigation>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        Quotation type:
        <Badge variant={isFleet ? 'primary' : 'muted'}>{label}</Badge>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        {isShortTerm ? (
          <ShortTermQuotationWizard lockedMode={isFleet ? 'fleet' : 'single'} />
        ) : isFleet ? (
          <FleetQuotationWizard />
        ) : (
          <SingleMotorQuotationWizard />
        )}
      </Suspense>
    </MotorWizardNavigation>
  );
}
