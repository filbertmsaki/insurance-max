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
export const CustomerDetailPage = lazy(() =>
  import('@/modules/tenant/customers/pages/CustomerDetailPage').then(
    (module) => ({ default: module.CustomerDetailPage }),
  ),
);
export const CustomerCreatePage = lazy(() =>
  import('@/modules/tenant/customers/pages/CustomerCreatePage').then(
    (module) => ({ default: module.CustomerCreatePage }),
  ),
);
export const CustomerEditPage = lazy(() =>
  import('@/modules/tenant/customers/pages/CustomerEditPage').then(
    (module) => ({ default: module.CustomerEditPage }),
  ),
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
export const MotorFleetDetailPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorFleetDetailPage').then(
    (module) => ({ default: module.MotorFleetDetailPage }),
  ),
);
export const MotorFleetCreatePage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorFleetCreatePage').then(
    (module) => ({ default: module.MotorFleetCreatePage }),
  ),
);
export const MotorFleetEditPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorFleetEditPage').then((module) => ({
    default: module.MotorFleetEditPage,
  })),
);
// Central asset registry screen, reused for Motor > Vehicles.
export const MotorVehiclesPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorVehiclesPage').then((module) => ({
    default: module.MotorVehiclesPage,
  })),
);
export const MotorVehicleDetailPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorVehicleDetailPage').then(
    (module) => ({ default: module.MotorVehicleDetailPage }),
  ),
);
export const MotorVehicleCreatePage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorVehicleCreatePage').then(
    (module) => ({ default: module.MotorVehicleCreatePage }),
  ),
);
export const MotorVehicleEditPage = lazy(() =>
  import('@/modules/tenant/motor/pages/MotorVehicleEditPage').then(
    (module) => ({ default: module.MotorVehicleEditPage }),
  ),
);
export const SubjectMatterDetailPage = lazy(() =>
  import('@/modules/tenant/non-motor/pages/SubjectMatterDetailPage').then(
    (module) => ({ default: module.SubjectMatterDetailPage }),
  ),
);
export const SubjectMatterCreatePage = lazy(() =>
  import('@/modules/tenant/non-motor/pages/SubjectMatterCreatePage').then(
    (module) => ({ default: module.SubjectMatterCreatePage }),
  ),
);
export const SubjectMatterEditPage = lazy(() =>
  import('@/modules/tenant/non-motor/pages/SubjectMatterEditPage').then(
    (module) => ({ default: module.SubjectMatterEditPage }),
  ),
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
// Shared transaction screens; routes wrap them in `UnderwriteTransactionScope`
// so they call the line-scoped endpoints.
export const PolicyEndorsementPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyEndorsementPage').then(
    (module) => ({ default: module.PolicyEndorsementPage }),
  ),
);
export const PolicyCancellationPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyCancellationPage').then(
    (module) => ({ default: module.PolicyCancellationPage }),
  ),
);
export const PolicyRenewalPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyRenewalPage').then(
    (module) => ({ default: module.PolicyRenewalPage }),
  ),
);

export function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<TableSkeleton />}>{children}</Suspense>;
}
