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
  FleetQuotationWizardPage,
  MotorQuotationWizardPage,
} from '@/modules/tenant/underwrite/lazy-pages';
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

  const isFleet = line === UnderwriteLine.FLEET;
  const Wizard = isFleet ? FleetQuotationWizardPage : MotorQuotationWizardPage;

  return (
    <MotorWizardNavigation>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        Quotation type:
        <Badge variant={isFleet ? 'primary' : 'muted'}>
          {isFleet ? 'Fleet' : 'Single Motor'}
        </Badge>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <Wizard />
      </Suspense>
    </MotorWizardNavigation>
  );
}
