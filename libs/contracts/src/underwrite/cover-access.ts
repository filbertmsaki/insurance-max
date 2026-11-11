import {
  UNDERWRITE_LINES,
  UnderwriteLine,
  type UnderwriteQuotationFlow,
  getUnderwriteLineDefinition,
  underwriteLineFromQuotationFlow,
} from './underwrite-line';
import {
  UnderwriteAction,
  type UnderwriteActionValue,
  underwritePermissionsGranting,
} from './underwrite-permissions';

/**
 * Cover-level underwriting access.
 *
 * A *cover* classifies a quotation (and the policy issued from it) by
 * quotation flow, product and risks:
 *
 * - a whole-line cover (MOTOR, FLEET, NON_MOTOR) is everything in a line and
 *   is granted by the existing `underwrite.<line>.<action>` permissions;
 * - a restricted cover (SHORT_TERM_SINGLE, SHORT_TERM_FLEET) is a subset of
 *   one line, pinned to configured products and risks and a maximum cover
 *   period, and is granted by `underwrite.<cover>.<action>`.
 *
 * Grants are additive. A line grant includes every restricted cover inside
 * that line (Motor includes Short-Term Single, Fleet includes Short-Term
 * Fleet), so existing users keep their access. A restricted grant never
 * implies its line. The action permission (`quotations:*`, `policies:*`)
 * and the data scope (user, branch, department, company) still apply on top.
 */

/**
 * Short-Term (In-Transit) motor cover: the Private Vehicle product quoted on
 * its Transit risk for at most 30 days. Single source for the API and the
 * web app. The codes come from the product engine catalogue
 * (`seeds/data/product-engine.seed.data.json`).
 */
export const SHORT_TERM_COVER = {
  name: 'Short-Term (In-Transit)',
  motorClass: 'Private Vehicle',
  productCode: 'SP014001000000',
  riskCode: 'SP014001000007',
  durationDays: 30,
} as const;

// Const object instead of `enum`: shared with the web app
// (`erasableSyntaxOnly`).
export const UnderwriteCover = {
  MOTOR: 'MOTOR',
  FLEET: 'FLEET',
  NON_MOTOR: 'NON_MOTOR',
  SHORT_TERM_SINGLE: 'SHORT_TERM_SINGLE',
  SHORT_TERM_FLEET: 'SHORT_TERM_FLEET',
} as const;

export type UnderwriteCover =
  (typeof UnderwriteCover)[keyof typeof UnderwriteCover];

export interface UnderwriteCoverRestriction {
  productCodes: readonly string[];
  riskCodes: readonly string[];
  /** Longest cover period (start to end) the cover may have, in days. */
  maxCoverDays: number;
}

export interface UnderwriteCoverDefinition {
  cover: UnderwriteCover;
  label: string;
  description: string;
  line: UnderwriteLine;
  quotationFlow: UnderwriteQuotationFlow;
  /** Permission segment, e.g. `underwrite.short_term.create`. */
  permissionKey: string;
  /** Null for a whole-line cover. */
  restriction: UnderwriteCoverRestriction | null;
}

const SHORT_TERM_RESTRICTION: UnderwriteCoverRestriction = {
  productCodes: [SHORT_TERM_COVER.productCode],
  riskCodes: [SHORT_TERM_COVER.riskCode],
  maxCoverDays: SHORT_TERM_COVER.durationDays,
};

export const UNDERWRITE_COVERS: readonly UnderwriteCoverDefinition[] = [
  ...UNDERWRITE_LINES.map((line) => ({
    cover: line.line,
    label: line.label,
    description: `Every ${line.label} quotation and policy`,
    line: line.line,
    quotationFlow: line.quotationFlow,
    permissionKey: line.permissionKey,
    restriction: null,
  })),
  {
    cover: UnderwriteCover.SHORT_TERM_SINGLE,
    label: 'Short-Term Single',
    description: `${SHORT_TERM_COVER.name}, one vehicle (${SHORT_TERM_COVER.productCode} / ${SHORT_TERM_COVER.riskCode}, up to ${SHORT_TERM_COVER.durationDays} days)`,
    line: UnderwriteLine.MOTOR,
    quotationFlow: 'MOTOR_SINGLE',
    permissionKey: 'short_term',
    restriction: SHORT_TERM_RESTRICTION,
  },
  {
    cover: UnderwriteCover.SHORT_TERM_FLEET,
    label: 'Short-Term Fleet',
    description: `${SHORT_TERM_COVER.name}, fleet (${SHORT_TERM_COVER.productCode} / ${SHORT_TERM_COVER.riskCode}, up to ${SHORT_TERM_COVER.durationDays} days)`,
    line: UnderwriteLine.FLEET,
    quotationFlow: 'MOTOR_FLEET',
    permissionKey: 'short_term_fleet',
    restriction: SHORT_TERM_RESTRICTION,
  },
];

