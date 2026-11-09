import { Suspense, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  UnderwriteLine,
  type UnderwriteActionValue,
  getUnderwriteLineDefinition,
} from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/shared/ContentStates';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { PolicyTransactionScopeContext } from '@/modules/tenant/policies/transaction-scope';
import { hasLineGate } from '../access';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { motorInsurancePaths } from '../paths';
import { buildMotorInsuranceScope } from '../scope';
import { MotorWizardNavigation } from './MotorWizardNavigation';

/**
 * Hosts a shared policy-transaction screen (endorsement, cancellation,
 * renewal) for the policy in `:policyId` inside the Motor Insurance module:
 * resolves the policy's line on the server (with read scope), requires the
 * line gate for `action`, and provides that line's transaction scope with
 * module links. The backend still enforces every command.
 */
export function MotorPolicyScope({
  action,
  children,
}: {
  action: UnderwriteActionValue;
  children: (line: UnderwriteLine) => ReactNode;
}) {
  const { policyId = '' } = useParams<{ policyId: string }>();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const lineQuery = useQuery({
    queryKey: motorInsuranceKeys.line('policy', policyId),
    queryFn: () => motorInsuranceApi.resolvePolicyLine(policyId),
    enabled: Boolean(policyId),
    retry: false,
  });
  const line = lineQuery.data?.line;
  const scope = useMemo(
    () =>
      line
        ? buildMotorInsuranceScope(getUnderwriteLineDefinition(line).slug)
        : null,
    [line],
  );

  if (lineQuery.isPending) return <TableSkeleton />;

  if (!line || !scope || !hasLineGate(hasPermission, line, action)) {
    return (
      <EmptyState
        title="Not available"
        description="The policy does not exist, or you do not have permission for this action on it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={motorInsurancePaths.policies}>Back to policies</Link>
          </Button>
        }
      />
    );
  }

  const isFleet = line === UnderwriteLine.FLEET;

  return (
    <PolicyTransactionScopeContext.Provider value={scope}>
      <MotorWizardNavigation>
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link to={motorInsurancePaths.policyDetail(policyId)}>
              Back to policy
            </Link>
          </Button>
          <Badge variant={isFleet ? 'primary' : 'muted'}>
            {isFleet ? 'Fleet' : 'Single Motor'}
          </Badge>
        </div>
        <Suspense fallback={<TableSkeleton />}>{children(line)}</Suspense>
      </MotorWizardNavigation>
    </PolicyTransactionScopeContext.Provider>
  );
}
