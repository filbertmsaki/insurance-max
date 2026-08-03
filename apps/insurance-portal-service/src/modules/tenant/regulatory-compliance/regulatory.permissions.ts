export const RegulatoryPermissions = {
  PROFILE_READ: 'regulatory:profile-read',
  PROFILE_UPDATE: 'regulatory:profile-update',

  CALENDAR_READ: 'regulatory:calendar-read',
  CALENDAR_MANAGE: 'regulatory:calendar-manage',

  RETURN_READ: 'regulatory:return-read',
  RETURN_PREPARE: 'regulatory:return-prepare',
  RETURN_SUBMIT_FOR_APPROVAL: 'regulatory:return-submit-for-approval',
  RETURN_APPROVE: 'regulatory:return-approve',
  RETURN_MARK_SUBMITTED: 'regulatory:return-mark-submitted',
  RETURN_REOPEN: 'regulatory:return-reopen',

  LEVY_READ: 'regulatory:levy-read',
  LEVY_CALCULATE: 'regulatory:levy-calculate',
  LEVY_ADJUST: 'regulatory:levy-adjust',
  LEVY_CONFIRM: 'regulatory:levy-confirm',
  LEVY_MARK_PAID: 'regulatory:levy-mark-paid',

  ATTACHMENT_UPLOAD: 'regulatory:attachment-upload',

  DASHBOARD: 'dashboard:compliance',
} as const;
