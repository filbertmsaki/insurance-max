/**
 * Centralised query-key factory for the Product Engine module.
 *
 * Key hierarchy:
 *   ['pe']                                     — root (invalidate everything)
 *   ['pe', 'categories', 'list', params]       — paginated category list
 *   ['pe', 'categories', 'all']                — all active categories (dropdown)
 *   ['pe', 'categories', 'detail', id]         — single category
 *   (same pattern for products, sub-classes, risks, factors, rules)
 */

export const peKeys = {
  root: ['pe'] as const,

  // Categories
  categories: {
    all: () => ['pe', 'categories'] as const,
    lists: (p?: object) => ['pe', 'categories', 'list', p ?? {}] as const,
    allActive: (businessLine?: string) =>
      ['pe', 'categories', 'all', businessLine ?? ''] as const,
    detail: (id: string) => ['pe', 'categories', 'detail', id] as const,
  },

  // Products
  products: {
    all: () => ['pe', 'products'] as const,
    lists: (p?: object) => ['pe', 'products', 'list', p ?? {}] as const,
    allActive: (params?: object) =>
      ['pe', 'products', 'all', params ?? {}] as const,
    detail: (id: string) => ['pe', 'products', 'detail', id] as const,
  },

  // Sub-Classes
  subClasses: {
    all: () => ['pe', 'sub-classes'] as const,
    lists: (p?: object) => ['pe', 'sub-classes', 'list', p ?? {}] as const,
    byProduct: (productId: string) =>
      ['pe', 'sub-classes', 'by-product', productId] as const,
  },

  // Risks
  risks: {
    all: () => ['pe', 'risks'] as const,
    lists: (p?: object) => ['pe', 'risks', 'list', p ?? {}] as const,
    byFilter: (filters?: { product_id?: string; category_id?: string }) =>
      ['pe', 'risks', 'by-filter', filters ?? {}] as const,
  },

  // Rating Factors
  factors: {
    all: () => ['pe', 'factors'] as const,
    lists: (p?: object) => ['pe', 'factors', 'list', p ?? {}] as const,
    allActive: () => ['pe', 'factors', 'all'] as const,
  },

  // Rating Rules
  rules: {
    all: () => ['pe', 'rules'] as const,
    lists: (p?: object) => ['pe', 'rules', 'list', p ?? {}] as const,
    detail: (id: string) => ['pe', 'rules', 'detail', id] as const,
  },

  // Conditions
  conditions: {
    byRule: (ruleId: string) =>
      ['pe', 'conditions', 'by-rule', ruleId] as const,
  },

  // Required Factors
  requiredFactors: {
    byRisk: (riskId: string) =>
      ['pe', 'required-factors', 'by-risk', riskId] as const,
  },

  // Category Access
  categoryAccess: {
    byBranch: (id: string) => ['pe', 'cat-access', 'branch', id] as const,
    byDepartment: (id: string) => ['pe', 'cat-access', 'dept', id] as const,
    byUser: (id: string) => ['pe', 'cat-access', 'user', id] as const,
  },

  // Product Access
  productAccess: {
    byBranch: (id: string) => ['pe', 'prod-access', 'branch', id] as const,
    byDepartment: (id: string) => ['pe', 'prod-access', 'dept', id] as const,
    byUser: (id: string) => ['pe', 'prod-access', 'user', id] as const,
  },

  // Departments
  departments: {
    all: () => ['pe', 'departments', 'all'] as const,
  },
};