/**
 * Actions a restricted cover can be granted. Policy transactions
 * (endorsements, cancellations, renewals) stay with the line grant.
 */
export const UNDERWRITE_COVER_ACTIONS: readonly UnderwriteActionValue[] = [
  UnderwriteAction.VIEW,
  UnderwriteAction.CREATE,
  UnderwriteAction.EDIT,
  UnderwriteAction.DELETE,
  UnderwriteAction.SUBMIT,
  UnderwriteAction.APPROVE,
  UnderwriteAction.POLICIES_VIEW,
  UnderwriteAction.TIRA_RETRY,
];

const ACTION_LABELS: Record<string, string> = {
  [UnderwriteAction.VIEW]: 'View quotations',
  [UnderwriteAction.CREATE]: 'Create and complete quotations',
  [UnderwriteAction.EDIT]: 'Edit quotations',
  [UnderwriteAction.DELETE]: 'Delete draft quotations',
  [UnderwriteAction.SUBMIT]:
    'Submit for approval, request payment and submit to TIRA',
  [UnderwriteAction.APPROVE]: 'Approve quotations',
  [UnderwriteAction.POLICIES_VIEW]: 'View policies and documents',
  [UnderwriteAction.TIRA_RETRY]: 'Retry failed TIRA submissions',
};

export function underwriteActionLabel(action: UnderwriteActionValue): string {
  return ACTION_LABELS[action] ?? action;
}

export function getUnderwriteCoverDefinition(
  cover: UnderwriteCover,
): UnderwriteCoverDefinition {
  const definition = UNDERWRITE_COVERS.find((item) => item.cover === cover);
  if (!definition) {
    throw new Error(`Unknown underwrite cover: ${String(cover)}`);
  }
  return definition;
}

export function parseUnderwriteCover(
  value: string | null | undefined,
): UnderwriteCover | null {
  return UNDERWRITE_COVERS.find((item) => item.cover === value)?.cover ?? null;
}

export function isRestrictedUnderwriteCover(cover: UnderwriteCover): boolean {
  return getUnderwriteCoverDefinition(cover).restriction !== null;
}

/** The whole-line cover of a line. */
export function underwriteCoverForLine(line: UnderwriteLine): UnderwriteCover {
  return line;
}

/** Every cover inside a line (whole-line cover first). */
export function underwriteCoversInLine(
  line: UnderwriteLine,
): UnderwriteCover[] {
  return UNDERWRITE_COVERS.filter((item) => item.line === line).map(
    (item) => item.cover,
  );
}

/** Actions that can be granted for a cover. */
export function underwriteCoverActions(
  cover: UnderwriteCover,
): readonly UnderwriteActionValue[] {
  return isRestrictedUnderwriteCover(cover)
    ? UNDERWRITE_COVER_ACTIONS
    : Object.values(UnderwriteAction);
}

/** The permission that grants `action` on `cover` itself. */
export function underwriteCoverPermission(
  cover: UnderwriteCover,
  action: UnderwriteActionValue,
): string {
  return `underwrite.${getUnderwriteCoverDefinition(cover).permissionKey}.${action}`;
}

/**
 * Every permission that grants `action` on records of `cover`: the cover's
 * own permission (restricted covers) and the line permissions (a line grant
 * includes the restricted covers inside it).
 */
export function underwriteCoverPermissionsGranting(
  cover: UnderwriteCover,
  action: UnderwriteActionValue,
): string[] {
  const definition = getUnderwriteCoverDefinition(cover);
  const line = underwritePermissionsGranting(definition.line, action);
  if (!definition.restriction) return line;
  return UNDERWRITE_COVER_ACTIONS.includes(action)
    ? [underwriteCoverPermission(cover, action), ...line]
    : line;
}

