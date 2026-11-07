import { describe, expect, it } from 'vitest';
import {
  MOTOR_INSURANCE_CUTOVER,
  MOTOR_INSURANCE_PREVIEW_PERMISSION,
} from '@insurance-max/contracts';
import type { NavGroup } from '@/components/layout/nav-config';
import { canAccessRoute } from '@/lib/auth/permissions';
import { buildUnderwriteNavNodes } from '@/modules/tenant/underwrite/nav';
import { MOTOR_INSURANCE_QUOTATIONS_GATE, pilotPermissions } from '../access';
import { buildMotorInsuranceNavNodes } from '../nav';

function companyUser(permissions: string[]) {
  return {
    id: 'u-1',
    email: 'u@example.com',
    scope: 'company',
    userType: 'COMPANY_USER',
    roles: ['UNDERWRITER'],
    permissions,
  } as unknown as Parameters<typeof canAccessRoute>[0];
}

const group = (nodes: ReturnType<typeof buildMotorInsuranceNavNodes>) =>
  nodes[0] as NavGroup;

describe('Motor Insurance access after the MF-7 cutover', () => {
  it('is cut over', () => {
    expect(MOTOR_INSURANCE_CUTOVER).toBe(true);
  });

  it('needs the legacy permission and a Motor or Fleet line gate, no pilot permission', () => {
    const quotations = group(buildMotorInsuranceNavNodes()).children[0];
    const visible = (permissions: string[]) =>
      canAccessRoute(companyUser(permissions), quotations);

    expect(visible(['quotations:read'])).toBe(false);
    expect(visible(['underwrite.fleet.view'])).toBe(false);
    expect(visible(['underwrite.non_motor.view', 'quotations:read'])).toBe(
      false,
    );
    expect(visible(['quotations:read', 'underwrite.fleet.view'])).toBe(true);
  });

  it('route gate mirrors the nav gate', () => {
    expect(MOTOR_INSURANCE_QUOTATIONS_GATE.allPermissions).toEqual([]);
    expect(MOTOR_INSURANCE_QUOTATIONS_GATE.anyPermissionGroups).toEqual([
      expect.arrayContaining([
        'underwrite.motor.view',
        'underwrite.fleet.view',
      ]),
      ['quotations:read'],
    ]);
    expect(
      MOTOR_INSURANCE_QUOTATIONS_GATE.anyPermissionGroups[0],
    ).not.toContain('underwrite.non_motor.view');
  });

  it('requires the pilot permission when rolled back', () => {
    expect(pilotPermissions(false)).toEqual([
      MOTOR_INSURANCE_PREVIEW_PERMISSION,
    ]);
    expect(pilotPermissions(true)).toEqual([]);
  });

  it('replaces the old Motor and Fleet groups and links the line registers', () => {
    const motorGroup = group(buildMotorInsuranceNavNodes(true));
    expect(motorGroup.label).toBe('Motor Insurance');
    expect(motorGroup.children.map((item) => item.to)).toEqual([
      '/apps/motor/quotations',
      '/apps/motor/policies',
      '/apps/motor/transactions',
      '/apps/underwrite/motor/customers',
      '/apps/underwrite/fleet/customers',
      '/apps/underwrite/motor/vehicles',
      '/apps/underwrite/fleet/fleets',
    ]);

    const underwriteGroups = buildUnderwriteNavNodes(true)
      .filter((node) => node.kind === 'group')
      .map((node) => (node as NavGroup).label);
    expect(underwriteGroups).toEqual(['Non-Motor']);
  });

  it('shows each register only to users of its line', () => {
    const [, , , , fleetCustomers, vehicles] = group(
      buildMotorInsuranceNavNodes(true),
    ).children;
    const motorUser = companyUser([
      'underwrite.motor.view',
      'customers:read',
      'motor:read',
    ]);

    expect(canAccessRoute(motorUser, vehicles)).toBe(true);
    expect(canAccessRoute(motorUser, fleetCustomers)).toBe(false);
  });

  it('restores the pilot menu on rollback', () => {
    const pilot = group(buildMotorInsuranceNavNodes(false));
    expect(pilot.label).toBe('Motor Insurance (New)');
    expect(pilot.children).toHaveLength(3);
    expect(
      buildUnderwriteNavNodes(false)
        .filter((node) => node.kind === 'group')
        .map((node) => (node as NavGroup).label),
    ).toEqual(['Motor', 'Fleet', 'Non-Motor']);
  });
});
