import {
  FilePenLine,
  RefreshCw,
  Ban,
  Hourglass,
  CarFront,
  FileText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  UnderwriteAction,
  UnderwriteLine,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import type { NavLeaf, NavNode } from '@/components/layout/nav-config';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import {
  MOTOR_INSURANCE_POLICIES_GATE,
  MOTOR_INSURANCE_CUSTOMERS_GATE,
  MOTOR_INSURANCE_QUOTATIONS_GATE,
  MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE,
  MOTOR_INSURANCE_RENEWALS_VIEW_GATE,
  MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE,
  MOTOR_INSURANCE_TIRA_GATE,
  type MotorInsuranceGate,
} from './access';
import { motorInsurancePaths } from './paths';

function leaf(
  label: string,
  to: string,
  icon: NavLeaf['icon'],
  gate: MotorInsuranceGate,
): NavLeaf {
  return {
    kind: 'link',
    label,
    to,
    icon,
    // Every permission is required: each becomes its own one-item group.
    anyPermissionGroups: [
      ...gate.allPermissions.map((permission) => [permission]),
      ...gate.anyPermissionGroups,
    ],
    allowedScopes: ['company'],
  };
}

/** A link to an existing single-line page, shown only with that line. */
function lineLeaf(
  label: string,
  to: string,
  icon: NavLeaf['icon'],
  line: UnderwriteLine,
  legacyPermission: string,
): NavLeaf {
  return leaf(label, to, icon, {
    allPermissions: [],
    anyPermissionGroups: [
      underwritePermissionsGranting(line, UnderwriteAction.VIEW),
      [legacyPermission],
    ],
  });
}

/**
 * Sidebar group for the unified Motor Insurance module, including customer,
 * vehicle and fleet registers.
 */
export function buildMotorInsuranceNavNodes(): NavNode[] {
  const children: NavLeaf[] = [
    leaf(
      'Quotations',
      motorInsurancePaths.quotations,
      FileText,
      MOTOR_INSURANCE_QUOTATIONS_GATE,
    ),
    leaf(
      'Policies',
      motorInsurancePaths.policies,
      ShieldCheck,
      MOTOR_INSURANCE_POLICIES_GATE,
    ),
    leaf(
      'Endorsements',
      motorInsurancePaths.transactions('endorsements'),
      FilePenLine,
      MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE,
    ),
    leaf(
      'Renewals',
      motorInsurancePaths.transactions('renewals'),
      RefreshCw,
      MOTOR_INSURANCE_RENEWALS_VIEW_GATE,
    ),
    leaf(
      'Cancellations',
      motorInsurancePaths.transactions('cancellations'),
      Ban,
      MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE,
    ),
    leaf(
      'TIRAMIS Pending',
      motorInsurancePaths.transactions('tira-pending'),
      Hourglass,
      MOTOR_INSURANCE_TIRA_GATE,
    ),
  ];

  children.push(
    leaf(
      'Customers',
      motorInsurancePaths.customers,
      Users,
      MOTOR_INSURANCE_CUSTOMERS_GATE,
    ),
    lineLeaf(
      'Vehicles',
      underwritePaths.motorVehicles,
      CarFront,
      UnderwriteLine.MOTOR,
      'motor:read',
    ),
  );

  return [
    {
      kind: 'group',
      label: 'Motor Insurance',
      icon: CarFront,
      children,
    },
  ];
}
