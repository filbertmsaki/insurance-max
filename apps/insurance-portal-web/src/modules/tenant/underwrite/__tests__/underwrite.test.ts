import { describe, expect, it } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import type { NavGroup } from '@/components/layout/nav-config';
import { buildQuotationDraftPayload } from '@/modules/tenant/quotations/schemas';
import {
  getUnderwriteLineMeta,
  getUnderwriteLineMetaBySlug,
  underwriteRoutePermissions,
} from '../lines';
import { buildUnderwriteNavNodes } from '../nav';
import { underwritePaths } from '../paths';
import { defaultValuesForLine } from '../wizard/defaults';

describe('underwrite lines', () => {
  it('resolves route slugs and rejects unknown ones', () => {
    expect(getUnderwriteLineMetaBySlug('non-motor')?.line).toBe('NON_MOTOR');
    expect(getUnderwriteLineMetaBySlug('marine')).toBeNull();
    expect(getUnderwriteLineMetaBySlug(undefined)).toBeNull();
  });

  it('requires the line gate and the legacy permission together', () => {
    expect(
      underwriteRoutePermissions(
        UnderwriteLine.MOTOR,
        'view',
        'quotations:read',
      ),
    ).toEqual(['underwrite.motor.view', 'quotations:read']);
  });
});

describe('underwrite navigation', () => {
  const nodes = buildUnderwriteNavNodes();
  const groups = nodes.filter(
    (node): node is NavGroup => node.kind === 'group',
  );
  const group = (label: string) => groups.find((item) => item.label === label)!;

  it('renders Dashboard then Motor, Fleet and Non-Motor under one section', () => {
    expect(nodes[0]).toMatchObject({
      kind: 'link',
      section: 'Underwrite',
      to: '/underwrite/dashboard',
    });
    expect(groups.map((item) => item.label)).toEqual([
      'Motor',
      'Fleet',
      'Non-Motor',
    ]);
  });

  it('gates every entry by a line permission', () => {
    for (const item of groups.flatMap((entry) => entry.children)) {
      expect(item.permission).toMatch(/^underwrite\.(motor|fleet|non_motor)\./);
    }
  });

  it('offers each line its own wizard and asset register', () => {
    const motor = group('Motor').children.map((item) => item.to);
    expect(motor).toContain(underwritePaths.quotationCreate('motor'));
    expect(motor).toContain(underwritePaths.motorVehicles);

    const fleet = group('Fleet').children;
    expect(fleet.map((item) => item.to)).toContain(
      underwritePaths.fleetRegister,
    );
    expect(
      fleet.find(
        (item) => item.to === underwritePaths.quotationCreate('fleet'),
      ),
    ).toMatchObject({
      label: 'New Fleet Quotation',
      permission: 'underwrite.fleet.create',
    });
  });

  it('offers Non-Motor its wizard, risks and risk schema admin', () => {
    const nonMotor = group('Non-Motor').children;
    expect(nonMotor.map((item) => item.to)).toEqual(
      expect.arrayContaining([
        underwritePaths.quotationCreate('non-motor'),
        underwritePaths.nonMotorRisks,
        underwritePaths.riskSchemas,
      ]),
    );
    // Schema admin needs product-configuration rights, not just quoting.
    expect(
      nonMotor.find((item) => item.to === underwritePaths.riskSchemas),
    ).toMatchObject({
      permission: 'underwrite.non_motor.edit',
      anyPermission: ['insurance-products:update'],
    });
  });

  it('requires quotations:create for New Quotation', () => {
    const create = group('Motor').children.find(
      (item) => item.to === underwritePaths.quotationCreate('motor'),
    );
    expect(create).toMatchObject({
      permission: 'underwrite.motor.create',
      anyPermission: ['quotations:create'],
    });
  });
});

describe('wizard defaults', () => {
  it.each([
    [UnderwriteLine.MOTOR, 'MOTOR_SINGLE', 'MOTOR', false],
    [UnderwriteLine.FLEET, 'MOTOR_FLEET', 'MOTOR', true],
    [UnderwriteLine.NON_MOTOR, 'NON_MOTOR', 'NON_MOTOR', false],
  ] as const)(
    'pins %s to its quotation flow in the draft payload',
    (line, flow, type, isFleet) => {
      const values = defaultValuesForLine(getUnderwriteLineMeta(line));
      const payload = buildQuotationDraftPayload(values, 'customer');

      expect(payload).toMatchObject({
        quotation_flow: flow,
        quotation_type: type,
        is_fleet: isFleet,
        current_wizard_step: 'customer',
      });
    },
  );
});
