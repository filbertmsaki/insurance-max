export const ReinsurancePermissions = {
  READ: 'reinsurance:read',

  TREATY_CREATE: 'reinsurance:treaty-create',
  TREATY_UPDATE: 'reinsurance:treaty-update',
  TREATY_SUBMIT: 'reinsurance:treaty-submit',
  TREATY_APPROVE: 'reinsurance:treaty-approve',
  TREATY_ACTIVATE: 'reinsurance:treaty-activate',
  TREATY_SUSPEND: 'reinsurance:treaty-suspend',

  PLACEMENT_CREATE: 'reinsurance:placement-create',
  PLACEMENT_UPDATE: 'reinsurance:placement-update',
  PLACEMENT_MARKET: 'reinsurance:placement-market',
  PLACEMENT_CLOSE: 'reinsurance:placement-close',

  OFFER_READ: 'reinsurance:offer-read',
  OFFER_RESPOND: 'reinsurance:offer-respond',

  CESSION_CREATE: 'reinsurance:cession-create',
  CESSION_CALCULATE: 'reinsurance:cession-calculate',
  CESSION_SUBMIT: 'reinsurance:cession-submit',
  CESSION_APPROVE: 'reinsurance:cession-approve',
  CESSION_APPLY: 'reinsurance:cession-apply',

  DECLARATION_CREATE: 'reinsurance:declaration-create',
  TIRAMIS_SUBMIT: 'reinsurance:tiramis-submit',
  TIRAMIS_RETRY: 'reinsurance:tiramis-retry',

  BORDEREAU_CREATE: 'reinsurance:bordereau-create',
  BORDEREAU_SUBMIT: 'reinsurance:bordereau-submit',
  BORDEREAU_APPROVE: 'reinsurance:bordereau-approve',

  ACCOUNT_CREATE: 'reinsurance:account-create',
  ACCOUNT_SUBMIT: 'reinsurance:account-submit',
  ACCOUNT_APPROVE: 'reinsurance:account-approve',

  RECOVERY_CREATE: 'reinsurance:recovery-create',
  RECOVERY_UPDATE: 'reinsurance:recovery-update',
  RECOVERY_APPROVE: 'reinsurance:recovery-approve',

  SETTLEMENT_CREATE: 'reinsurance:settlement-create',
  SETTLEMENT_APPROVE: 'reinsurance:settlement-approve',
  SETTLEMENT_PAY: 'reinsurance:settlement-pay',
  SETTLEMENT_RECONCILE: 'reinsurance:settlement-reconcile',

  CAPACITY_EVALUATE: 'reinsurance:capacity-evaluate',
  PROGRAM_CREATE: 'reinsurance:program-create',
  PROGRAM_UPDATE: 'reinsurance:program-update',
  COUNTERPARTY_CREATE: 'reinsurance:counterparty-create',
  COUNTERPARTY_UPDATE: 'reinsurance:counterparty-update',

  DASHBOARD: 'dashboard:reinsurance',
} as const;

export type ReinsurancePermission =
  (typeof ReinsurancePermissions)[keyof typeof ReinsurancePermissions];