/**
 * Permissions that let a user enter a line's routes for `action`: the line
 * gate, or the gate of a restricted cover inside the line. Only routes whose
 * services filter records by cover may accept these.
 */
export function underwriteLineEntryPermissions(
  line: UnderwriteLine,
  action: UnderwriteActionValue,
): string[] {
  const restricted = UNDERWRITE_COVERS.filter(
    (item) =>
      item.line === line &&
      item.restriction &&
      UNDERWRITE_COVER_ACTIONS.includes(action),
  ).map((item) => underwriteCoverPermission(item.cover, action));
  return [...underwritePermissionsGranting(line, action), ...restricted];
}

export interface UnderwriteCoverPermissionDefinition {
  name: string;
  displayName: string;
  description: string;
  cover: UnderwriteCover;
  action: UnderwriteActionValue;
  /** Restricted covers are never derived from legacy permissions. */
  legacyPermissions: string[];
}

export const UNDERWRITE_COVER_PERMISSION_DEFINITIONS: readonly UnderwriteCoverPermissionDefinition[] =
  UNDERWRITE_COVERS.filter((item) => item.restriction).flatMap((definition) =>
    UNDERWRITE_COVER_ACTIONS.map((action) => ({
      name: underwriteCoverPermission(definition.cover, action),
      displayName: `Underwrite ${definition.label}: ${underwriteActionLabel(action).toLowerCase()}`,
      description: `${underwriteActionLabel(action)} for ${definition.description} only. Does not grant other ${getUnderwriteLineDefinition(definition.line).label} business.`,
      cover: definition.cover,
      action,
      legacyPermissions: [],
    })),
  );

export const UNDERWRITE_COVER_PERMISSION_NAMES: readonly string[] =
  UNDERWRITE_COVER_PERMISSION_DEFINITIONS.map((item) => item.name);

/** Cover → actions the permission set grants on it. */
export type UnderwriteCoverAccess = Record<
  UnderwriteCover,
  UnderwriteActionValue[]
>;

/**
 * Effective cover access of a permission set (roles and direct grants are
 * already merged into one set by the caller).
 */
export function resolveUnderwriteCoverAccess(
  permissions: Iterable<string>,
): UnderwriteCoverAccess {
  const held = new Set(permissions);
  return Object.fromEntries(
    UNDERWRITE_COVERS.map((definition) => [
      definition.cover,
      underwriteCoverActions(definition.cover).filter((action) =>
        underwriteCoverPermissionsGranting(definition.cover, action).some(
          (name) => held.has(name),
        ),
      ),
    ]),
  ) as UnderwriteCoverAccess;
}

/** Covers on which the permission set grants `action`. */
export function underwriteCoversAllowed(
  permissions: Iterable<string>,
  action: UnderwriteActionValue,
): UnderwriteCover[] {
  const held = new Set(permissions);
  return UNDERWRITE_COVERS.filter((definition) =>
    underwriteCoverPermissionsGranting(definition.cover, action).some((name) =>
      held.has(name),
    ),
  ).map((definition) => definition.cover);
}

/** Covers on which the permission set grants any action. */
export function underwriteCoversWithAnyAccess(
  permissions: Iterable<string>,
): UnderwriteCover[] {
  const access = resolveUnderwriteCoverAccess(permissions);
  return UNDERWRITE_COVERS.filter(
    (definition) => access[definition.cover].length > 0,
  ).map((definition) => definition.cover);
}

export function canAccessUnderwriteCover(
  permissions: Iterable<string>,
  cover: UnderwriteCover,
  action: UnderwriteActionValue,
): boolean {
  const held = new Set(permissions);
  return underwriteCoverPermissionsGranting(cover, action).some((name) =>
    held.has(name),
  );
}

/** Where a cover grant comes from, for the administration screens. */
export function underwriteCoverGrantSource(
  permissions: Iterable<string>,
  cover: UnderwriteCover,
  action: UnderwriteActionValue,
): 'LINE' | 'COVER' | null {
  const held = new Set(permissions);
  const definition = getUnderwriteCoverDefinition(cover);
  if (
    underwritePermissionsGranting(definition.line, action).some((name) =>
      held.has(name),
    )
  ) {
    return 'LINE';
  }
  return definition.restriction &&
    UNDERWRITE_COVER_ACTIONS.includes(action) &&
    held.has(underwriteCoverPermission(cover, action))
    ? 'COVER'
    : null;
}

