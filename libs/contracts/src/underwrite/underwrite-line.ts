/**
 * Underwrite business lines.
 *
 * A line is a presentation of the existing `quotations.quotation_flow`
 * discriminator; it never introduces a separate quotation engine.
 */
// Const object instead of `enum`: the web app compiles with
// `erasableSyntaxOnly`, and this module is shared with it.
export const UnderwriteLine = {
  MOTOR: 'MOTOR',
  FLEET: 'FLEET',
  NON_MOTOR: 'NON_MOTOR',
} as const;

export type UnderwriteLine =
  (typeof UnderwriteLine)[keyof typeof UnderwriteLine];

export type UnderwriteLineSlug = 'motor' | 'fleet' | 'non-motor';

/** Mirrors `QuotationFlow` values without depending on the service enum. */
export type UnderwriteQuotationFlow =
  | 'MOTOR_SINGLE'
  | 'MOTOR_FLEET'
  | 'NON_MOTOR';

/** Permission segment for a line, e.g. `underwrite.non_motor.view`. */
export type UnderwriteLinePermissionKey = 'motor' | 'fleet' | 'non_motor';

export interface UnderwriteLineDefinition {
  line: UnderwriteLine;
  slug: UnderwriteLineSlug;
  permissionKey: UnderwriteLinePermissionKey;
  quotationFlow: UnderwriteQuotationFlow;
  label: string;
}

export const UNDERWRITE_LINES: readonly UnderwriteLineDefinition[] = [
  {
    line: UnderwriteLine.MOTOR,
    slug: 'motor',
    permissionKey: 'motor',
    quotationFlow: 'MOTOR_SINGLE',
    label: 'Motor',
  },
  {
    line: UnderwriteLine.FLEET,
    slug: 'fleet',
    permissionKey: 'fleet',
    quotationFlow: 'MOTOR_FLEET',
    label: 'Fleet',
  },
  {
    line: UnderwriteLine.NON_MOTOR,
    slug: 'non-motor',
    permissionKey: 'non_motor',
    quotationFlow: 'NON_MOTOR',
    label: 'Non-Motor',
  },
] as const;

export function getUnderwriteLineDefinition(
  line: UnderwriteLine,
): UnderwriteLineDefinition {
  const definition = UNDERWRITE_LINES.find((item) => item.line === line);
  if (!definition) {
    throw new Error(`Unknown underwrite line: ${String(line)}`);
  }
  return definition;
}

export function underwriteLineFromSlug(slug: string): UnderwriteLine | null {
  return UNDERWRITE_LINES.find((item) => item.slug === slug)?.line ?? null;
}

export function underwriteLineFromQuotationFlow(
  flow: string | null | undefined,
): UnderwriteLine | null {
  return (
    UNDERWRITE_LINES.find((item) => item.quotationFlow === flow)?.line ?? null
  );
}

export function quotationFlowForUnderwriteLine(
  line: UnderwriteLine,
): UnderwriteQuotationFlow {
  return getUnderwriteLineDefinition(line).quotationFlow;
}
