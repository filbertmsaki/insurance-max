export const ClaimsPermissions = {
  READ: 'claims:read',
  CREATE: 'claims:create',
  UPDATE: 'claims:update',

  ASSIGN: 'claims:assign',
  CHANGE_BRANCH: 'claims:change-branch',

  DOCUMENT_UPLOAD: 'claims:document-upload',
  DOCUMENT_VERIFY: 'claims:document-verify',

  RESERVE_CREATE: 'claims:reserve-create',
  RESERVE_APPROVE: 'claims:reserve-approve',
  RESERVE_RELEASE: 'claims:reserve-release',

  ASSESSMENT_CREATE: 'claims:assessment-create',
  ASSESSMENT_APPROVE: 'claims:assessment-approve',

  DISCHARGE_CREATE: 'claims:discharge-create',
  DISCHARGE_APPROVE: 'claims:discharge-approve',

  PAYMENT_CREATE: 'claims:payment-create',
  PAYMENT_APPROVE: 'claims:payment-approve',
  PAYMENT_MARK_PAID: 'claims:payment-mark-paid',
  PAYMENT_REVERSE: 'claims:payment-reverse',

  REJECT: 'claims:reject',
  REOPEN: 'claims:reopen',
  CLOSE: 'claims:close',

  RECOVERY_CREATE: 'claims:recovery-create',
  RECOVERY_UPDATE: 'claims:recovery-update',

  TIRAMIS_SUBMIT: 'claims:tiramis-submit',
  TIRAMIS_RETRY: 'claims:tiramis-retry',

  OVERRIDE_COVER_VALIDATION: 'claims:override-cover-validation',

  COMPLAINT_READ: 'complaints:read',
  COMPLAINT_CREATE: 'complaints:create',
  COMPLAINT_ASSIGN: 'complaints:assign',
  COMPLAINT_RESOLVE: 'complaints:resolve',
  COMPLAINT_ESCALATE: 'complaints:escalate',

  DASHBOARD: 'dashboard:claims',
} as const;

export type ClaimsPermission =
  (typeof ClaimsPermissions)[keyof typeof ClaimsPermissions];
