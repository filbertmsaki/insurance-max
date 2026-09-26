/**
 * Query key factory for the companies module.
 *
 * Key hierarchy:
 *   ['companies']                          — root (invalidate all company queries)
 *   ['companies', 'list']                  — the full list (GET /companies)
 *   ['companies', 'detail', id]            — a single company (GET /companies/:id)
 *   ['companies', 'my']                    — the authenticated user's company (GET /companies/my)
 *   ['companies', 'number-format']         — active company number format settings
 */
export const companiesKeys = {
  all: ['companies'] as const,

  lists: () => [...companiesKeys.all, 'list'] as const,

  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,

  myCompany: () => [...companiesKeys.all, 'my'] as const,
  numberFormat: () => [...companiesKeys.all, 'number-format'] as const,
};
