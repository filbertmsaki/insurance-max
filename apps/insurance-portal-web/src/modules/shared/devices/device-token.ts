import { createBrowserSafeId } from '@/lib/ids';

const DEVICE_TOKEN_KEY = 'insurance-max-device-token';

function generateDeviceToken(): string {
  return [createBrowserSafeId(), createBrowserSafeId()].join('.');
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
