/**
 * Query key factory for the users module.
 *
 * Key hierarchy:
 *   ['users']                          — root (invalidate all user queries)
 *   ['users', 'list']                  — the paginated list (GET /users)
 *   ['users', 'list', params]          — a specific list request with params
 *   ['users', 'detail']                — all detail entries
 *   ['users', 'detail', id]            — a single user (GET /users/:id)
 *   ['users', 'me']                    — authenticated user's own profile
 */
export const usersKeys = {
  all: ['users'] as const,

  lists: () => [...usersKeys.all, 'list'] as const,
  list: (params: object) => [...usersKeys.lists(), params] as const,

  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,

  me: () => [...usersKeys.all, 'me'] as const,
};
