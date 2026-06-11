/**
 * Query key factory for the company-features module.
 *
 * Key hierarchy:
 *   ['company-features']              — root
 *   ['company-features', 'list']      — full list (GET /company-features)
 */
export const companyFeaturesKeys = {
  all: ['company-features'] as const,
  lists: () => [...companyFeaturesKeys.all, 'list'] as const,
}
