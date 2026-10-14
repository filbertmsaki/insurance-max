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
  const lineGroups = () =>
    groups.filter((item) =>
      ['Motor', 'Fleet', 'Non-Motor'].includes(item.label),
    );

  it('renders the dashboard as a direct link above the line groups', () => {
    expect(nodes[0]).toMatchObject({
      kind: 'link',
      section: 'Underwrite',
      label: 'Dashboard',
      to: '/underwrite/dashboard',
      permission: 'underwrite.dashboard.view',
    });
    expect(groups.map((item) => item.label)).toEqual([
      'Motor',
      'Fleet',
      'Non-Motor',
    ]);
  });

  it('gates every entry by a line permission', () => {
    for (const item of lineGroups().flatMap((entry) => entry.children)) {
      expect(item.permission).toMatch(/^underwrite\.(motor|fleet|non_motor)\./);
    }
  });

  it('offers each line its own asset register', () => {
    expect(group('Motor').children.map((item) => item.to)).toContain(
      underwritePaths.motorVehicles,
    );
    expect(group('Fleet').children.map((item) => item.to)).toContain(
      underwritePaths.fleetRegister,
    );
  });

  it('does not list New Quotation in the sidebar', () => {
    const links = lineGroups()
      .flatMap((entry) => entry.children)
      .map((item) => item.to);
    for (const slug of ['motor', 'fleet', 'non-motor'] as const) {
      expect(links).not.toContain(underwritePaths.quotationCreate(slug));
    }
  });

  it('keeps Non-Motor quoting available without risk admin links', () => {
    const paths = group('Non-Motor').children.map((item) => item.to);
    expect(paths).toContain(underwritePaths.quotations('non-motor'));
    expect(paths).not.toContain(underwritePaths.nonMotorRisks);
    expect(paths).not.toContain(underwritePaths.riskSchemas);
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
