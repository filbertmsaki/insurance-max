import {
  UNDERWRITE_COVER_PERMISSION_NAMES,
  isPolicyUnderwriteAction,
  underwriteActionForScopePermission,
  underwriteCoversAllowed,
  underwriteCoversWithAnyAccess,
} from '@insurance-max/contracts';
import { policyBusinessLineSql } from '../../tenant/policies/utils/policy-business-line.sql';

/**
 * SQL expression for a quotation's cover. Rows written before the cover was
 * stored fall back to their whole line, never to a restricted cover.
 */
export function quotationCoverSql(alias = 'quotation'): string {
  return `COALESCE(
    ${alias}.underwrite_cover,
    CASE ${alias}.quotation_flow
      WHEN 'MOTOR_FLEET' THEN 'FLEET'
      WHEN 'MOTOR_SINGLE' THEN 'MOTOR'
      ELSE 'NON_MOTOR'
    END
  )`;
}

/** SQL expression for a policy's cover: its source quotation's, else its line. */
export function policyCoverSql(alias = 'policy'): string {
  return `COALESCE(
    (
      SELECT cover_quotation.underwrite_cover
      FROM quotations cover_quotation
      WHERE cover_quotation.id = ${alias}.quotation_id
    ),
    ${policyBusinessLineSql(alias)}
  )`;
}

export interface CoverScope {
  quotationCovers: string[] | null;
  policyCovers: string[] | null;
}

export function holdsRestrictedCoverGrant(
  permissions: ReadonlySet<string>,
): boolean {
  return UNDERWRITE_COVER_PERMISSION_NAMES.some((name) =>
    permissions.has(name),
  );
}

/**
 * Covers reachable through `permissionName` (null = not cover-restricted).
 *
 * - The user holds `permissionName` and it is a quotation/policy permission
 *   (`quotations:read`, `quotations:approve`, `policies:read`, ...): strictly
 *   the covers on which they hold the matching action. No grant, no records.
 *   Every guarded route requires that permission, so this is the rule for
 *   all user requests.
 * - Otherwise (claims, reports, dashboards, internal and portal calls that
 *   scope without holding the permission): only users holding a
 *   restricted-cover grant are narrowed, to the covers they hold anything
 *   on. Everyone else keeps their previous, unrestricted behaviour.
 */
export function coversForPermission(
  permissions: ReadonlySet<string>,
  permissionName?: string,
): string[] | null {
  const action = underwriteActionForScopePermission(permissionName);
  if (action && permissions.has(permissionName!)) {
    return underwriteCoversAllowed(permissions, action);
  }
  return holdsRestrictedCoverGrant(permissions)
    ? underwriteCoversWithAnyAccess(permissions)
    : null;
}

/** Quotation and policy covers of a data scope resolved for `permissionName`. */
export function resolveCoverScope(
  permissions: ReadonlySet<string>,
  permissionName?: string,
): CoverScope {
  const action = underwriteActionForScopePermission(permissionName);
  const own = coversForPermission(permissions, permissionName);
  const other = coversForPermission(permissions, undefined);
  if (!action) return { quotationCovers: own, policyCovers: own };
  return isPolicyUnderwriteAction(action)
    ? { quotationCovers: other, policyCovers: own }
    : { quotationCovers: own, policyCovers: other };
}
