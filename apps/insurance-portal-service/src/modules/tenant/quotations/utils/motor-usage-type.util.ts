/**
 * Maps a TIRAMIS motor usage code to the `motor_vehicles.usage_type` label
 * (1 = private, 2 = commercial). Unknown codes map to null.
 */
export function motorUsageTypeLabel(
  motorUsage: number | string | null | undefined,
): 'PRIVATE' | 'COMMERCIAL' | null {
  switch (Number(motorUsage)) {
    case 1:
      return 'PRIVATE';
    case 2:
      return 'COMMERCIAL';
    default:
      return null;
  }
}
