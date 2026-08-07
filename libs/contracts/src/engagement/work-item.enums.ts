export const WorkItemStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type WorkItemStatus =
  (typeof WorkItemStatus)[keyof typeof WorkItemStatus];

export const WorkItemPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
  CRITICAL: 'CRITICAL',
} as const;

export type WorkItemPriority =
  (typeof WorkItemPriority)[keyof typeof WorkItemPriority];

export const WorkItemAssignmentType = {
  USER: 'USER',
  ROLE: 'ROLE',
  TEAM: 'TEAM',
  QUEUE: 'QUEUE',
} as const;

export type WorkItemAssignmentType =
  (typeof WorkItemAssignmentType)[keyof typeof WorkItemAssignmentType];

export const WorkItemEventType = {
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  CLAIMED: 'CLAIMED',
  STARTED: 'STARTED',
  BLOCKED: 'BLOCKED',
  UNBLOCKED: 'UNBLOCKED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  DUE_DATE_CHANGED: 'DUE_DATE_CHANGED',
  ESCALATED: 'ESCALATED',
  DELEGATED: 'DELEGATED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type WorkItemEventType =
  (typeof WorkItemEventType)[keyof typeof WorkItemEventType];
