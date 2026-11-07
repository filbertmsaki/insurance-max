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

export const MotorTransactionsPage = lazy(() =>
  import('./pages/MotorTransactionsPage').then((module) => ({
    default: module.MotorTransactionsPage,
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
