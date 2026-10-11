import {
  CarFront,
  Ban,
  FileText,
  FileClock,
  LayoutDashboard,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import {
  UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import type {
  NavGroup,
  NavLeaf,
  NavNode,
} from '@/components/layout/nav-config';
import { UNDERWRITE_LINE_META, type UnderwriteLineMeta } from './lines';
import { underwritePaths } from './paths';

/**
 * Sidebar section: Underwrite → Dashboard (direct link) | Motor | Fleet | Non-Motor.
 *
 * Each leaf requires the line gate (`permission`) AND the existing action
 * permission (`anyPermission` with a single entry), matching the route guard
 * and the backend. Fleet and risk register entries reuse their central screens.
 */
function leaf(
  line: UnderwriteLineMeta,
  label: string,
  to: string,
  icon: NavLeaf['icon'],
  action: Parameters<typeof underwritePermission>[1],
  legacyPermission?: string | string[],
): NavLeaf {
  return {
    kind: 'link',
    label,
    to,
    icon,
    permission: underwritePermission(line.line, action),
    anyPermission: Array.isArray(legacyPermission)
      ? legacyPermission
      : legacyPermission
        ? [legacyPermission]
        : undefined,
    allowedScopes: ['company'],
  };
}

function lineChildren(line: UnderwriteLineMeta): NavLeaf[] {
  const children: NavLeaf[] = [
    leaf(
      line,
      'Dashboard',
      underwritePaths.lineDashboard(line.slug),
      LayoutDashboard,
      UnderwriteAction.VIEW,
    ),
    leaf(
      line,
      'Quotations',
      underwritePaths.quotations(line.slug),
      FileText,
      UnderwriteAction.VIEW,
      'quotations:read',
    ),
  ];

  children.push(
    leaf(
      line,
      'Policies',
      underwritePaths.policies(line.slug),
      ShieldCheck,
      UnderwriteAction.POLICIES_VIEW,
      'policies:read',
    ),
    leaf(
      line,
      'Customers',
      underwritePaths.customers(line.slug),
      Users,
      UnderwriteAction.VIEW,
      'customers:read',
    ),
    leaf(
      line,
      'Renewals',
      underwritePaths.renewals(line.slug),
      FileClock,
      UnderwriteAction.RENEWALS_VIEW,
      'renewals:read',
    ),
    leaf(
      line,
      'Endorsements',
      underwritePaths.endorsements(line.slug),
      FileText,
      UnderwriteAction.ENDORSEMENTS_VIEW,
      'endorsements:create',
    ),
    leaf(
      line,
      'Cancellations',
      underwritePaths.cancellations(line.slug),
      Ban,
      UnderwriteAction.CANCELLATIONS_VIEW,
      'cancellations:read',
    ),
  );

  if (line.line === 'MOTOR') {
    children.push(
      leaf(
        line,
        'Vehicles',
        underwritePaths.motorVehicles,
        CarFront,
        UnderwriteAction.VIEW,
        'motor:read',
      ),
    );
  }

  if (line.line === 'FLEET') {
    children.push(
      leaf(
        line,
        'Fleets / Vehicles',
        underwritePaths.fleetRegister,
        Truck,
        UnderwriteAction.VIEW,
        'motor:read',
      ),
    );
  }

  return children;
}

export function buildUnderwriteNavNodes(): NavNode[] {
  const dashboard: NavLeaf = {
    kind: 'link',
    section: 'Underwrite',
    label: 'Dashboard',
    to: underwritePaths.dashboard,
    icon: LayoutDashboard,
    permission: UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
    allowedScopes: ['company'],
  };

  const lines: NavGroup[] = UNDERWRITE_LINE_META.map((line) => ({
    kind: 'group',
    label: line.label,
    icon: line.icon,
    children: lineChildren(line),
  }));

  return [dashboard, ...lines];
}
