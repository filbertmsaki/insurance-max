import { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  UnderwriteLine,
  getUnderwriteLineDefinition,
} from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/shared/ContentStates';
import { PolicyTransactionScopeContext } from '@/modules/tenant/policies/transaction-scope';
import { underwriteApi } from '@/modules/tenant/underwrite/api';
import { FleetVehiclesPanel } from '@/modules/tenant/underwrite/fleet/FleetVehiclesPanel';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { MotorWizardNavigation } from '../components/MotorWizardNavigation';
import { motorInsurancePaths } from '../paths';
import { buildMotorInsuranceScope } from '../scope';

const PolicyDetailPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyDetailPage').then((module) => ({
    default: module.PolicyDetailPage,
  })),
);

/**
 * One policy detail screen for Single Motor and Fleet. The line is resolved
 * by the server from the stored policy line (with read scope) and decides the
 * layout, so a fleet reduced to one vehicle is still shown as a fleet. Fleet
 * policies add every vehicle with its cover note and sticker.
 */
export function MotorPolicyDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const lineQuery = useQuery({
    queryKey: motorInsuranceKeys.line('policy', id),
    queryFn: () => motorInsuranceApi.resolvePolicyLine(id),
    enabled: Boolean(id),
    retry: false,
  });

  if (lineQuery.isPending) return <TableSkeleton />;

  if (lineQuery.isError || !lineQuery.data) {
    return (
      <EmptyState
        title="Policy not found"
        description="It does not exist, or you do not have access to it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={motorInsurancePaths.policies}>Back to policies</Link>
          </Button>
        }
      />
    );
  }

  return <PolicyDetail id={id} line={lineQuery.data.line} />;
}

function PolicyDetail({ id, line }: { id: string; line: UnderwriteLine }) {
  const slug = getUnderwriteLineDefinition(line).slug;
  const isFleet = line === UnderwriteLine.FLEET;
  const scope = useMemo(() => buildMotorInsuranceScope(slug), [slug]);
  const policy = useQuery({
    queryKey: [...motorInsuranceKeys.all, 'policy', id, 'record'],
    queryFn: () => underwriteApi.getPolicy(slug, id),
    enabled: isFleet,
  });

  return (
    <PolicyTransactionScopeContext.Provider value={scope}>
      <MotorWizardNavigation>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link to={motorInsurancePaths.policies}>
              Back to motor policies
            </Link>
          </Button>
          <Badge variant={isFleet ? 'primary' : 'muted'}>
            {isFleet ? 'Fleet' : 'Single Motor'}
          </Badge>
        </div>
        <div className="space-y-5">
          {isFleet ? (
            <FleetVehiclesPanel
              kind="policy"
              id={id}
              currency={policy.data?.currency ?? 'TZS'}
            />
          ) : null}
          <Suspense fallback={<TableSkeleton />}>
            <PolicyDetailPage storedBusinessLine={line} />
          </Suspense>
        </div>
      </MotorWizardNavigation>
    </PolicyTransactionScopeContext.Provider>
  );
}
