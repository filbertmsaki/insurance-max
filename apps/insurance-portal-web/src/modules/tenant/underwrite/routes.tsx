import type { ReactNode } from 'react';
import { Navigate, Route } from 'react-router-dom';
import {
  UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
  UnderwriteAction,
  UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import { UnderwriteLineRoute } from './components/UnderwriteLineRoute';
import { UnderwriteRecordGate } from './components/UnderwriteRecordGate';
import {
  FleetPolicyDetailPage,
  NonMotorPolicyDetailPage,
  NonMotorQuotationDetailPage,
  NonMotorQuotationWizardPage,
  RiskSchemasPage,
  SubjectMattersPage,
  FleetQuotationDetailPage,
  FleetQuotationWizardPage,
  MotorFleetsPage,
  MotorQuotationWizardPage,
  MotorVehiclesPage,
  Page,
  PolicyDetailPage,
  QuotationDetailPage,
  UnderwriteCustomersPage,
  UnderwriteDashboardPage,
  UnderwriteLineDashboardPage,
  UnderwritePoliciesPage,
  UnderwriteQuotationsPage,
  UnderwriteTiraQueuePage,
  UnderwriteTransactionsPage,
} from './lazy-pages';
import { underwritePaths } from './paths';

const LINE = ':line';

/** A route that requires every listed permission. */
function guardedRoute(permissions: string[], path: string, element: ReactNode) {
  return (
    <Route key={path} element={<ProtectedRoute allPermissions={permissions} />}>
      <Route path={path} element={<Page>{element}</Page>} />
    </Route>
  );
}

const fleetGate = (action: Parameters<typeof underwritePermission>[1]) =>
  underwritePermission(UnderwriteLine.FLEET, action);
const nonMotorGate = (action: Parameters<typeof underwritePermission>[1]) =>
  underwritePermission(UnderwriteLine.NON_MOTOR, action);

/**
 * Routes for `/underwrite/...`. Rendered inside the authenticated AppShell in
 * App.tsx. Called as a function (not a component) because `<Routes>` only
 * accepts `<Route>` elements as children.
 */
export function renderUnderwriteRoutes() {
  return (
    <>
      <Route
        path={underwritePaths.root}
        element={<Navigate to={underwritePaths.dashboard} replace />}
      />
      <Route
        element={
          <ProtectedRoute
            allPermissions={[UNDERWRITE_DASHBOARD_VIEW_PERMISSION]}
          />
        }
      >
        <Route
          path={underwritePaths.dashboard}
          element={
            <Page>
              <UnderwriteDashboardPage />
            </Page>
          }
        />
      </Route>

      <Route element={<UnderwriteLineRoute action={UnderwriteAction.VIEW} />}>
        <Route
          path={underwritePaths.line(LINE)}
          element={<Navigate to="dashboard" replace />}
        />
        <Route
          path={underwritePaths.lineDashboard(LINE)}
          element={
            <Page>
              <UnderwriteLineDashboardPage />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.VIEW}
            permission="quotations:read"
          />
        }
      >
        <Route
          path={underwritePaths.quotations(LINE)}
          element={
            <Page>
              <UnderwriteQuotationsPage />
            </Page>
          }
        />
        <Route
          path={underwritePaths.quotationDetail(LINE, ':id')}
          element={
            <Page>
              <UnderwriteRecordGate kind="quotation">
                <QuotationDetailPage />
              </UnderwriteRecordGate>
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.POLICIES_VIEW}
            permission="policies:read"
          />
        }
      >
        <Route
          path={underwritePaths.policies(LINE)}
          element={
            <Page>
              <UnderwritePoliciesPage />
            </Page>
          }
        />
        <Route
          path={underwritePaths.policyDetail(LINE, ':id')}
          element={
            <Page>
              <UnderwriteRecordGate kind="policy">
                <PolicyDetailPage />
              </UnderwriteRecordGate>
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.VIEW}
            permission="customers:read"
          />
        }
      >
        <Route
          path={underwritePaths.customers(LINE)}
          element={
            <Page>
              <UnderwriteCustomersPage />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.RENEWALS_VIEW}
            permission="renewals:read"
          />
        }
      >
        <Route
          path={underwritePaths.renewals(LINE)}
          element={
            <Page>
              <UnderwriteTransactionsPage kind="renewals" />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.ENDORSEMENTS_VIEW}
            permission="endorsements:create"
          />
        }
      >
        <Route
          path={underwritePaths.endorsements(LINE)}
          element={
            <Page>
              <UnderwriteTransactionsPage kind="endorsements" />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.CANCELLATIONS_VIEW}
            permission="cancellations:read"
          />
        }
      >
        <Route
          path={underwritePaths.cancellations(LINE)}
          element={
            <Page>
              <UnderwriteTransactionsPage kind="cancellations" />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.TIRA_RETRY}
            anyPermissions={[
              'quotations:retry-tiramis',
              'endorsements:retry-tiramis',
              'cancellations:submit-tiramis',
            ]}
          />
        }
      >
        <Route
          path={underwritePaths.tiraFailed(LINE)}
          element={
            <Page>
              <UnderwriteTiraQueuePage kind="failed" />
            </Page>
          }
        />
        <Route
          path={underwritePaths.tiraPending(LINE)}
          element={
            <Page>
              <UnderwriteTiraQueuePage kind="pending" />
            </Page>
          }
        />
      </Route>

      {/* Motor: its own wizard (static paths outrank `:line/quotations/:id`). */}
      <Route
        element={
          <ProtectedRoute
            allPermissions={[
              underwritePermission(
                UnderwriteLine.MOTOR,
                UnderwriteAction.CREATE,
              ),
              'quotations:create',
            ]}
          />
        }
      >
        <Route
          path={underwritePaths.quotationCreate('motor')}
          element={
            <Page>
              <MotorQuotationWizardPage />
            </Page>
          }
        />
      </Route>
      <Route
        element={
          <ProtectedRoute
            allPermissions={[
              underwritePermission(UnderwriteLine.MOTOR, UnderwriteAction.EDIT),
              'quotations:update',
            ]}
          />
        }
      >
        <Route
          path={underwritePaths.quotationEdit('motor', ':id')}
          element={
            <Page>
              <MotorQuotationWizardPage />
            </Page>
          }
        />
      </Route>
      <Route
        element={
          <ProtectedRoute
            allPermissions={[
              underwritePermission(UnderwriteLine.MOTOR, UnderwriteAction.VIEW),
              'motor:read',
            ]}
          />
        }
      >
        <Route
          path={underwritePaths.motorVehicles}
          element={
            <Page>
              <MotorVehiclesPage />
            </Page>
          }
        />
      </Route>

      {/* Fleet: its own wizard and vehicle-level detail screens. */}
      {guardedRoute(
        [fleetGate(UnderwriteAction.CREATE), 'quotations:create'],
        underwritePaths.quotationCreate('fleet'),
        <FleetQuotationWizardPage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.EDIT), 'quotations:update'],
        underwritePaths.quotationEdit('fleet', ':id'),
        <FleetQuotationWizardPage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.VIEW), 'quotations:read'],
        underwritePaths.quotationDetail('fleet', ':id'),
        <FleetQuotationDetailPage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.POLICIES_VIEW), 'policies:read'],
        underwritePaths.policyDetail('fleet', ':id'),
        <FleetPolicyDetailPage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.VIEW), 'motor:read'],
        underwritePaths.fleetRegister,
        <MotorFleetsPage />,
      )}

      {/* Non-Motor: its own wizard, risk schemas and risk-aware details. */}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.CREATE), 'quotations:create'],
        underwritePaths.quotationCreate('non-motor'),
        <NonMotorQuotationWizardPage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.EDIT), 'quotations:update'],
        underwritePaths.quotationEdit('non-motor', ':id'),
        <NonMotorQuotationWizardPage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.VIEW), 'quotations:read'],
        underwritePaths.quotationDetail('non-motor', ':id'),
        <NonMotorQuotationDetailPage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.POLICIES_VIEW), 'policies:read'],
        underwritePaths.policyDetail('non-motor', ':id'),
        <NonMotorPolicyDetailPage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.EDIT), 'insurance-products:update'],
        underwritePaths.riskSchemas,
        <RiskSchemasPage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.VIEW), 'non-motor:read'],
        underwritePaths.nonMotorRisks,
        <SubjectMattersPage />,
      )}
    </>
  );
}
