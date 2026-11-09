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
import { UnderwriteTransactionScope } from './components/UnderwriteTransactionScope';
import {
  CustomerCreatePage,
  CustomerDetailPage,
  CustomerEditPage,
  NonMotorPolicyDetailPage,
  NonMotorQuotationDetailPage,
  NonMotorQuotationWizardPage,
  RiskSchemasPage,
  SubjectMattersPage,
  SubjectMatterCreatePage,
  SubjectMatterDetailPage,
  SubjectMatterEditPage,
  MotorVehicleCreatePage,
  MotorVehicleDetailPage,
  MotorVehicleEditPage,
  MotorVehiclesPage,
  Page,
  PolicyCancellationPage,
  PolicyEndorsementPage,
  PolicyRenewalPage,
  UnderwriteCustomersPage,
  UnderwriteDashboardPage,
  UnderwriteLineDashboardPage,
  NonMotorPoliciesPage,
  NonMotorQuotationsPage,
  NonMotorTiraQueuePage,
  NonMotorTransactionsPage,
} from './lazy-pages';
import {
  CANCELLATION_VIEW_PERMISSIONS,
  ENDORSEMENT_VIEW_PERMISSIONS,
} from './lines';
import { underwritePaths } from './paths';

const LINE = ':line';

/**
 * A shared endorsement/cancellation/renewal screen for the policy in
 * `:policyId`, confirmed to belong to the line and running on its endpoints.
 */
function transactionPage(element: ReactNode) {
  return (
    <Page>
      <UnderwriteTransactionScope>
        <UnderwriteRecordGate kind="policy" idParam="policyId">
          {element}
        </UnderwriteRecordGate>
      </UnderwriteTransactionScope>
    </Page>
  );
}

/** A route that requires every listed permission. */
function guardedRoute(permissions: string[], path: string, element: ReactNode) {
  return (
    <Route key={path} element={<ProtectedRoute allPermissions={permissions} />}>
      <Route path={path} element={<Page>{element}</Page>} />
    </Route>
  );
}

const nonMotorGate = (action: Parameters<typeof underwritePermission>[1]) =>
  underwritePermission(UnderwriteLine.NON_MOTOR, action);

