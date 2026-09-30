/**
 * Claims permission catalogue shared by the portal service and web app.
 * Names follow the project `resource:action` convention; every value here
 * must exist in the RBAC seed (001-initial-rbac.seed.ts) or a migration.
 */
export const ClaimsPermissions = {
  READ: 'claims:read',
  CREATE: 'claims:create',
  UPDATE: 'claims:update',
  DELETE_DRAFT: 'claims:delete-draft',

  ASSIGN: 'claims:assign',
  CHANGE_BRANCH: 'claims:change-branch',
  DUPLICATE_REVIEW: 'claims:duplicate-review',

  NOTIFICATION_SUBMIT: 'claims:notification-submit',

  INTIMATION_CREATE: 'claims:intimation-create',
  INTIMATION_SUBMIT: 'claims:intimation-submit',

  DOCUMENT_UPLOAD: 'claims:document-upload',
  DOCUMENT_VERIFY: 'claims:document-verify',

  RESERVE_CREATE: 'claims:reserve-create',
  RESERVE_APPROVE: 'claims:reserve-approve',
  RESERVE_RELEASE: 'claims:reserve-release',

  ASSESSMENT_CREATE: 'claims:assessment-create',
  ASSESSMENT_UPDATE: 'claims:assessment-update',
  ASSESSMENT_SUBMIT: 'claims:assessment-submit',
  ASSESSMENT_APPROVE: 'claims:assessment-approve',

  APPROVE: 'claims:approve',

  DECISION_CREATE: 'claim-decisions:create',
  DECISION_SUBMIT: 'claim-decisions:submit',
  DECISION_APPROVE: 'claim-decisions:approve',
  DECISION_REJECT: 'claim-decisions:reject',

  DISCHARGE_CREATE: 'claims:discharge-create',
  DISCHARGE_SUBMIT: 'claims:discharge-submit',
  DISCHARGE_APPROVE: 'claims:discharge-approve',

  PAYMENT_CREATE: 'claims:payment-create',
  PAYMENT_APPROVE: 'claims:payment-approve',
  PAYMENT_SUBMIT: 'claims:payment-submit',
  PAYMENT_REQUEST_DISBURSEMENT: 'claim-payments:request-disbursement',
  PAYMENT_CONFIRM_DISBURSEMENT: 'claim-payments:confirm-disbursement',
  PAYMENT_REVERSE: 'claims:payment-reverse',

  REJECTION_CREATE: 'claims:rejection-create',
  REJECTION_APPROVE: 'claims:rejection-approve',
  REJECTION_SUBMIT: 'claims:rejection-submit',
  /** @deprecated use REJECTION_CREATE; kept for existing role grants. */
  REJECT: 'claims:reject',

  REOPEN: 'claims:reopen',
  CLOSE: 'claims:close',

  RECOVERY_CREATE: 'claim-recoveries:create',
  RECOVERY_REQUEST: 'claim-recoveries:request',
  RECOVERY_RECORD_RECEIPT: 'claim-recoveries:record-receipt',
  RECOVERY_WRITE_OFF: 'claim-recoveries:write-off',
  RECOVERY_CANCEL: 'claim-recoveries:cancel',

  /** @deprecated superseded by the per-stage *-submit permissions. */
  TIRAMIS_SUBMIT: 'claims:tiramis-submit',
  TIRAMIS_RETRY: 'claims:tiramis-retry',
  TIRAMIS_VIEW_PAYLOAD: 'claims:tiramis-view-payload',

  OVERRIDE_COVER_VALIDATION: 'claims:override-cover-validation',

  DASHBOARD: 'claims:dashboard',
  REPORT_READ: 'claims:report-read',
  CONFIGURATION_MANAGE: 'claims:configuration-manage',

  COMPLAINT_READ: 'complaints:read',
  COMPLAINT_CREATE: 'complaints:create',
  COMPLAINT_ASSIGN: 'complaints:assign',
  COMPLAINT_RESOLVE: 'complaints:resolve',
  COMPLAINT_ESCALATE: 'complaints:escalate',
  COMPLAINT_CLOSE: 'complaints:close',
  COMPLAINT_REOPEN: 'complaints:reopen',
  COMPLAINT_CANCEL: 'complaints:cancel',
  COMPLAINT_APPEAL_REVIEW: 'complaints:appeal-review',
} as const;

export type ClaimsPermission =
  (typeof ClaimsPermissions)[keyof typeof ClaimsPermissions];
