import { RoleScope } from '@insurance-max/contracts';
import { COMPANY_ADMIN_ROLES } from '@insurance-max/portal-shared/utils/company-admin-rbac.util';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { Permission } from '../permissions/entities/permission.entity';
import type { Role } from '../roles/entities/role.entity';

const COMPANY_ADMIN_ROLE_NAMES = [
  'COMPANY_ADMIN',
  'COMPANY_ADMINISTRATOR',
  'ADMINISTRATOR',
];

/** The one full-administrator role each company type uses. */
export const ADMIN_ROLE_BY_COMPANY_TYPE: Record<CompanyType, string> = {
  [CompanyType.INSURANCE_COMPANY]: 'INSURANCE_ADMIN',
  [CompanyType.REINSURANCE_COMPANY]: 'REINSURANCE_ADMIN',
  [CompanyType.REINSURANCE_BROKER]: 'ADMINISTRATOR',
  [CompanyType.BROKER]: 'BROKER_ADMIN',
  [CompanyType.AGENCY]: 'AGENCY_ADMIN',
  [CompanyType.BANCASSURANCE]: 'BANCASSURANCE_ADMIN',
  [CompanyType.SERVICE_PROVIDER]: 'SERVICE_PROVIDER_ADMIN',
};

export function adminRoleForCompanyType(companyType: CompanyType): string {
  return ADMIN_ROLE_BY_COMPANY_TYPE[companyType] ?? 'ADMINISTRATOR';
}

/**
 * Roles the portal-invitation flow assigns automatically. They are never
 * offered for manual assignment and survive role edits untouched.
 */
export const SYSTEM_ROLE_NAMES = ['INTERMEDIARY_PORTAL', 'CUSTOMER_PORTAL'];

export function isSystemRole(roleName: string): boolean {
  return SYSTEM_ROLE_NAMES.includes(roleName);
}

/**
 * A company may only hold the administrator role of its own type; e.g. an
 * insurer cannot grant BROKER_ADMIN.
 */
export function isRoleAllowedForCompanyType(
  roleName: string,
  companyType: CompanyType,
): boolean {
  return (
    !(COMPANY_ADMIN_ROLES as readonly string[]).includes(roleName) ||
    roleName === adminRoleForCompanyType(companyType)
  );
}

/** Tenant roles of this company and shared tenant templates may be assigned. */
export function isRoleAssignableToCompany(
  role: Pick<Role, 'scope' | 'company_id'>,
  companyId: string,
): boolean {
  return (
    (role.scope === RoleScope.TENANT && role.company_id === companyId) ||
    (role.scope === RoleScope.TENANT_TEMPLATE && role.company_id === null)
  );
}

export function isPermissionGrantableToMembership(
  permission: Pick<Permission, 'is_deprecated' | 'assignable_to_company_role'>,
): boolean {
  return !permission.is_deprecated && permission.assignable_to_company_role;
}

export function actorAdministersCompany(
  actor: Pick<AuthenticatedUser, 'roles'>,
): boolean {
  return (
    actor.roles?.some(
      (name) =>
        COMPANY_ADMIN_ROLE_NAMES.includes(name) || name.endsWith('_ADMIN'),
    ) ?? false
  );
}

/** Actors may only delegate permissions they hold, unless they administer the company. */
export function actorCanDelegatePermission(
  actor: Pick<AuthenticatedUser, 'roles' | 'permissions'>,
  permissionName: string,
): boolean {
  return (
    actor.permissions?.includes(permissionName) ||
    actorAdministersCompany(actor)
  );
}
