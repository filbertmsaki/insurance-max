export function normalizeMotorTextValue(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ').toUpperCase();

  return normalized ? normalized : null;
}
