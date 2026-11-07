import type { ReactNode } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import { Page } from '@/modules/tenant/underwrite/lazy-pages';
import {
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
  type MotorInsuranceGate,
} from './access';
import {
  MotorCancellationCreatePage,
  MotorCancellationDetailPage,
  MotorEndorsementPage,
  MotorInsurancePoliciesPage,
  MotorInsuranceQuotationsPage,
  MotorPolicyDetailPage,
  MotorQuotationCreatePage,
  MotorQuotationDetailPage,
  MotorQuotationEditPage,
  MotorRenewalPage,
  MotorTransactionsPage,
} from './lazy-pages';
import { renderLegacyMotorRedirects } from './legacyRedirects';
import { motorInsurancePaths } from './paths';
import { MOTOR_INSURANCE_CUTOVER } from './cutover';

function gated(gate: MotorInsuranceGate, path: string, element: ReactNode) {
  return (
    <Route key={path} element={<ProtectedRoute {...gate} />}>
      <Route path={path} element={<Page>{element}</Page>} />
    </Route>
  );
}

/**
 * Routes for `/apps/motor/...` (Motor Insurance (New)). Additive: the
 * existing `/apps/underwrite/motor|fleet/...` routes are untouched. Each
 * route needs the pilot permission, Motor or Fleet access for the action and
 * the existing action permission; pages that open one record also check the
 * record's own line, and the backend enforces everything again.
 */
export function renderMotorInsuranceRoutes() {
  const P = motorInsurancePaths;
  return (
    <>
      <Route path={P.root} element={<Navigate to={P.quotations} replace />} />

      {MOTOR_INSURANCE_CUTOVER && renderLegacyMotorRedirects()}

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
        MOTOR_INSURANCE_TRANSACTIONS_GATE,
        P.transactions(),
        <MotorTransactionsPage />,
      )}
    </>
  );
}
