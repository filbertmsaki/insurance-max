import { UNDERWRITE_MIGRATION_PERMISSIONS } from '../../../../apps/insurance-portal-service/src/database/migrations/1790800000000-UnderwriteLinesAndPermissions';
import {
  UNDERWRITE_LINES,
  UnderwriteLine,
  quotationFlowForUnderwriteLine,
  underwriteLineFromQuotationFlow,
  underwriteLineFromSlug,
} from './underwrite-line';
import {
  UNDERWRITE_PERMISSION_DEFINITIONS,
  UNDERWRITE_PERMISSION_NAMES,
  UnderwriteAction,
  underwritePermission,
  withUnderwritePermissionAliases,
} from './underwrite-permissions';

describe('underwrite lines', () => {
  it('maps each line to exactly one quotation flow and slug', () => {
    for (const definition of UNDERWRITE_LINES) {
      expect(underwriteLineFromSlug(definition.slug)).toBe(definition.line);
      expect(underwriteLineFromQuotationFlow(definition.quotationFlow)).toBe(
        definition.line,
      );
      expect(quotationFlowForUnderwriteLine(definition.line)).toBe(
        definition.quotationFlow,
      );
    }
  });

  it('rejects unknown slugs and flows', () => {
    expect(underwriteLineFromSlug('marine')).toBeNull();
    expect(underwriteLineFromQuotationFlow(undefined)).toBeNull();
  });
});

describe('underwrite permissions', () => {
  it('uses the requested naming scheme', () => {
    expect(
      underwritePermission(UnderwriteLine.MOTOR, UnderwriteAction.VIEW),
    ).toBe('underwrite.motor.view');
    expect(
      underwritePermission(UnderwriteLine.NON_MOTOR, UnderwriteAction.APPROVE),
    ).toBe('underwrite.non_motor.approve');
    expect(
      underwritePermission(UnderwriteLine.FLEET, UnderwriteAction.TIRA_RETRY),
    ).toBe('underwrite.fleet.tira.retry');
  });

  it('defines unique permission names', () => {
    expect(new Set(UNDERWRITE_PERMISSION_NAMES).size).toBe(
      UNDERWRITE_PERMISSION_NAMES.length,
    );
  });

  it('keeps the migration snapshot in sync with the contract', () => {
    const snapshot = UNDERWRITE_MIGRATION_PERMISSIONS.map((permission) => ({
      name: permission.name,
      legacy: [...permission.legacy].sort(),
    }));
    const contract = UNDERWRITE_PERMISSION_DEFINITIONS.map((definition) => ({
      name: definition.name,
      legacy: [...definition.legacyPermissions].sort(),
    }));

    expect(snapshot).toEqual(contract);
  });

  it('grants line gates to holders of the equivalent legacy permission', () => {
    const expanded = withUnderwritePermissionAliases([
      'quotations:read',
      'policies:read',
    ]);

    expect(expanded).toEqual(
      expect.arrayContaining([
        'underwrite.dashboard.view',
        'underwrite.motor.view',
        'underwrite.fleet.view',
        'underwrite.non_motor.view',
        'underwrite.motor.policies.view',
      ]),
    );
    expect(expanded).not.toContain('underwrite.motor.create');
    expect(expanded).not.toContain('underwrite.motor.approve');
  });
});
