export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
} as const;

export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type NotificationPriority =
  (typeof NotificationPriority)[keyof typeof NotificationPriority];

export const NotificationStatus = {
  CREATED: 'CREATED',
  QUEUED: 'QUEUED',
  PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationDeliveryStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  PROVIDER_ACCEPTED: 'PROVIDER_ACCEPTED',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  RETRY_SCHEDULED: 'RETRY_SCHEDULED',
  DEAD_LETTER: 'DEAD_LETTER',
  CANCELLED: 'CANCELLED',
} as const;

export type NotificationDeliveryStatus =
  (typeof NotificationDeliveryStatus)[keyof typeof NotificationDeliveryStatus];

export const NotificationPreferenceMode = {
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED',
  REQUIRED: 'REQUIRED',
  INHERIT: 'INHERIT',
} as const;

export type NotificationPreferenceMode =
  (typeof NotificationPreferenceMode)[keyof typeof NotificationPreferenceMode];
