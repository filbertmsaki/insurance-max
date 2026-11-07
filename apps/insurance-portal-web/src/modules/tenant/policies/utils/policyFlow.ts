export type PolicyFlow = 'MOTOR_SINGLE' | 'MOTOR_FLEET' | 'NON_MOTOR';

/**
 * Legacy derivation: business line from the category, and fleet-vs-single
 * from how many vehicles are on the policy today. A fleet reduced to one
 * vehicle therefore looks like single motor here.
 */
export function derivePolicyFlow(
  businessLine: string | undefined,
  vehicleCount: number,
): PolicyFlow {
  if (businessLine !== 'MOTOR') return 'NON_MOTOR';
  return vehicleCount > 1 ? 'MOTOR_FLEET' : 'MOTOR_SINGLE';
}

/** Stored policy line to flow; null when unknown (use the legacy derivation). */
export function flowFromStoredLine(
  line: string | null | undefined,
): PolicyFlow | null {
  switch (line) {
    case 'FLEET':
      return 'MOTOR_FLEET';
    case 'MOTOR':
      return 'MOTOR_SINGLE';
    case 'NON_MOTOR':
      return 'NON_MOTOR';
    default:
      return null;
  }
}

/** The stored line wins when known; otherwise the legacy derivation. */
export function resolvePolicyFlow(params: {
  storedLine?: string | null;
  categoryBusinessLine?: string;
  vehicleCount: number;
}): PolicyFlow {
  return (
    flowFromStoredLine(params.storedLine) ??
    derivePolicyFlow(params.categoryBusinessLine, params.vehicleCount)
  );
}
