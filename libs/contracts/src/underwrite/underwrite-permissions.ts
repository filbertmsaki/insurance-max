import {
  UNDERWRITE_LINES,
  UnderwriteLine,
  getUnderwriteLineDefinition,
} from './underwrite-line';

/**
 * Line-level permission gates for the Underwrite module.
 *
 * These are enforced IN ADDITION to the existing action permissions
 * (`quotations:*`, `policies:*`, `endorsements:*`, ...). A line gate decides
 * which business line a user may work in; the existing action permission still
 * decides what they may do there, so approval rules and maker-checker remain
 * owned by the existing workflow services.
 */
export const UnderwriteAction = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  POLICIES_VIEW: 'policies.view',
  POLICIES_EDIT: 'policies.edit',
  RENEWALS_VIEW: 'renewals.view',
  RENEWALS_MANAGE: 'renewals.manage',
  ENDORSEMENTS_VIEW: 'endorsements.view',
  ENDORSEMENTS_MANAGE: 'endorsements.manage',
  CANCELLATIONS_VIEW: 'cancellations.view',
  CANCELLATIONS_MANAGE: 'cancellations.manage',
  TIRA_RETRY: 'tira.retry',
} as const;

export type UnderwriteActionValue =
  (typeof UnderwriteAction)[keyof typeof UnderwriteAction];

export const UNDERWRITE_DASHBOARD_VIEW_PERMISSION = 'underwrite.dashboard.view';

export function underwritePermission(
  line: UnderwriteLine,
  action: UnderwriteActionValue,
): string {
  return `underwrite.${getUnderwriteLineDefinition(line).permissionKey}.${action}`;
}

/**
 * Line actions that also satisfy another action's gate. Approvers must be
 * able to open the endorsement and cancellation lists they approve from.
 */
const IMPLYING_ACTIONS: Partial<
  Record<UnderwriteActionValue, UnderwriteActionValue[]>
> = {
  [UnderwriteAction.ENDORSEMENTS_VIEW]: [UnderwriteAction.APPROVE],
  [UnderwriteAction.CANCELLATIONS_VIEW]: [UnderwriteAction.APPROVE],
};

/** Every line permission that grants `action` (the action's own first). */
export function underwritePermissionsGranting(
  line: UnderwriteLine,
  action: UnderwriteActionValue,
): string[] {
  return [action, ...(IMPLYING_ACTIONS[action] ?? [])].map((item) =>
    underwritePermission(line, item),
  );
}

interface UnderwriteActionDefinition {
  action: UnderwriteActionValue;
  displayName: string;
  description: string;
  /**
   * Holders of any of these existing permissions receive the line gate when
   * the permissions are first introduced, so nobody loses access.
   */
  legacyPermissions: string[];
}

const ACTION_DEFINITIONS: UnderwriteActionDefinition[] = [
  {
    action: UnderwriteAction.VIEW,
    displayName: 'View quotations',
    description: 'Access the line and view its quotations',
    legacyPermissions: ['quotations:read'],
  },
  {
    action: UnderwriteAction.CREATE,
    displayName: 'Create quotations',
    description: 'Create and complete quotations in the line',
    legacyPermissions: ['quotations:create'],
  },
  {
    action: UnderwriteAction.EDIT,
    displayName: 'Edit quotations',
    description: 'Edit quotations in the line',
    legacyPermissions: ['quotations:update'],
  },
  {
    action: UnderwriteAction.DELETE,
    displayName: 'Delete quotations',
    description: 'Delete draft quotations in the line',
    legacyPermissions: ['quotations:delete-draft', 'quotations:delete'],
  },
  {
    action: UnderwriteAction.APPROVE,
    displayName: 'Approve',
    description: 'Approve quotations and policy transactions in the line',
    legacyPermissions: [
      'quotations:approve',
      'endorsements:approve',
      'cancellations:approve',
    ],
  },
  {
    action: UnderwriteAction.POLICIES_VIEW,
    displayName: 'View policies',
    description: 'View policies in the line',
    legacyPermissions: ['policies:read'],
  },
  {
    action: UnderwriteAction.POLICIES_EDIT,
    displayName: 'Edit policies',
    description: 'Amend administrative policy details in the line',
    legacyPermissions: ['policies:update'],
  },
  {
    action: UnderwriteAction.RENEWALS_VIEW,
    displayName: 'View renewals',
    description: 'View renewals in the line',
    legacyPermissions: ['renewals:read'],
  },
  {
    action: UnderwriteAction.RENEWALS_MANAGE,
    displayName: 'Manage renewals',
    description: 'Start and progress renewals in the line',
    legacyPermissions: ['renewals:create'],
  },
  {
    action: UnderwriteAction.ENDORSEMENTS_VIEW,
    displayName: 'View endorsements',
    description: 'View endorsements in the line',
    legacyPermissions: ['endorsements:create', 'policy-transactions:read'],
  },
  {
    action: UnderwriteAction.ENDORSEMENTS_MANAGE,
    displayName: 'Manage endorsements',
    description: 'Create and progress endorsements in the line',
    legacyPermissions: ['endorsements:create'],
  },
  {
    action: UnderwriteAction.CANCELLATIONS_VIEW,
    displayName: 'View cancellations',
    description: 'View cancellations in the line',
    legacyPermissions: ['cancellations:read'],
  },
  {
    action: UnderwriteAction.CANCELLATIONS_MANAGE,
    displayName: 'Manage cancellations',
    description: 'Create and progress cancellations in the line',
    legacyPermissions: ['cancellations:create'],
  },
  {
    action: UnderwriteAction.TIRA_RETRY,
    displayName: 'Retry TIRA submissions',
    description: 'Retry or resubmit failed TIRA submissions in the line',
    legacyPermissions: [
      'quotations:retry-tiramis',
      'endorsements:retry-tiramis',
      'cancellations:submit-tiramis',
    ],
  },
];

export interface UnderwritePermissionDefinition {
  name: string;
  displayName: string;
  description: string;
  legacyPermissions: string[];
}

export const UNDERWRITE_PERMISSION_DEFINITIONS: readonly UnderwritePermissionDefinition[] =
  [
    {
      name: UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
      displayName: 'Underwrite: view dashboard',
      description: 'View the Underwrite overview dashboard',
      legacyPermissions: ['quotations:read', 'policies:read'],
    },
    ...UNDERWRITE_LINES.flatMap((line) =>
      ACTION_DEFINITIONS.map((definition) => ({
        name: underwritePermission(line.line, definition.action),
        displayName: `Underwrite ${line.label}: ${definition.displayName.toLowerCase()}`,
        description: `${definition.description} (${line.label})`,
        legacyPermissions: definition.legacyPermissions,
      })),
    ),
  ];

export const UNDERWRITE_PERMISSION_NAMES: readonly string[] =
  UNDERWRITE_PERMISSION_DEFINITIONS.map((definition) => definition.name);

/** Adds the underwrite gates implied by legacy permissions (seed helper). */
export function withUnderwritePermissionAliases(
  permissionNames: string[],
): string[] {
  const expanded = new Set(permissionNames);
  for (const definition of UNDERWRITE_PERMISSION_DEFINITIONS) {
    if (definition.legacyPermissions.some((name) => expanded.has(name))) {
      expanded.add(definition.name);
    }
  }
  return [...expanded];
}
