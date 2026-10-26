/**
 * Motor cover class of an insurance risk. Drives the TIRAMIS fleet
 * `ComprehensiveInsured` count (§6 FleetHdr), so every place that counts
 * comprehensive vehicles must use {@link classifyMotorCover}.
 */
// Const object instead of `enum`: shared with the web app, which compiles
// with `erasableSyntaxOnly`.
export const MotorCoverClass = {
  COMPREHENSIVE: 'COMPREHENSIVE',
  THIRD_PARTY_FIRE_THEFT: 'THIRD_PARTY_FIRE_THEFT',
  THIRD_PARTY: 'THIRD_PARTY',
} as const;

export type MotorCoverClass =
  (typeof MotorCoverClass)[keyof typeof MotorCoverClass];

export const MOTOR_COVER_CLASS_LABELS: Record<MotorCoverClass, string> = {
  COMPREHENSIVE: 'Comprehensive',
  THIRD_PARTY_FIRE_THEFT: 'Third Party, Fire & Theft',
  THIRD_PARTY: 'Third Party only',
};

export function isMotorCoverClass(value: unknown): value is MotorCoverClass {
  return (
    typeof value === 'string' &&
    (Object.values(MotorCoverClass) as string[]).includes(value)
  );
}

export interface MotorCoverClassSource {
  cover_class?: string | null;
  risk_name?: string | null;
  risk_code?: string | null;
}

/**
 * The configured class, else a best guess from the risk name/code for risks
 * not yet tagged. `null` means it cannot be told, so callers should warn.
 */
export function classifyMotorCover(
  risk: MotorCoverClassSource | null | undefined,
): MotorCoverClass | null {
  if (!risk) return null;
  if (isMotorCoverClass(risk.cover_class)) return risk.cover_class;

  // Most specific first: tariff names such as "Oil tankers- Comprehensive:TPO"
  // carry the section heading before the actual cover.
  const text = `${risk.risk_name ?? ''} ${risk.risk_code ?? ''}`.toUpperCase();
  if (/FIRE|THEFT|TPFT|TPF&T/.test(text))
    return MotorCoverClass.THIRD_PARTY_FIRE_THEFT;
  if (/THIRD\s*PARTY|\bTPO?\b|\bACT\b/.test(text))
    return MotorCoverClass.THIRD_PARTY;
  if (/COMPREHENSIVE|\bCOMP\b/.test(text)) return MotorCoverClass.COMPREHENSIVE;
  return null;
}

/**
 * Whether the class counts towards TIRA's comprehensively insured vehicles.
 * Third Party, Fire & Theft counts as comprehensive by business decision.
 */
export function countsAsComprehensive(
  coverClass: MotorCoverClass | null,
): boolean {
  return (
    coverClass === MotorCoverClass.COMPREHENSIVE ||
    coverClass === MotorCoverClass.THIRD_PARTY_FIRE_THEFT
  );
}

export interface FleetComprehensiveCount {
  comprehensive: number;
  /** Vehicles with at least one cover that could not be classified. */
  unclassified: number;
  total: number;
}

/**
 * A vehicle is comprehensive when any of its covers counts as comprehensive;
 * it is unclassified when none does and at least one cover is unknown.
 */
export function countComprehensiveVehicles(
  vehicles: ReadonlyArray<ReadonlyArray<MotorCoverClassSource | null>>,
): FleetComprehensiveCount {
  let comprehensive = 0;
  let unclassified = 0;
  for (const covers of vehicles) {
    const classes = covers.map(classifyMotorCover);
    if (classes.some(countsAsComprehensive)) comprehensive += 1;
    else if (classes.length === 0 || classes.includes(null)) unclassified += 1;
  }
  return { comprehensive, unclassified, total: vehicles.length };
}
