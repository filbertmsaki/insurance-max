import { lazy } from 'react';

export const MotorInsuranceQuotationsPage = lazy(() =>
  import('./pages/MotorInsuranceQuotationsPage').then((module) => ({
    default: module.MotorInsuranceQuotationsPage,
  })),
);

export const MotorInsurancePoliciesPage = lazy(() =>
  import('./pages/MotorInsurancePoliciesPage').then((module) => ({
    default: module.MotorInsurancePoliciesPage,
  })),
);

export const MotorQuotationCreatePage = lazy(() =>
  import('./pages/MotorQuotationCreatePage').then((module) => ({
    default: module.MotorQuotationCreatePage,
  })),
);

export const MotorQuotationEditPage = lazy(() =>
  import('./pages/MotorQuotationEditPage').then((module) => ({
    default: module.MotorQuotationEditPage,
  })),
);

export const MotorQuotationDetailPage = lazy(() =>
  import('./pages/MotorQuotationDetailPage').then((module) => ({
    default: module.MotorQuotationDetailPage,
  })),
);

export const MotorPolicyDetailPage = lazy(() =>
  import('./pages/MotorPolicyDetailPage').then((module) => ({
    default: module.MotorPolicyDetailPage,
  })),
);

export const MotorTransactionRegisterPage = lazy(() =>
  import('./pages/MotorTransactionRegisterPage').then((module) => ({
    default: module.MotorTransactionRegisterPage,
  })),
);

export const MotorEndorsementPage = lazy(() =>
  import('./pages/MotorPolicyTransactionPages').then((module) => ({
    default: module.MotorEndorsementPage,
  })),
);

export const MotorCancellationCreatePage = lazy(() =>
  import('./pages/MotorPolicyTransactionPages').then((module) => ({
    default: module.MotorCancellationCreatePage,
  })),
);

export const MotorCancellationDetailPage = lazy(() =>
  import('./pages/MotorPolicyTransactionPages').then((module) => ({
    default: module.MotorCancellationDetailPage,
  })),
);

export const MotorRenewalPage = lazy(() =>
  import('./pages/MotorPolicyTransactionPages').then((module) => ({
    default: module.MotorRenewalPage,
  })),
);

export const SingleMotorQuotationWizard = lazy(() =>
  import('./wizard/SingleMotorQuotationWizard').then((module) => ({
    default: module.SingleMotorQuotationWizard,
  })),
);
export const FleetQuotationWizard = lazy(() =>
  import('./wizard/FleetQuotationWizard').then((module) => ({
    default: module.FleetQuotationWizard,
  })),
);

export const MotorInsuranceCustomersPage = lazy(() =>
  import('@/modules/tenant/customers/pages/CustomersPage').then((module) => ({
    default: module.CustomersPage,
  })),
);
