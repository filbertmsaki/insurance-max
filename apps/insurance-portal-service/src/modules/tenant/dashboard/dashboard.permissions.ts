export const DashboardPermissions = {
  OVERVIEW: 'dashboard:overview',
  SALES: 'dashboard:sales',
  POLICIES: 'dashboard:policies',
  FINANCE: 'dashboard:finance',
  COMMISSIONS: 'dashboard:commissions',
  TIRAMIS: 'dashboard:tiramis',
  TASKS: 'dashboard:tasks',
  EXPORT: 'dashboard:export',
} as const;

export type DashboardPermission =
  (typeof DashboardPermissions)[keyof typeof DashboardPermissions];
