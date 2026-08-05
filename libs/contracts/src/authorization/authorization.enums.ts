export const RoleScope = {
  PLATFORM: 'platform',
  TENANT_TEMPLATE: 'tenant_template',
  TENANT: 'tenant',
} as const;

export type RoleScope = (typeof RoleScope)[keyof typeof RoleScope];

export const PermissionAssignmentScope = {
  PLATFORM: 'platform',
  TENANT: 'tenant',
  SHARED: 'shared',
} as const;

export type PermissionAssignmentScope =
  (typeof PermissionAssignmentScope)[keyof typeof PermissionAssignmentScope];

export type ApplicationAccessScope = 'platform' | 'company';

export type PermissionEvaluationMode = 'all' | 'any';

export type RoleEvaluationMode = 'all' | 'any';
