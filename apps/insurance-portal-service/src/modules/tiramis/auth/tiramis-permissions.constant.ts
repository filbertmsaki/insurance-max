export const TiramisPermissions = {
  SUBMIT: 'tiramis.submit',
  VIEW_TRACKING: 'tiramis.tracking.view',
  MONITORING_VIEW: 'tiramis.monitoring.view',
  RETRY: 'tiramis.retry',
  SYNC: 'tiramis.sync',
  ADMIN: 'tiramis.admin',
} as const;

export type TiramisPermission =
  (typeof TiramisPermissions)[keyof typeof TiramisPermissions];
