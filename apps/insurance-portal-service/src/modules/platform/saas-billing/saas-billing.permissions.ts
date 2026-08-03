export const SaasBillingPermissions = {
  PLAN_READ: 'platform:saas-plan-read',
  PLAN_CREATE: 'platform:saas-plan-create',
  PLAN_UPDATE: 'platform:saas-plan-update',
  PLAN_ACTIVATE: 'platform:saas-plan-activate',

  SUBSCRIPTION_READ: 'platform:subscription-read',
  SUBSCRIPTION_CREATE: 'platform:subscription-create',
  SUBSCRIPTION_UPDATE: 'platform:subscription-update',
  SUBSCRIPTION_SUSPEND: 'platform:subscription-suspend',
  SUBSCRIPTION_CANCEL: 'platform:subscription-cancel',

  USAGE_READ: 'platform:usage-read',
  USAGE_RECALCULATE: 'platform:usage-recalculate',

  INVOICE_READ: 'platform:saas-invoice-read',
  INVOICE_ISSUE: 'platform:saas-invoice-issue',
  INVOICE_VOID: 'platform:saas-invoice-void',
  PAYMENT_RECORD: 'platform:saas-payment-record',

  DASHBOARD: 'dashboard:platform-billing',
} as const;
