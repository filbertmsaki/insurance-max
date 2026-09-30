import { lazy, Suspense, type ReactNode } from 'react';
import { TableSkeleton } from '@/components/shared/ContentStates';

export const UnderwriteDashboardPage = lazy(() =>
  import('./pages/UnderwriteDashboardPage').then((module) => ({
    default: module.UnderwriteDashboardPage,
  })),
);
export const UnderwriteLineDashboardPage = lazy(() =>
  import('./pages/UnderwriteLineDashboardPage').then((module) => ({
    default: module.UnderwriteLineDashboardPage,
  })),
);
export const UnderwriteQuotationsPage = lazy(() =>
  import('./pages/UnderwriteQuotationsPage').then((module) => ({
    default: module.UnderwriteQuotationsPage,
  })),
);
export const UnderwritePoliciesPage = lazy(() =>
  import('./pages/UnderwritePoliciesPage').then((module) => ({
    default: module.UnderwritePoliciesPage,
  })),
);
export const UnderwriteCustomersPage = lazy(() =>
  import('./pages/UnderwriteCustomersPage').then((module) => ({
    default: module.UnderwriteCustomersPage,
  })),
);
export const UnderwriteTransactionsPage = lazy(() =>
  import('./pages/UnderwriteTransactionsPage').then((module) => ({
    default: module.UnderwriteTransactionsPage,
  })),
);
export const UnderwriteTiraQueuePage = lazy(() =>
  import('./pages/UnderwriteTransactionsPage').then((module) => ({
    default: module.UnderwriteTiraQueuePage,
  })),
);
export const MotorQuotationWizardPage = lazy(() =>
  import('./motor/MotorQuotationWizardPage').then((module) => ({
    default: module.MotorQuotationWizardPage,
  })),
);
export const NonMotorQuotationWizardPage = lazy(() =>
  import('./non-motor/NonMotorQuotationWizardPage').then((module) => ({
    default: module.NonMotorQuotationWizardPage,
  })),
);
export const NonMotorQuotationDetailPage = lazy(() =>
  import('./non-motor/NonMotorDetailPages').then((module) => ({
    default: module.NonMotorQuotationDetailPage,
  })),
);
export const NonMotorPolicyDetailPage = lazy(() =>
  import('./non-motor/NonMotorDetailPages').then((module) => ({
    default: module.NonMotorPolicyDetailPage,
  })),
);
export const RiskSchemasPage = lazy(() =>
  import('./non-motor/RiskSchemasPage').then((module) => ({
    default: module.RiskSchemasPage,
  })),
);
// Central non-motor risk register, reused for Non-Motor > Risks.
export const SubjectMattersPage = lazy(() =>
  import('@/modules/tenant/non-motor/pages/SubjectMattersPage').then(
    (module) => ({ default: module.SubjectMattersPage }),
  ),
);
export const FleetQuotationWizardPage = lazy(() =>
  import('./fleet/FleetQuotationWizardPage').then((module) => ({
    default: module.FleetQuotationWizardPage,
  })),
);
export const FleetQuotationDetailPage = lazy(() =>
  import('./fleet/FleetDetailPages').then((module) => ({
    default: module.FleetQuotationDetailPage,
  })),
);
export const FleetPolicyDetailPage = lazy(() =>
  import('./fleet/FleetDetailPages').then((module) => ({
    default: module.FleetPolicyDetailPage,
  })),
);
// Central fleet register screen, reused for Fleet > Fleets.
export const MotorFleetsPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorFleetsPage').then((module) => ({
    default: module.MotorFleetsPage,
  })),
);
// Central asset registry screen, reused for Motor > Vehicles.
export const MotorVehiclesPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorVehiclesPage').then((module) => ({
    default: module.MotorVehiclesPage,
  })),
);
// Shared detail screens are reused as-is until the per-line screens land.
export const QuotationDetailPage = lazy(() =>
  import('@/modules/tenant/quotations/pages/QuotationDetailPage').then(
    (module) => ({ default: module.QuotationDetailPage }),
  ),
);
export const PolicyDetailPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyDetailPage').then((module) => ({
    default: module.PolicyDetailPage,
  })),
);

export function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<TableSkeleton />}>{children}</Suspense>;
}
