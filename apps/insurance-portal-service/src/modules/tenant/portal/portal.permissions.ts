export const PortalPermissions = {
  CUSTOMER_ACCESS: 'portal:customer-access',
  INTERMEDIARY_ACCESS: 'portal:intermediary-access',

  ACCOUNT_READ: 'portal:account-read',
  ACCOUNT_INVITE: 'portal:account-invite',
  ACCOUNT_UPDATE: 'portal:account-update',
  ACCOUNT_SUSPEND: 'portal:account-suspend',

  REQUEST_READ: 'portal:request-read',
  REQUEST_ASSIGN: 'portal:request-assign',
  REQUEST_REVIEW: 'portal:request-review',
  REQUEST_COMPLETE: 'portal:request-complete',
} as const;

export type PortalPermission =
  (typeof PortalPermissions)[keyof typeof PortalPermissions];
