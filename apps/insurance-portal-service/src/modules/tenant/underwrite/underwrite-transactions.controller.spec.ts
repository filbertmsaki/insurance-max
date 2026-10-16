import 'reflect-metadata';
import { UnderwriteAction } from '@insurance-max/contracts';
import { ANY_PERMISSIONS_KEY } from '@insurance-max/portal-shared/decorators/authorization.decorator';
import { PERMISSIONS_KEY } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { UNDERWRITE_LINE_ACTION_KEY } from './common/underwrite-line.access';
import { UnderwriteTransactionsController } from './underwrite-transactions.controller';

type ControllerMethod = keyof {
  [Key in keyof UnderwriteTransactionsController as UnderwriteTransactionsController[Key] extends (
    ...args: never[]
  ) => unknown
    ? Key
    : never]: UnderwriteTransactionsController[Key];
};

interface EndpointExpectation {
  method: ControllerMethod;
  action: string;
  permissions?: string[];
  anyPermissions?: string[];
}

const ENDPOINT_MATRIX: EndpointExpectation[] = [
  {
    method: 'listRenewals',
    action: UnderwriteAction.RENEWALS_VIEW,
    permissions: ['renewals:read'],
  },
  {
    method: 'listEndorsements',
    action: UnderwriteAction.ENDORSEMENTS_VIEW,
    anyPermissions: [
      'endorsements:create',
      'policy-transactions:read',
      'endorsements:approve',
    ],
  },
  {
    method: 'listCancellations',
    action: UnderwriteAction.CANCELLATIONS_VIEW,
    anyPermissions: ['cancellations:read', 'cancellations:approve'],
  },
  {
    method: 'listTiraFailed',
    action: UnderwriteAction.TIRA_RETRY,
    anyPermissions: [
      'quotations:retry-tiramis',
      'endorsements:retry-tiramis',
      'cancellations:submit-tiramis',
    ],
  },
  {
    method: 'listTiraPending',
    action: UnderwriteAction.TIRA_RETRY,
    anyPermissions: [
      'quotations:retry-tiramis',
      'endorsements:retry-tiramis',
      'cancellations:submit-tiramis',
    ],
  },
  {
    method: 'endorsementEligibility',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:create'],
  },
  {
    method: 'createEndorsement',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:create'],
  },
  {
    method: 'endorsementContext',
    action: UnderwriteAction.ENDORSEMENTS_VIEW,
    anyPermissions: ['endorsements:update-draft', 'endorsements:approve'],
  },
  {
    method: 'recordEndorsementChange',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:update-draft'],
  },
  {
    method: 'recalculateEndorsement',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:update-draft'],
  },
  {
    method: 'completeEndorsement',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:complete'],
  },
  {
    method: 'submitEndorsementApproval',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:submit-approval'],
  },
  {
    method: 'approveEndorsement',
    action: UnderwriteAction.APPROVE,
    permissions: ['endorsements:approve'],
  },
  {
    method: 'rejectEndorsement',
    action: UnderwriteAction.APPROVE,
    permissions: ['endorsements:approve'],
  },
  {
    method: 'requestEndorsementChanges',
    action: UnderwriteAction.APPROVE,
    permissions: ['endorsements:approve'],
  },
  {
    method: 'requestEndorsementPayment',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:request-payment'],
  },
  {
    method: 'submitEndorsementTiramis',
    action: UnderwriteAction.TIRA_RETRY,
    permissions: ['endorsements:submit-tiramis'],
  },
  {
    method: 'retryEndorsementTiramis',
    action: UnderwriteAction.TIRA_RETRY,
    anyPermissions: ['endorsements:retry-tiramis', 'endorsements:reconcile'],
  },
  {
    method: 'cancelEndorsement',
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    permissions: ['endorsements:cancel'],
  },
  {
    method: 'cancellationEligibility',
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    permissions: ['cancellations:create'],
  },
  {
    method: 'createCancellation',
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    permissions: ['cancellations:create'],
  },
  {
    method: 'cancellationContext',
    action: UnderwriteAction.CANCELLATIONS_VIEW,
    anyPermissions: ['cancellations:read', 'cancellations:approve'],
  },
  {
    method: 'completeCancellation',
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    permissions: ['cancellations:complete'],
  },
  {
    method: 'submitCancellationApproval',
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    permissions: ['cancellations:complete'],
  },
  {
    method: 'approveCancellation',
    action: UnderwriteAction.APPROVE,
    permissions: ['cancellations:approve'],
  },
  {
    method: 'rejectCancellation',
    action: UnderwriteAction.APPROVE,
    permissions: ['cancellations:approve'],
  },
  {
    method: 'requestCancellationChanges',
    action: UnderwriteAction.APPROVE,
    permissions: ['cancellations:approve'],
  },
  {
    method: 'requestCancellationPayment',
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    permissions: ['cancellations:request-payment'],
  },
  {
    method: 'submitCancellationTiramis',
    action: UnderwriteAction.TIRA_RETRY,
    permissions: ['cancellations:submit-tiramis'],
  },
  {
    method: 'cancelCancellation',
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    permissions: ['cancellations:cancel'],
  },
  {
    method: 'renewalEligibility',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:create'],
  },
  {
    method: 'createRenewal',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:create'],
  },
  {
    method: 'renewalContext',
    action: UnderwriteAction.RENEWALS_VIEW,
    permissions: ['renewals:read'],
  },
  {
    method: 'createRenewalOffer',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:create-offer'],
  },
  {
    method: 'linkRenewalQuotation',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:create-offer'],
  },
  {
    method: 'sendRenewalOffer',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:send-offer'],
  },
  {
    method: 'acceptRenewal',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:accept'],
  },
  {
    method: 'declineRenewal',
    action: UnderwriteAction.RENEWALS_MANAGE,
    permissions: ['renewals:decline'],
  },
  {
    method: 'retryQuotationTira',
    action: UnderwriteAction.TIRA_RETRY,
    permissions: ['quotations:retry-tiramis'],
  },
];

describe('UnderwriteTransactionsController permissions', () => {
  it.each(ENDPOINT_MATRIX)(
    '$method declares both a legacy permission and an underwrite line gate',
    ({ method, action, permissions, anyPermissions }) => {
      const handler = UnderwriteTransactionsController.prototype[method];

      expect(Reflect.getMetadata(UNDERWRITE_LINE_ACTION_KEY, handler)).toBe(
        action,
      );
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(
        permissions,
      );
      expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler)).toEqual(
        anyPermissions,
      );
    },
  );
});
