export const DataScopePermissions = {
  /**
   * Access all records belonging to the active company,
   * regardless of branch.
   */
  COMPANY_ALL: 'data-scope:company-all',

  /**
   * Access records belonging to all branches assigned
   * to the current company membership.
   */
  ASSIGNED_BRANCHES: 'data-scope:assigned-branches',

  /**
   * Restrict records to those created or assigned
   * to the authenticated user.
   */
  OWN_RECORDS: 'data-scope:own-records',

  /**
   * Allow an insurer or intermediary to read records where
   * the organization participates as insurer/intermediary.
   */
  PARTNER_PORTFOLIO: 'data-scope:partner-portfolio',
} as const;

export type DataScopePermission =
  (typeof DataScopePermissions)[keyof typeof DataScopePermissions];
