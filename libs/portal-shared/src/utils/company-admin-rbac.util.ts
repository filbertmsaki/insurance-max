import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type CompanyAdminAwareUser = Pick<AuthenticatedUser, 'roles'>;

// The full-authority "administrator for this company tenant" roles seeded in
// 001-initial-rbac.seed.ts — one per company type. Deliberately excludes
// narrower admin roles scoped to a single subsystem (e.g. PORTAL_ADMIN,
// PRODUCT_ADMINISTRATOR), which are not general company administration.
export const COMPANY_ADMIN_ROLES = [
  'ADMINISTRATOR',
  'INSURANCE_ADMIN',
  'REINSURANCE_ADMIN',
  'BROKER_ADMIN',
  'AGENCY_ADMIN',
  'BANCASSURANCE_ADMIN',
  'SERVICE_PROVIDER_ADMIN',
] as const;

/**
 * Whether the actor holds a full company-administrator role for their
 * tenant. Used to exempt company admins from maker-checker self-approval
 * restrictions (claims decisions, KYC review, commission payments, policy
 * endorsements/cancellations) — an admin may approve work they created
 * themselves.
 */
export function hasCompanyAdminRole(
  actor?: CompanyAdminAwareUser | null,
): boolean {
  return (
    actor?.roles?.some((role) =>
      (COMPANY_ADMIN_ROLES as readonly string[]).includes(role),
    ) === true
  );
}
