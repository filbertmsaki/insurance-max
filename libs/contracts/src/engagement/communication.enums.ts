export const CommunicationDirection = {
  OUTBOUND: 'OUTBOUND',
  INBOUND: 'INBOUND',
  INTERNAL: 'INTERNAL',
} as const;

export type CommunicationDirection =
  (typeof CommunicationDirection)[keyof typeof CommunicationDirection];

export const CommunicationThreadType = {
  GENERAL: 'GENERAL',
  POLICY: 'POLICY',
  CLAIM: 'CLAIM',
  COMPLAINT: 'COMPLAINT',
  PAYMENT: 'PAYMENT',
  RENEWAL: 'RENEWAL',
  REGULATORY: 'REGULATORY',
  SUPPORT: 'SUPPORT',
} as const;

export type CommunicationThreadType =
  (typeof CommunicationThreadType)[keyof typeof CommunicationThreadType];

export const CommunicationMessageStatus = {
  DRAFT: 'DRAFT',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  RECEIVED: 'RECEIVED',
  REJECTED: 'REJECTED',
} as const;

export type CommunicationMessageStatus =
  (typeof CommunicationMessageStatus)[keyof typeof CommunicationMessageStatus];

export const ConsentPurpose = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  SERVICE: 'SERVICE',
  SECURITY: 'SECURITY',
  MARKETING: 'MARKETING',
} as const;

export type ConsentPurpose =
  (typeof ConsentPurpose)[keyof typeof ConsentPurpose];
