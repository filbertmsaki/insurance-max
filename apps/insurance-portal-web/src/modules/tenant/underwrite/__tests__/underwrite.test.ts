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
  it('retains the dashboard and Non-Motor group only', () => {
    expect(nodes[0]).toMatchObject({
      kind: 'link',
      to: underwritePaths.dashboard,
      permission: 'underwrite.dashboard.view',
    });
    expect(groups.map((group) => group.label)).toEqual(['Non-Motor']);
  });
  it('preserves Non-Motor business and operation permissions', () => {
    const children = groups[0].children;
    expect(children.map((child) => child.to)).toContain(
      underwritePaths.quotations('non-motor'),
    );
    for (const child of children) {
      expect(child.anyPermissionGroups?.[0]?.length).toBeGreaterThan(0);
      for (const gate of child.anyPermissionGroups?.[0] ?? [])
        expect(gate).toMatch(/^underwrite\.non_motor\./);
    }
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
