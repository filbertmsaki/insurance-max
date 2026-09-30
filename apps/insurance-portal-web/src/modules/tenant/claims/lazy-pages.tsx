import { lazy, Suspense, type ReactNode } from 'react';
import { TableSkeleton } from '@/components/shared/ContentStates';

export const ClaimsListPage = lazy(() =>
  import('./pages/ClaimsListPage').then((module) => ({
    default: module.ClaimsListPage,
  })),
);
export const ClaimQueuePage = lazy(() =>
  import('./pages/ClaimsListPage').then((module) => ({
    default: module.ClaimQueuePage,
  })),
);
export const ClaimDetailPage = lazy(() =>
  import('./pages/ClaimDetailPage').then((module) => ({
    default: module.ClaimDetailPage,
  })),
);
export const ClaimWizardPage = lazy(() =>
  import('./wizard/ClaimWizardPage').then((module) => ({
    default: module.ClaimWizardPage,
  })),
);

export const ClaimsConfigurationPage = lazy(() =>
  import('./pages/ClaimsConfigurationPage').then((module) => ({
    default: module.ClaimsConfigurationPage,
  })),
);

export function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<TableSkeleton />}>{children}</Suspense>;
}
