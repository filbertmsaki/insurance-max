import {
  AlertTriangle,
  Hourglass,
  Ban,
  FileText,
  FileClock,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  isMotorInsuranceLine,
  UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
  UnderwriteAction,
  underwritePermission,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import type {
  NavGroup,
  NavLeaf,
  NavNode,
} from '@/components/layout/nav-config';
import {
  CANCELLATION_VIEW_PERMISSIONS,
  ENDORSEMENT_VIEW_PERMISSIONS,
  UNDERWRITE_LINE_META,
  type UnderwriteLineMeta,
} from './lines';
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
    anyPermissionGroups: [underwritePermissionsGranting(line.line, action)],
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
      ENDORSEMENT_VIEW_PERMISSIONS,
    ),
    leaf(
      line,
      'Cancellations',
      underwritePaths.cancellations(line.slug),
      Ban,
      UnderwriteAction.CANCELLATIONS_VIEW,
      CANCELLATION_VIEW_PERMISSIONS,
    ),
  );

  for (const queue of [
    {
      label: 'TIRA pending',
      to: underwritePaths.tiraPending(line.slug),
      icon: Hourglass,
    },
    {
      label: 'TIRA exceptions',
      to: underwritePaths.tiraFailed(line.slug),
      icon: AlertTriangle,
    },
  ]) {
    children.push(
      leaf(
        line,
        queue.label,
        queue.to,
        queue.icon,
        UnderwriteAction.TIRA_RETRY,
        [
          'quotations:retry-tiramis',
          'endorsements:retry-tiramis',
          'cancellations:submit-tiramis',
        ],
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

  // Motor and Fleet business pages are owned by the unified Motor Insurance module.
  const lines: NavGroup[] = UNDERWRITE_LINE_META.filter(
    (line) => !isMotorInsuranceLine(line.line),
  ).map((line) => ({
    kind: 'group',
    label: line.label,
    icon: line.icon,
    children: lineChildren(line),
  }));

  return [dashboard, ...lines];
}
