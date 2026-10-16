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
  FleetPolicyDetailPage,
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
  FleetQuotationDetailPage,
  FleetQuotationWizardPage,
  MotorFleetCreatePage,
  MotorFleetDetailPage,
  MotorFleetEditPage,
  MotorFleetsPage,
  MotorQuotationWizardPage,
  MotorVehicleCreatePage,
  MotorVehicleDetailPage,
  MotorVehicleEditPage,
  MotorVehiclesPage,
  Page,
  PolicyCancellationPage,
  PolicyDetailPage,
  PolicyEndorsementPage,
  PolicyRenewalPage,
  QuotationDetailPage,
  UnderwriteCustomersPage,
  UnderwriteDashboardPage,
  UnderwriteLineDashboardPage,
  UnderwritePoliciesPage,
  UnderwriteQuotationsPage,
  UnderwriteTiraQueuePage,
  UnderwriteTransactionsPage,
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
              <UnderwriteTransactionScope>
                <UnderwriteRecordGate kind="policy">
                  <PolicyDetailPage />
                </UnderwriteRecordGate>
              </UnderwriteTransactionScope>
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
        <Route
          path={underwritePaths.customerDetail(LINE, ':id')}
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
          path={underwritePaths.customerCreate(LINE)}
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
          path={underwritePaths.customerEdit(LINE, ':id')}
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
            anyPermissions={ENDORSEMENT_VIEW_PERMISSIONS}
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
            anyPermissions={CANCELLATION_VIEW_PERMISSIONS}
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
          path={underwritePaths.policyEndorsementCreate(LINE, ':policyId')}
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
            LINE,
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
          path={underwritePaths.policyCancellationCreate(LINE, ':policyId')}
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
            LINE,
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
            LINE,
            ':policyId',
            ':renewalId',
          )}
          element={transactionPage(<PolicyRenewalPage />)}
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
        <UnderwriteTransactionScope>
          <FleetPolicyDetailPage />
        </UnderwriteTransactionScope>,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.VIEW), 'motor:read'],
        underwritePaths.fleetRegister,
        <MotorFleetsPage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.VIEW), 'motor:read'],
        underwritePaths.fleetDetail(':id'),
        <MotorFleetDetailPage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.CREATE), 'motor:create'],
        underwritePaths.fleetCreate,
        <MotorFleetCreatePage />,
      )}
      {guardedRoute(
        [fleetGate(UnderwriteAction.EDIT), 'motor:update'],
        underwritePaths.fleetEdit(':id'),
        <MotorFleetEditPage />,
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