/**
 * The cover action guarded by a quotation/policy permission when it is used
 * as a data-scope permission. Unlisted permissions are not cover-gated
 * directly (see `DataAccessScopeService`).
 */
export const UNDERWRITE_SCOPE_PERMISSION_ACTIONS: Readonly<
  Record<string, UnderwriteActionValue>
> = {
  'quotations:read': UnderwriteAction.VIEW,
  'quotations:create': UnderwriteAction.CREATE,
  'quotations:complete': UnderwriteAction.CREATE,
  'quotations:update': UnderwriteAction.EDIT,
  'quotations:cancel': UnderwriteAction.EDIT,
  'quotations:delete-draft': UnderwriteAction.DELETE,
  'quotations:delete': UnderwriteAction.DELETE,
  'quotations:submit-approval': UnderwriteAction.SUBMIT,
  'quotations:request-payment': UnderwriteAction.SUBMIT,
  'quotations:submit-tiramis': UnderwriteAction.SUBMIT,
  'quotations:retry-tiramis': UnderwriteAction.TIRA_RETRY,
  'quotations:approve': UnderwriteAction.APPROVE,
  'quotations:approve-high-risk': UnderwriteAction.APPROVE,
  'quotations:direct-approve': UnderwriteAction.APPROVE,
  'quotations:request-changes': UnderwriteAction.APPROVE,
  'quotations:reject': UnderwriteAction.APPROVE,
  'policies:read': UnderwriteAction.POLICIES_VIEW,
  'policies:update': UnderwriteAction.POLICIES_EDIT,
};

export function underwriteActionForScopePermission(
  permission: string | null | undefined,
): UnderwriteActionValue | null {
  return permission
    ? (UNDERWRITE_SCOPE_PERMISSION_ACTIONS[permission] ?? null)
    : null;
}

export function isPolicyUnderwriteAction(
  action: UnderwriteActionValue,
): boolean {
  return action.startsWith('policies.');
}

// ─── Classification ────────────────────────────────────────────────────────

export const UnderwriteCoverStatus = {
  /** Every risk fits one cover. */
  CLASSIFIED: 'CLASSIFIED',
  /**
   * Some risks fit a restricted cover and some do not, or the product or
   * period does not fit it. Classified as the whole line, so only line
   * holders may work on it.
   */
  MIXED: 'MIXED',
  /** No risk selected yet (early draft): the stated cover is used. */
  INCOMPLETE: 'INCOMPLETE',
  /** Unknown quotation flow. */
  INVALID: 'INVALID',
} as const;

export type UnderwriteCoverStatus =
  (typeof UnderwriteCoverStatus)[keyof typeof UnderwriteCoverStatus];

export interface UnderwriteCoverFacts {
  quotationFlow: string | null | undefined;
  productCode: string | null | undefined;
  riskCodes: readonly (string | null | undefined)[];
  coverStart?: Date | string | null;
  coverEnd?: Date | string | null;
}

