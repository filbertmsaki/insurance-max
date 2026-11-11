import {
  MOTOR_INSURANCE_LINES,
  UnderwriteAction,
  type UnderwriteActionValue,
  UnderwriteCover,
  type UnderwriteLine,
  underwriteCoverPermissionsGranting,
  underwriteLineEntryPermissions,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import {
  CANCELLATION_VIEW_PERMISSIONS,
  ENDORSEMENT_VIEW_PERMISSIONS,
} from '@/modules/tenant/underwrite/lines';

/**
 * Actions whose API routes filter records by cover, so a restricted cover
 * grant (Short-Term) may open them. Everything else stays line-only, exactly
 * like the backend.
 */
const COVER_ENTRY_ACTIONS: readonly UnderwriteActionValue[] = [
  UnderwriteAction.VIEW,
  UnderwriteAction.POLICIES_VIEW,
  UnderwriteAction.CREATE,
  UnderwriteAction.EDIT,
  UnderwriteAction.DELETE,
];

function lineGates(line: UnderwriteLine, action: UnderwriteActionValue) {
  return COVER_ENTRY_ACTIONS.includes(action)
    ? underwriteLineEntryPermissions(line, action)
    : underwritePermissionsGranting(line, action);
}

/** Gates of Motor OR Fleet (or a Short-Term cover inside them) for `action`. */
export function motorInsuranceLineGates(action: UnderwriteActionValue) {
  return MOTOR_INSURANCE_LINES.flatMap((line) => lineGates(line, action));
}

export type MotorCreateKind =
  | 'single'
  | 'fleet'
  | 'short-term-single'
  | 'short-term-fleet';

/** Whether the user may create quotations of a kind (UI only; the API enforces). */
export function canCreateMotorKind(
  hasPermission: (permission: string) => boolean,
  kind: MotorCreateKind | 'short-term',
): boolean {
  if (!hasPermission('quotations:create')) return false;
  const cover = (value: UnderwriteCover) =>
    underwriteCoverPermissionsGranting(value, UnderwriteAction.CREATE).some(
      hasPermission,
    );
  switch (kind) {
    case 'single':
      return underwritePermissionsGranting(
        'MOTOR',
        UnderwriteAction.CREATE,
      ).some(hasPermission);
    case 'fleet':
      return underwritePermissionsGranting(
        'FLEET',
        UnderwriteAction.CREATE,
      ).some(hasPermission);
    case 'short-term-single':
      return cover(UnderwriteCover.SHORT_TERM_SINGLE);
    case 'short-term-fleet':
      return cover(UnderwriteCover.SHORT_TERM_FLEET);
    case 'short-term':
      return (
        cover(UnderwriteCover.SHORT_TERM_SINGLE) ||
        cover(UnderwriteCover.SHORT_TERM_FLEET)
      );
  }
}

export interface MotorInsuranceGate {
  allPermissions: string[];
  anyPermissionGroups: string[][];
}

/**
 * Route/nav gate: the line gate of at least one of
 * Motor or Fleet, and the legacy action permission (any one of them when a
 * list is given). The backend enforces the same.
 */
export function motorInsuranceGate(
  action: UnderwriteActionValue,
  legacyPermissions: string | string[],
): MotorInsuranceGate {
  const legacy = Array.isArray(legacyPermissions)
    ? legacyPermissions
    : [legacyPermissions];
  return {
    allPermissions: [],
    anyPermissionGroups: [motorInsuranceLineGates(action), legacy],
  };
}

/** Whether `permissions` satisfy the line gate for one resolved line. */
export function hasLineGate(
  hasPermission: (permission: string) => boolean,
  line: UnderwriteLine,
  action: UnderwriteActionValue,
): boolean {
  return lineGates(line, action).some(hasPermission);
}

export const MOTOR_INSURANCE_QUOTATIONS_GATE = motorInsuranceGate(
  UnderwriteAction.VIEW,
  'quotations:read',
);
export const MOTOR_INSURANCE_POLICIES_GATE = motorInsuranceGate(
  UnderwriteAction.POLICIES_VIEW,
  'policies:read',
);
export const MOTOR_INSURANCE_CREATE_GATE = motorInsuranceGate(
  UnderwriteAction.CREATE,
  'quotations:create',
);
export const MOTOR_INSURANCE_EDIT_GATE = motorInsuranceGate(
  UnderwriteAction.EDIT,
  'quotations:update',
);
export const MOTOR_INSURANCE_ENDORSE_GATE = motorInsuranceGate(
  UnderwriteAction.ENDORSEMENTS_MANAGE,
  'endorsements:create',
);
export const MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE = motorInsuranceGate(
  UnderwriteAction.ENDORSEMENTS_VIEW,
  ENDORSEMENT_VIEW_PERMISSIONS,
);
export const MOTOR_INSURANCE_CANCEL_GATE = motorInsuranceGate(
  UnderwriteAction.CANCELLATIONS_MANAGE,
  'cancellations:create',
);
export const MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE = motorInsuranceGate(
  UnderwriteAction.CANCELLATIONS_VIEW,
  CANCELLATION_VIEW_PERMISSIONS,
);
export const MOTOR_INSURANCE_RENEWALS_VIEW_GATE = motorInsuranceGate(
  UnderwriteAction.RENEWALS_VIEW,
  'renewals:read',
);
export const MOTOR_INSURANCE_TIRA_GATE = motorInsuranceGate(
  UnderwriteAction.TIRA_RETRY,
  [
    'quotations:retry-tiramis',
    'endorsements:retry-tiramis',
    'cancellations:submit-tiramis',
  ],
);

/** Any transaction tab visible: used for the "Policy Transactions" nav item. */
export const MOTOR_INSURANCE_TRANSACTIONS_GATE: MotorInsuranceGate = {
  allPermissions: [],
  anyPermissionGroups: [
    [
      ...motorInsuranceLineGates(UnderwriteAction.ENDORSEMENTS_VIEW),
      ...motorInsuranceLineGates(UnderwriteAction.CANCELLATIONS_VIEW),
      ...motorInsuranceLineGates(UnderwriteAction.RENEWALS_VIEW),
      ...motorInsuranceLineGates(UnderwriteAction.TIRA_RETRY),
    ],
  ],
};

// The line customer register is not cover-filtered: line holders only.
export const MOTOR_INSURANCE_CUSTOMERS_GATE: MotorInsuranceGate = {
  allPermissions: [],
  anyPermissionGroups: [
    MOTOR_INSURANCE_LINES.flatMap((line) =>
      underwritePermissionsGranting(line, UnderwriteAction.VIEW),
    ),
    ['customers:read'],
  ],
};