/**
 * Routes for `/apps/underwrite/...`. Rendered inside the authenticated AppShell in
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
          path={underwritePaths.quotations('non-motor')}
          element={
            <Page>
              <NonMotorQuotationsPage />
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
          path={underwritePaths.policies('non-motor')}
          element={
            <Page>
              <NonMotorPoliciesPage />
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
          path={underwritePaths.customers('non-motor')}
          element={
            <Page>
              <UnderwriteCustomersPage />
            </Page>
          }
        />
        <Route
          path={underwritePaths.customerDetail('non-motor', ':id')}
          element={
            <Page>
              <CustomerDetailPage />
            </Page>
          }
        />
      </Route>
      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.CREATE}
            permission="customers:create"
          />
        }
      >
        <Route
          path={underwritePaths.customerCreate('non-motor')}
          element={
            <Page>
              <CustomerCreatePage />
            </Page>
          }
        />
      </Route>
      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.EDIT}
            permission="customers:update"
          />
        }
      >
        <Route
          path={underwritePaths.customerEdit('non-motor', ':id')}
          element={
            <Page>
              <CustomerEditPage />
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
          path={underwritePaths.renewals('non-motor')}
          element={
            <Page>
              <NonMotorTransactionsPage kind="renewals" />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.ENDORSEMENTS_VIEW}
            anyPermissions={ENDORSEMENT_VIEW_PERMISSIONS}
          />
        }
      >
        <Route
          path={underwritePaths.endorsements('non-motor')}
          element={
            <Page>
              <NonMotorTransactionsPage kind="endorsements" />
            </Page>
          }
        />
      </Route>

      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.CANCELLATIONS_VIEW}
            anyPermissions={CANCELLATION_VIEW_PERMISSIONS}
          />
        }
      >
        <Route
          path={underwritePaths.cancellations('non-motor')}
          element={
            <Page>
              <NonMotorTransactionsPage kind="cancellations" />
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
          path={underwritePaths.tiraFailed('non-motor')}
          element={
            <Page>
              <NonMotorTiraQueuePage kind="failed" />
            </Page>
          }
        />
        <Route
          path={underwritePaths.tiraPending('non-motor')}
          element={
            <Page>
              <NonMotorTiraQueuePage kind="pending" />
            </Page>
          }
        />
      </Route>

      {/* Policy transactions: line gate + the legacy route's permission. */}
      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.ENDORSEMENTS_MANAGE}
            permission="endorsements:create"
          />
        }
      >
        <Route
          path={underwritePaths.policyEndorsementCreate(
            'non-motor',
            ':policyId',
          )}
          element={transactionPage(<PolicyEndorsementPage />)}
        />
      </Route>
      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.ENDORSEMENTS_VIEW}
            anyPermissions={ENDORSEMENT_VIEW_PERMISSIONS}
          />
        }
      >
        <Route
          path={underwritePaths.policyEndorsementEdit(
            'non-motor',
            ':policyId',
            ':endorsementId',
          )}
          element={transactionPage(<PolicyEndorsementPage />)}
        />
      </Route>
      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.CANCELLATIONS_MANAGE}
            permission="cancellations:create"
          />
        }
      >
        <Route
          path={underwritePaths.policyCancellationCreate(
            'non-motor',
            ':policyId',
          )}
          element={transactionPage(<PolicyCancellationPage />)}
        />
      </Route>
      <Route
        element={
          <UnderwriteLineRoute
            action={UnderwriteAction.CANCELLATIONS_VIEW}
            anyPermissions={CANCELLATION_VIEW_PERMISSIONS}
          />
        }
      >
        <Route
          path={underwritePaths.policyCancellationDetail(
            'non-motor',
            ':policyId',
            ':cancellationId',
          )}
          element={transactionPage(<PolicyCancellationPage />)}
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
          path={underwritePaths.policyRenewalDetail(
            'non-motor',
            ':policyId',
            ':renewalId',
          )}
          element={transactionPage(<PolicyRenewalPage />)}
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
        <Route
          path={underwritePaths.motorVehicleDetail(':id')}
          element={
            <Page>
              <MotorVehicleDetailPage />
            </Page>
          }
        />
      </Route>
      <Route
        element={
          <ProtectedRoute
            allPermissions={[
              underwritePermission(
                UnderwriteLine.MOTOR,
                UnderwriteAction.CREATE,
              ),
              'motor:create',
            ]}
          />
        }
      >
        <Route
          path={underwritePaths.motorVehicleCreate}
          element={
            <Page>
              <MotorVehicleCreatePage />
            </Page>
          }
        />
      </Route>
      <Route
        element={
          <ProtectedRoute
            allPermissions={[
              underwritePermission(UnderwriteLine.MOTOR, UnderwriteAction.EDIT),
              'motor:update',
            ]}
          />
        }
      >
        <Route
          path={underwritePaths.motorVehicleEdit(':id')}
          element={
            <Page>
              <MotorVehicleEditPage />
            </Page>
          }
        />
      </Route>

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
        <UnderwriteTransactionScope>
          <NonMotorPolicyDetailPage />
        </UnderwriteTransactionScope>,
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
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.VIEW), 'non-motor:read'],
        underwritePaths.nonMotorRiskDetail(':id'),
        <SubjectMatterDetailPage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.CREATE), 'non-motor:create'],
        underwritePaths.nonMotorRiskCreate,
        <SubjectMatterCreatePage />,
      )}
      {guardedRoute(
        [nonMotorGate(UnderwriteAction.EDIT), 'non-motor:update'],
        underwritePaths.nonMotorRiskEdit(':id'),
        <SubjectMatterEditPage />,
      )}
    </>
  );
}
