import { describe, expect, it } from 'vitest';
import type { NavGroup } from '@/components/layout/nav-config';
import { canAccessRoute } from '@/lib/auth/permissions';
import { buildUnderwriteNavNodes } from '@/modules/tenant/underwrite/nav';
import { MOTOR_INSURANCE_QUOTATIONS_GATE } from '../access';
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

describe('Motor Insurance permanent unified access', () => {
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

  it('replaces the old Motor and Fleet groups and links the line registers', () => {
    const motorGroup = group(buildMotorInsuranceNavNodes());
    expect(motorGroup.label).toBe('Motor Insurance');
    expect(
      motorGroup.children.some((item) => item.label === 'TIRAMIS Exceptions'),
    ).toBe(false);
    expect(motorGroup.children.some((item) => item.label === 'Fleets')).toBe(
      false,
    );
    expect(motorGroup.children.map((item) => item.to)).toEqual([
      '/apps/motor/quotations',
      '/apps/motor/policies',
      '/apps/motor/endorsements',
      '/apps/motor/renewals',
      '/apps/motor/cancellations',
      '/apps/motor/tira-pending',
      '/apps/motor/customers',
      '/apps/underwrite/motor/vehicles',
    ]);

    const underwriteGroups = buildUnderwriteNavNodes()
      .filter((node) => node.kind === 'group')
      .map((node) => (node as NavGroup).label);
    expect(underwriteGroups).toEqual(['Non-Motor']);
  });

  it('shows each register only to users of its line', () => {
    const children = group(buildMotorInsuranceNavNodes()).children;
    const customers = children.find((item) => item.label === 'Customers')!;
    const vehicles = children.find((item) => item.label === 'Vehicles')!;
    const motorUser = companyUser([
      'underwrite.motor.view',
      'customers:read',
      'motor:read',
    ]);

    expect(canAccessRoute(motorUser, vehicles)).toBe(true);
    expect(canAccessRoute(motorUser, customers)).toBe(true);
    expect(
      canAccessRoute(
        companyUser(['underwrite.fleet.view', 'customers:read']),
        customers,
      ),
    ).toBe(true);
    expect(canAccessRoute(companyUser(['customers:read']), customers)).toBe(
      false,
    );
    expect(
      children.filter((item) => /Customers/.test(item.label)),
    ).toHaveLength(1);
  });
  it.each([
    [
      'Endorsements',
      'underwrite.fleet.endorsements.view',
      'endorsements:create',
    ],
    ['Renewals', 'underwrite.motor.renewals.view', 'renewals:read'],
    [
      'Cancellations',
      'underwrite.fleet.cancellations.view',
      'cancellations:read',
    ],
    [
      'TIRAMIS Pending',
      'underwrite.motor.tira.retry',
      'quotations:retry-tiramis',
    ],
  ])(
    'gates %s by its line and operation permissions',
    (label, linePermission, operation) => {
      const item = group(buildMotorInsuranceNavNodes()).children.find(
        (child) => child.label === label,
      )!;
      expect(
        canAccessRoute(companyUser([linePermission, operation]), item),
      ).toBe(true);
      expect(canAccessRoute(companyUser([linePermission]), item)).toBe(false);
      expect(canAccessRoute(companyUser([operation]), item)).toBe(false);
    },
  );
});
