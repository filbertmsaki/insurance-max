import { UnderwriteLine } from './underwrite-line';

/**
 * Unified "Motor Insurance" module (MF-1).
 *
 * The module is a presentation over the existing MOTOR and FLEET underwrite
 * lines. It never adds a line of its own: every read is restricted to the
 * lines the user already holds the line gate for, and every write goes
 * through the existing line-scoped endpoints.
 */
export const MOTOR_INSURANCE_LINES = [
  UnderwriteLine.MOTOR,
  UnderwriteLine.FLEET,
] as const;

export type MotorInsuranceLine = (typeof MOTOR_INSURANCE_LINES)[number];

export function isMotorInsuranceLine(
  line: string | null | undefined,
): line is MotorInsuranceLine {
  return (MOTOR_INSURANCE_LINES as readonly string[]).includes(line ?? '');
}

/**
 * Pilot gate for the unified module while it runs beside the old Motor and
 * Fleet menus. It grants no data access on its own; it is granted per user
 * only (never through a role) and is removed at cutover.
 */
export const MOTOR_INSURANCE_PREVIEW_PERMISSION =
  'underwrite.motor-unified.preview';

export const MOTOR_INSURANCE_PREVIEW_PERMISSION_DEFINITION = {
  name: MOTOR_INSURANCE_PREVIEW_PERMISSION,
  displayName: 'Motor Insurance (New): pilot access',
  description:
    'Show the unified Motor Insurance module during the pilot. Data access still requires the Motor or Fleet line permissions.',
} as const;

/**
 * MF-7 cutover switch (approved 2026-11-07), shared by the API and the web
 * app. When true the unified module is the Motor/Fleet entry point for every
 * user with Motor or Fleet access and the pilot permission is no longer
 * required. Set to false to roll back to the pilot behaviour.
 */
export const MOTOR_INSURANCE_CUTOVER = true;
