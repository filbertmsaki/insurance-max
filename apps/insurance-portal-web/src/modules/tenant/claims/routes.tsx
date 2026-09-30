import type { ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import {
  ClaimDetailPage,
  ClaimQueuePage,
  ClaimsConfigurationPage,
  ClaimsListPage,
  ClaimWizardPage,
  Page,
} from './lazy-pages';
import { claimsPaths } from './paths';

/** A route that requires every listed permission. */
function guardedRoute(permissions: string[], path: string, element: ReactNode) {
  return (
    <Route key={path} element={<ProtectedRoute allPermissions={permissions} />}>
      <Route path={path} element={<Page>{element}</Page>} />
    </Route>
  );
}

/**
 * Routes for `/claims/...`, rendered inside the authenticated AppShell in
 * App.tsx. `new` and `queue/*` are declared before `:id` for readability;
 * React Router ranks static segments above params either way.
 */
export function renderClaimsRoutes() {
  const { READ, CREATE, UPDATE, CONFIGURATION_MANAGE } = ClaimsPermissions;

  return (
    <>
      {guardedRoute([READ], claimsPaths.list, <ClaimsListPage />)}
      {guardedRoute([READ, CREATE], claimsPaths.create, <ClaimWizardPage />)}
      {guardedRoute([READ], claimsPaths.queue(':queue'), <ClaimQueuePage />)}
      {guardedRoute(
        [CONFIGURATION_MANAGE],
        claimsPaths.configuration,
        <ClaimsConfigurationPage />,
      )}
      {guardedRoute([READ], claimsPaths.detail(':id'), <ClaimDetailPage />)}
      {guardedRoute(
        [READ, UPDATE],
        claimsPaths.edit(':id'),
        <ClaimWizardPage />,
      )}
    </>
  );
}
