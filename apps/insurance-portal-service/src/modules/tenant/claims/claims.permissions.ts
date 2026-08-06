export const ClaimsPermissions = {
  READ: 'claims:read',
  CREATE: 'claims:create',
  UPDATE: 'claims:update',

  ASSIGN: 'claims:assign',
  CHANGE_BRANCH: 'claims:change-branch',
  DUPLICATE_REVIEW: 'claims:duplicate-review',

  DOCUMENT_UPLOAD: 'claims:document-upload',
  DOCUMENT_VERIFY: 'claims:document-verify',

  RESERVE_CREATE: 'claims:reserve-create',
  RESERVE_APPROVE: 'claims:reserve-approve',
  RESERVE_RELEASE: 'claims:reserve-release',

  ASSESSMENT_CREATE: 'claims:assessment-create',
  ASSESSMENT_APPROVE: 'claims:assessment-approve',

  DECISION_CREATE: 'claim-decisions:create',
  DECISION_SUBMIT: 'claim-decisions:submit',
  DECISION_APPROVE: 'claim-decisions:approve',
  DECISION_REJECT: 'claim-decisions:reject',

  DISCHARGE_CREATE: 'claims:discharge-create',
  DISCHARGE_APPROVE: 'claims:discharge-approve',

  PAYMENT_CREATE: 'claims:payment-create',
  PAYMENT_APPROVE: 'claims:payment-approve',
  PAYMENT_REQUEST_DISBURSEMENT: 'claim-payments:request-disbursement',
  PAYMENT_CONFIRM_DISBURSEMENT: 'claim-payments:confirm-disbursement',
  PAYMENT_REVERSE: 'claims:payment-reverse',

  REJECT: 'claims:reject',
  REOPEN: 'claims:reopen',
  CLOSE: 'claims:close',

  RECOVERY_CREATE: 'claim-recoveries:create',
  RECOVERY_REQUEST: 'claim-recoveries:request',
  RECOVERY_RECORD_RECEIPT: 'claim-recoveries:record-receipt',
  RECOVERY_WRITE_OFF: 'claim-recoveries:write-off',
  RECOVERY_CANCEL: 'claim-recoveries:cancel',

  TIRAMIS_SUBMIT: 'claims:tiramis-submit',
  TIRAMIS_RETRY: 'claims:tiramis-retry',

  OVERRIDE_COVER_VALIDATION: 'claims:override-cover-validation',

  COMPLAINT_READ: 'complaints:read',
  COMPLAINT_CREATE: 'complaints:create',
  COMPLAINT_ASSIGN: 'complaints:assign',
  COMPLAINT_RESOLVE: 'complaints:resolve',
  COMPLAINT_ESCALATE: 'complaints:escalate',
  COMPLAINT_CLOSE: 'complaints:close',
  COMPLAINT_REOPEN: 'complaints:reopen',
  COMPLAINT_CANCEL: 'complaints:cancel',
  COMPLAINT_APPEAL_REVIEW: 'complaints:appeal-review',

  DASHBOARD: 'dashboard:claims',
} as const;

export type ClaimsPermission =
  (typeof ClaimsPermissions)[keyof typeof ClaimsPermissions];
