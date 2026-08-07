export function generateSecret(options?: { length?: number }) {
  const length = options?.length ?? 32;
  return 'A'.repeat(length);
}

export function generateURI(params: {
  issuer: string;
  label: string;
  secret: string;
}) {
  return `otpauth://totp/${encodeURIComponent(params.issuer)}:${encodeURIComponent(
    params.label,
  )}?secret=${params.secret}&issuer=${encodeURIComponent(params.issuer)}`;
}

export async function verify(_params: {
  secret: string;
  token: string;
}) {
  return { valid: true };
}
