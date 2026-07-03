/**
 * Query key factory for the branches module.
 *
 * Key hierarchy:
 *   ['branches']                     — root (invalidate all branch queries)
 *   ['branches', 'list']             — the full list (GET /branches)
 *   ['branches', 'detail', id]       — a single branch (GET /branches/:id)
 */
export const branchesKeys = {
  all: ['branches'] as const,

  lists: () => [...branchesKeys.all, 'list'] as const,

  details: () => [...branchesKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchesKeys.details(), id] as const,
};
