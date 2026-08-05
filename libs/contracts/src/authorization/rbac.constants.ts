export const RbacPermissions = {
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',

  PERMISSIONS_READ: 'permissions:read',
  PERMISSIONS_CREATE: 'permissions:create',
  PERMISSIONS_UPDATE: 'permissions:update',
  PERMISSIONS_DELETE: 'permissions:delete',

  USERS_ASSIGN_ROLE: 'users:assign-role',
  USERS_REVOKE_ROLE: 'users:revoke-role',
  USERS_GRANT_PERMISSION: 'users:grant-permission',
  USERS_REVOKE_PERMISSION: 'users:revoke-permission',

  AUDIT_READ: 'audit:read',
  AUDIT_READ_ALL: 'audit:read-all',
  AUDIT_EXPORT: 'audit:export',
} as const;

export const DataScopePermissions = {
  COMPANY_ALL: 'data-scope:company-all',
  ASSIGNED_BRANCHES: 'data-scope:assigned-branches',
  OWN_RECORDS: 'data-scope:own-records',
  PARTNER_PORTFOLIO: 'data-scope:partner-portfolio',
} as const;

export type DataScopePermission =
  (typeof DataScopePermissions)[keyof typeof DataScopePermissions];
