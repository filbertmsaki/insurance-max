import {
  CarFront,
  Ban,
  FilePlus2,
  FileText,
  FileClock,
  Layers,
  LayoutDashboard,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
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
 * Sidebar section: Underwrite → Dashboard | Motor | Fleet | Non-Motor.
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

  if (line.hasWizard) {
    children.push(
      leaf(
        line,
        line.line === 'FLEET' ? 'New Fleet Quotation' : 'New Quotation',
        underwritePaths.quotationCreate(line.slug),
        FilePlus2,
        UnderwriteAction.CREATE,
        'quotations:create',
      ),
    );
  }

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
    leaf(
      line,
      'TIRA Failed',
      underwritePaths.tiraFailed(line.slug),
      RefreshCcw,
      UnderwriteAction.TIRA_RETRY,
      [
        'quotations:retry-tiramis',
        'endorsements:retry-tiramis',
        'cancellations:submit-tiramis',
      ],
    ),
    leaf(
      line,
      'TIRA Pending',
      underwritePaths.tiraPending(line.slug),
      RefreshCcw,
      UnderwriteAction.TIRA_RETRY,
      [
        'quotations:retry-tiramis',
        'endorsements:retry-tiramis',
        'cancellations:submit-tiramis',
      ],
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

  if (line.line === 'NON_MOTOR') {
    children.push(
      leaf(
        line,
        'Risks',
        underwritePaths.nonMotorRisks,
        Layers,
        UnderwriteAction.VIEW,
        'non-motor:read',
      ),
      leaf(
        line,
        'Risk Schemas',
        underwritePaths.riskSchemas,
        SlidersHorizontal,
        UnderwriteAction.EDIT,
        'insurance-products:update',
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
  const dashboardGroup: NavGroup = {
    kind: 'group',
    section: 'Underwrite',
    label: 'Underwrite',
    icon: LayoutDashboard,
    children: [
      {
        kind: 'link',
        label: 'Dashboard',
        to: underwritePaths.dashboard,
        icon: LayoutDashboard,
        permission: UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
        allowedScopes: ['company'],
      },
    ],
  };

  const lines: NavGroup[] = UNDERWRITE_LINE_META.map((line) => ({
    kind: 'group',
    label: line.label,
    icon: line.icon,
    children: lineChildren(line),
  }));

  return [dashboardGroup, ...lines];
}
