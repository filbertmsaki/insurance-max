import {
  ArrowLeftRight,
  CarFront,
  FileText,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import {
  MOTOR_INSURANCE_CUTOVER,
  UnderwriteAction,
  UnderwriteLine,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import type { NavLeaf, NavNode } from '@/components/layout/nav-config';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import {
  MOTOR_INSURANCE_POLICIES_GATE,
  MOTOR_INSURANCE_QUOTATIONS_GATE,
  MOTOR_INSURANCE_TRANSACTIONS_GATE,
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
 * Sidebar group for the unified module. Before the MF-7 cutover it is the
 * pilot "Motor Insurance (New)" group beside the old Motor and Fleet groups;
 * after it, it replaces them and also links each line's existing customer,
 * vehicle and fleet registers.
 */
export function buildMotorInsuranceNavNodes(
  cutover: boolean = MOTOR_INSURANCE_CUTOVER,
): NavNode[] {
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
      'Policy Transactions',
      motorInsurancePaths.transactions(),
      ArrowLeftRight,
      MOTOR_INSURANCE_TRANSACTIONS_GATE,
    ),
  ];

  if (cutover) {
    children.push(
      lineLeaf(
        'Motor Customers',
        underwritePaths.customers('motor'),
        Users,
        UnderwriteLine.MOTOR,
        'customers:read',
      ),
      lineLeaf(
        'Fleet Customers',
        underwritePaths.customers('fleet'),
        Users,
        UnderwriteLine.FLEET,
        'customers:read',
      ),
      lineLeaf(
        'Vehicles',
        underwritePaths.motorVehicles,
        CarFront,
        UnderwriteLine.MOTOR,
        'motor:read',
      ),
      lineLeaf(
        'Fleets',
        underwritePaths.fleetRegister,
        Truck,
        UnderwriteLine.FLEET,
        'motor:read',
      ),
    );
  }

  return [
    {
      kind: 'group',
      label: cutover ? 'Motor Insurance' : 'Motor Insurance (New)',
      icon: CarFront,
      children,
    },
  ];
}
