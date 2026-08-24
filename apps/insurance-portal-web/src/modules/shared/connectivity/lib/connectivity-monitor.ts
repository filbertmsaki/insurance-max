import axios from 'axios';

import { API_BASE_URL } from '@/modules/shared/config';

import { useConnectivityStore } from '../store/connectivity.store';

const HEALTH_URL = `${API_BASE_URL}/health/live`;
const CONFIRM_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 4000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

let confirmTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let checkInFlight = false;

async function pingHealth(): Promise<boolean> {
  try {
    // Raw axios (not apiClient) — a health probe must skip auth headers,
    // response interceptors, and the token-refresh flow entirely.
    await axios.get(HEALTH_URL, { timeout: HEALTH_CHECK_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(() => {
    void checkNow();
  }, POLL_INTERVAL_MS);
}

async function checkNow(): Promise<boolean> {
  if (checkInFlight) {
    return useConnectivityStore.getState().status === 'online';
  }

  checkInFlight = true;
  const reachable = await pingHealth();
  checkInFlight = false;

  useConnectivityStore.getState().setLastCheckedAt(Date.now());

  if (reachable) {
    stopPolling();
    useConnectivityStore.getState().setStatus('online');
  } else {
    useConnectivityStore.getState().setStatus('offline');
    startPolling();
  }

  return reachable;
}

/**
 * Called by the API client whenever a request fails with no response
 * (connection refused, timeout, DNS/CORS failure). A single dropped request
 * shouldn't flip the whole app offline, so this schedules one debounced
 * confirmation probe instead of reacting immediately — repeat calls while a
 * probe is pending or the app is already offline are no-ops, so concurrent
 * failing requests only ever start one reconnection loop.
 */
export function reportNetworkFailure(): void {
  if (useConnectivityStore.getState().status === 'offline') {
    return;
  }

  if (confirmTimer) {
    return;
  }

  confirmTimer = setTimeout(() => {
    confirmTimer = null;
    void checkNow();
  }, CONFIRM_DEBOUNCE_MS);
}

/** Called by the API client whenever any request succeeds. */
export function reportRequestSuccess(): void {
  if (confirmTimer) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  }

  if (useConnectivityStore.getState().status === 'offline') {
    stopPolling();
    useConnectivityStore.getState().setStatus('online');
  }
}

/** Triggered by the "Retry Connection" button — bypasses the debounce. */
export function retryConnectionNow(): Promise<boolean> {
  if (confirmTimer) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  }

  return checkNow();
}
