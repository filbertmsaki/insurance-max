const DEVICE_TOKEN_KEY = 'insurance-max-device-token';

function generateDeviceToken(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return [crypto.randomUUID(), crypto.randomUUID()].join('.');
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('.');
}

export function getDeviceToken(): string {
  const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);

  if (existing && existing.length >= 32) {
    return existing;
  }

  const token = generateDeviceToken();

  window.localStorage.setItem(DEVICE_TOKEN_KEY, token);

  return token;
}

export function rotateDeviceToken(): string {
  const token = generateDeviceToken();

  window.localStorage.setItem(DEVICE_TOKEN_KEY, token);

  return token;
}
