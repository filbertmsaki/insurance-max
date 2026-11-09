import type { ReactNode } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import {
  Page,
  CustomerCreatePage,
  CustomerDetailPage,
  CustomerEditPage,
} from '@/modules/tenant/underwrite/lazy-pages';
import { UnderwriteAction } from '@insurance-max/contracts';
import {
  motorInsuranceGate,
  MOTOR_INSURANCE_CUSTOMERS_GATE,
  MOTOR_INSURANCE_CANCEL_GATE,
  MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE,
  MOTOR_INSURANCE_CREATE_GATE,
  MOTOR_INSURANCE_EDIT_GATE,
  MOTOR_INSURANCE_ENDORSE_GATE,
  MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE,
  MOTOR_INSURANCE_POLICIES_GATE,
  MOTOR_INSURANCE_QUOTATIONS_GATE,
  MOTOR_INSURANCE_RENEWALS_VIEW_GATE,
  MOTOR_INSURANCE_TRANSACTIONS_GATE,
  MOTOR_INSURANCE_TIRA_GATE,
  type MotorInsuranceGate,
} from './access';
import {
  MotorCancellationCreatePage,
  MotorCancellationDetailPage,
  MotorEndorsementPage,
  MotorInsurancePoliciesPage,
  MotorInsuranceCustomersPage,
  MotorInsuranceQuotationsPage,
  MotorPolicyDetailPage,
  MotorQuotationCreatePage,
  MotorQuotationDetailPage,
  MotorQuotationEditPage,
  MotorRenewalPage,
  MotorTransactionRegisterPage,
} from './lazy-pages';
import { renderLegacyMotorRedirects } from './legacyRedirects';
import { motorInsurancePaths } from './paths';
import { MotorTransactionsRedirect } from './components/MotorTransactionsRedirect';

function gated(gate: MotorInsuranceGate, path: string, element: ReactNode) {
  return (
    <Route key={path} element={<ProtectedRoute {...gate} />}>
      <Route path={path} element={<Page>{element}</Page>} />
    </Route>
  );
}

/**
 * Permanent quotation, policy and transaction routes for Single Motor and Fleet.
 * Old URLs are redirect aliases only. Each action retains its line and operation
 * permissions; record pages resolve and check the stored line on the server.
 */
export function renderMotorInsuranceRoutes() {
  const P = motorInsurancePaths;
  return (
    <>
      <Route path={P.root} element={<Navigate to={P.quotations} replace />} />

      {renderLegacyMotorRedirects()}

      {gated(
        MOTOR_INSURANCE_CUSTOMERS_GATE,
        P.customers,
        <MotorInsuranceCustomersPage />,
      )}
      {gated(
        motorInsuranceGate(UnderwriteAction.CREATE, 'customers:create'),
        P.customerCreate,
        <CustomerCreatePage />,
      )}
      {gated(
        MOTOR_INSURANCE_CUSTOMERS_GATE,
        P.customerDetail(':id'),
        <CustomerDetailPage />,
      )}
      {gated(
        motorInsuranceGate(UnderwriteAction.EDIT, 'customers:update'),
        P.customerEdit(':id'),
        <CustomerEditPage />,
      )}

      {gated(
        MOTOR_INSURANCE_CREATE_GATE,
        P.quotationCreate(),
        <MotorQuotationCreatePage />,
      )}
      {gated(
        MOTOR_INSURANCE_EDIT_GATE,
        P.quotationEdit(':id'),
        <MotorQuotationEditPage />,
      )}
      {gated(
        MOTOR_INSURANCE_QUOTATIONS_GATE,
        P.quotations,
        <MotorInsuranceQuotationsPage />,
      )}
      {gated(
        MOTOR_INSURANCE_QUOTATIONS_GATE,
        P.quotationDetail(':id'),
        <MotorQuotationDetailPage />,
      )}

      {gated(
        MOTOR_INSURANCE_POLICIES_GATE,
        P.policies,
        <MotorInsurancePoliciesPage />,
      )}
      {gated(
        MOTOR_INSURANCE_POLICIES_GATE,
        P.policyDetail(':id'),
        <MotorPolicyDetailPage />,
      )}

      {gated(
        MOTOR_INSURANCE_ENDORSE_GATE,
        P.policyEndorsementCreate(':policyId'),
        <MotorEndorsementPage />,
      )}
      {gated(
        MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE,
        P.policyEndorsementEdit(':policyId', ':endorsementId'),
        <MotorEndorsementPage />,
      )}
      {gated(
        MOTOR_INSURANCE_CANCEL_GATE,
        P.policyCancellationCreate(':policyId'),
        <MotorCancellationCreatePage />,
      )}
      {gated(
        MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE,
        P.policyCancellationDetail(':policyId', ':cancellationId'),
        <MotorCancellationDetailPage />,
      )}
      {gated(
        MOTOR_INSURANCE_RENEWALS_VIEW_GATE,
        P.policyRenewalDetail(':policyId', ':renewalId'),
        <MotorRenewalPage />,
      )}

      {gated(
        MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE,
        P.transactions('endorsements'),
        <MotorTransactionRegisterPage kind="endorsements" />,
      )}
      {gated(
        MOTOR_INSURANCE_RENEWALS_VIEW_GATE,
        P.transactions('renewals'),
        <MotorTransactionRegisterPage kind="renewals" />,
      )}
      {gated(
        MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE,
        P.transactions('cancellations'),
        <MotorTransactionRegisterPage kind="cancellations" />,
      )}
      {gated(
        MOTOR_INSURANCE_TIRA_GATE,
        P.transactions('tira-pending'),
        <MotorTransactionRegisterPage kind="tira-pending" />,
      )}
      {/* Retired exceptions page: show failed quotations in the main register. */}
      <Route
        path="/apps/motor/tira-failed"
        element={<Navigate to={P.failedSubmissions} replace />}
      />

      {gated(
        MOTOR_INSURANCE_TRANSACTIONS_GATE,
        P.transactions(),
        <MotorTransactionsRedirect />,
      )}
    </>
  );
}
