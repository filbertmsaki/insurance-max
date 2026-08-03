export const ReportingPermissions = {
  DEFINITION_READ: 'reports:definition-read',

  SCHEDULE_READ: 'reports:schedule-read',
  SCHEDULE_CREATE: 'reports:schedule-create',
  SCHEDULE_UPDATE: 'reports:schedule-update',
  SCHEDULE_DELETE: 'reports:schedule-delete',

  RUN: 'reports:run',
  JOB_READ: 'reports:job-read',
  DOWNLOAD: 'reports:download',

  MAIL_TEST: 'reports:mail-test',

  DASHBOARD: 'dashboard:reports',
} as const;
