export enum TiramisPermissions {
  VIEW_TRACKING = 'tiramis.tracking.view',
  SUBMIT = 'tiramis.submit',
  VALIDATE = 'tiramis.validate',

  SYNC = 'tiramis.sync',
  RETRY = 'tiramis.retry',

  MONITORING_VIEW = 'tiramis.monitoring.view',
  AUDIT_VIEW = 'tiramis.audit.view',
  NOTIFICATION_VIEW = 'tiramis.notification.view',

  CONFIG_VIEW = 'tiramis.config.view',
  CONFIG_MANAGE = 'tiramis.config.manage',

  ADMIN = 'tiramis.admin',
}

export type TiramisPermission = TiramisPermissions;
