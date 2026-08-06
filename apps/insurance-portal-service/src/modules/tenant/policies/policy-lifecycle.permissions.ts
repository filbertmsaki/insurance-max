/**
 * Phase 13 policy-transaction permissions. These are string constants for
 * reference/type-safety — controllers apply the literal strings directly
 * via `@Permissions(...)`, matching the convention used elsewhere in this
 * codebase (e.g. `PoliciesController`).
 */
export const PolicyLifecyclePermissions = {
  POLICY_TRANSACTIONS_READ: 'policy-transactions:read',

  ENDORSEMENT_CREATE: 'endorsements:create',
  ENDORSEMENT_UPDATE_DRAFT: 'endorsements:update-draft',
  ENDORSEMENT_COMPLETE: 'endorsements:complete',
  ENDORSEMENT_SUBMIT_APPROVAL: 'endorsements:submit-approval',
  ENDORSEMENT_APPROVE: 'endorsements:approve',
  ENDORSEMENT_REQUEST_PAYMENT: 'endorsements:request-payment',
  ENDORSEMENT_SUBMIT_TIRAMIS: 'endorsements:submit-tiramis',
  ENDORSEMENT_RETRY_TIRAMIS: 'endorsements:retry-tiramis',
  ENDORSEMENT_CANCEL: 'endorsements:cancel',

  CANCELLATION_CREATE: 'cancellations:create',
  CANCELLATION_COMPLETE: 'cancellations:complete',
  CANCELLATION_CLAIMS_REVIEW: 'cancellations:claims-review',
  CANCELLATION_APPROVE: 'cancellations:approve',
  CANCELLATION_REQUEST_PAYMENT: 'cancellations:request-payment',
  CANCELLATION_SUBMIT_TIRAMIS: 'cancellations:submit-tiramis',
  CANCELLATION_CANCEL: 'cancellations:cancel',

  RENEWAL_READ: 'renewals:read',
  RENEWAL_CREATE: 'renewals:create',
  RENEWAL_CREATE_OFFER: 'renewals:create-offer',
  RENEWAL_SEND_OFFER: 'renewals:send-offer',
  RENEWAL_ACCEPT: 'renewals:accept',
  RENEWAL_DECLINE: 'renewals:decline',
  RENEWAL_CANCEL: 'renewals:cancel',

  POLICY_VERSIONS_READ: 'policy-versions:read',
  POLICY_VERSIONS_READ_SENSITIVE: 'policy-versions:read-sensitive',
} as const;
