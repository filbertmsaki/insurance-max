export const PortalAccountType = {
  CUSTOMER: 'CUSTOMER',
  INTERMEDIARY: 'INTERMEDIARY',
} as const;

export type PortalAccountType =
  (typeof PortalAccountType)[keyof typeof PortalAccountType];

export const PortalAccountStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  LOCKED: 'LOCKED',
  CLOSED: 'CLOSED',
} as const;

export type PortalAccountStatus =
  (typeof PortalAccountStatus)[keyof typeof PortalAccountStatus];

export const PortalRequestType = {
  POLICY_ENDORSEMENT: 'POLICY_ENDORSEMENT',
  POLICY_CANCELLATION: 'POLICY_CANCELLATION',
  POLICY_RENEWAL: 'POLICY_RENEWAL',
  CLAIM_NOTIFICATION: 'CLAIM_NOTIFICATION',
  COMPLAINT: 'COMPLAINT',
  QUOTATION_ASSISTANCE: 'QUOTATION_ASSISTANCE',
  PAYMENT_PROOF: 'PAYMENT_PROOF',
  DOCUMENT_REQUEST: 'DOCUMENT_REQUEST',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  GENERAL_SUPPORT: 'GENERAL_SUPPORT',
} as const;

export type PortalRequestType =
  (typeof PortalRequestType)[keyof typeof PortalRequestType];