export interface UnderwriteCoverClassification {
  cover: UnderwriteCover | null;
  status: UnderwriteCoverStatus;
  reason: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normaliseCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Cover period in days, or null when either date is missing. */
export function coverPeriodDays(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): number | null {
  const from = toTime(start);
  const to = toTime(end);
  return from === null || to === null ? null : (to - from) / DAY_MS;
}

/**
 * Classifies a quotation from server-side facts. A restricted cover needs
 * every risk to be one of its risks, the product to be one of its products
 * and the cover period (when known) to be within its maximum.
 */
export function classifyUnderwriteCover(
  facts: UnderwriteCoverFacts,
): UnderwriteCoverClassification {
  const line = underwriteLineFromQuotationFlow(facts.quotationFlow);
  if (!line) {
    return {
      cover: null,
      status: UnderwriteCoverStatus.INVALID,
      reason: `Unknown quotation flow ${String(facts.quotationFlow)}.`,
    };
  }
  const lineCover = underwriteCoverForLine(line);
  const restricted = UNDERWRITE_COVERS.filter(
    (item) => item.line === line && item.restriction,
  );
  if (restricted.length === 0) {
    return {
      cover: lineCover,
      status: UnderwriteCoverStatus.CLASSIFIED,
      reason: null,
    };
  }

  const risks = [
    ...new Set(facts.riskCodes.map(normaliseCode).filter(Boolean)),
  ];
  if (risks.length === 0) {
    return {
      cover: null,
      status: UnderwriteCoverStatus.INCOMPLETE,
      reason: 'No risk has been selected yet.',
    };
  }

  const product = normaliseCode(facts.productCode);
  const days = coverPeriodDays(facts.coverStart, facts.coverEnd);
  for (const definition of restricted) {
    const restriction = definition.restriction!;
    const riskSet = new Set(restriction.riskCodes.map(normaliseCode));
    const matching = risks.filter((risk) => riskSet.has(risk));
    if (matching.length === 0) continue;

    const mixed = (reason: string): UnderwriteCoverClassification => ({
      cover: lineCover,
      status: UnderwriteCoverStatus.MIXED,
      reason,
    });
    if (matching.length !== risks.length) {
      return mixed(
        `${definition.label} risks are mixed with other risks; it is classified as ${definition.line}.`,
      );
    }
    if (!restriction.productCodes.map(normaliseCode).includes(product)) {
      return mixed(
        `${definition.label} risks are on product ${product || '(none)'} instead of ${restriction.productCodes.join(', ')}.`,
      );
    }
    if (days !== null && (days < 0 || days > restriction.maxCoverDays)) {
      return mixed(
        `${definition.label} cover may not exceed ${restriction.maxCoverDays} days.`,
      );
    }
    return {
      cover: definition.cover,
      status: UnderwriteCoverStatus.CLASSIFIED,
      reason: null,
    };
  }

  return {
    cover: lineCover,
    status: UnderwriteCoverStatus.CLASSIFIED,
    reason: null,
  };
}

export type UnderwriteCoverResolution =
  | { cover: UnderwriteCover; error?: undefined }
  | { cover?: undefined; error: string };

/**
 * The cover stored on a quotation. Complete records use their
 * classification; the client's stated cover (`intent`) only decides an
 * incomplete draft, and must fit the flow and product. An incomplete draft
 * with no valid statement keeps its stored cover, else the whole line.
 */
export function resolveUnderwriteCover(
  classification: UnderwriteCoverClassification,
  context: {
    quotationFlow: string | null | undefined;
    productCode: string | null | undefined;
    intent?: string | null;
    existing?: string | null;
  },
): UnderwriteCoverResolution {
  if (classification.status === UnderwriteCoverStatus.INVALID) {
    return { error: classification.reason ?? 'Invalid quotation flow.' };
  }
  if (classification.status !== UnderwriteCoverStatus.INCOMPLETE) {
    return { cover: classification.cover! };
  }

  const line = underwriteLineFromQuotationFlow(context.quotationFlow)!;
  const product = normaliseCode(context.productCode);

  if (context.intent) {
    const intent = parseUnderwriteCover(context.intent);
    if (!intent) {
      return { error: `Unknown cover ${context.intent}.` };
    }
    const definition = getUnderwriteCoverDefinition(intent);
    if (definition.line !== line) {
      return {
        error: `${definition.label} cannot be quoted as ${String(context.quotationFlow)}.`,
      };
    }
    if (
      definition.restriction &&
      product &&
      !definition.restriction.productCodes.map(normaliseCode).includes(product)
    ) {
      return {
        error: `${definition.label} must use product ${definition.restriction.productCodes.join(', ')}.`,
      };
    }
    return { cover: intent };
  }

  const existing = parseUnderwriteCover(context.existing);
  if (existing) {
    const definition = getUnderwriteCoverDefinition(existing);
    const productFits =
      !definition.restriction ||
      !product ||
      definition.restriction.productCodes.map(normaliseCode).includes(product);
    if (definition.line === line && productFits) {
      return { cover: existing };
    }
  }
  return { cover: underwriteCoverForLine(line) };
}

/**
 * Every `risk_code` value in a (draft) payload, searched to a bounded depth.
 * Extra values can only make a record MIXED (more restrictive), never less.
 */
export function collectRiskCodes(payload: unknown, maxDepth = 10): string[] {
  const codes = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > maxDepth) return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      if (key === 'risk_code' && typeof value === 'string' && value.trim()) {
        codes.add(normaliseCode(value));
      } else {
        visit(value, depth + 1);
      }
    }
  };
  visit(payload, 0);
  return [...codes];
}
