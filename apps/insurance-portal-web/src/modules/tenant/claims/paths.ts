import type { ClaimQueue } from './types';

type QueueSegment = ClaimQueue | ':queue';

/** Route paths for the Claims module (docs/claims-module-design.md §3). */
export const claimsPaths = {
  root: '/claims',
  list: '/claims',
  create: '/claims/new',
  configuration: '/claims/configuration',
  queue: (queue: QueueSegment) => `/claims/queue/${queue}`,
  detail: (id: string) => `/claims/${id}`,
  edit: (id: string) => `/claims/${id}/edit`,
} as const;
