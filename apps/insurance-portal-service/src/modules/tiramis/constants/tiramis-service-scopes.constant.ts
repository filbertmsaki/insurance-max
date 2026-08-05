export const TiramisServiceScopes = {
  READ: 'tiramis:read',
  PREPARE: 'tiramis:prepare',
  VERIFY: 'tiramis:verify',
  SUBMIT: 'tiramis:submit',
  RETRY: 'tiramis:retry',
  ADMIN: 'tiramis:admin',
} as const;

export type TiramisServiceScope =
  (typeof TiramisServiceScopes)[keyof typeof TiramisServiceScopes];
