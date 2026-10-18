/**
 * Matching key for registration and chassis numbers: letters and digits only,
 * upper case, so "t 123-abc" and "T123ABC" are the same vehicle. Stored in
 * `registration_no_normalized` / `chassis_no_normalized`.
 */
export function normalizeMotorIdentifier(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  return (
    String(value)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase() || null
  );
}

/** Shows the first three and last four characters of a chassis number. */
export function maskChassisNumber(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 7)
    return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  return `${value.slice(0, 3)}${'*'.repeat(value.length - 7)}${value.slice(-4)}`;
}
