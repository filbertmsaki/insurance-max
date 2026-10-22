import type { ClaimQueue } from './types';

type QueueSegment = ClaimQueue | ':queue';

/** Route paths for the Claims module. */
export const claimsPaths = {
  root: '/apps/claims',
  list: '/apps/claims',
  create: '/apps/claims/new',
  dashboard: '/apps/claims/dashboard',
  documents: '/apps/claims/documents',
  reports: '/apps/claims/reports',
  configuration: '/apps/claims/configuration',
  queue: (queue: QueueSegment) => `/apps/claims/queue/${queue}`,
  detail: (id: string) => `/apps/claims/${id}`,
  edit: (id: string) => `/apps/claims/${id}/edit`,
} as const;
