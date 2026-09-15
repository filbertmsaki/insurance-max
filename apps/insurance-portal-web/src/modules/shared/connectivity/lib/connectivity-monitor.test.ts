import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isCancel: vi.fn(() => false),
  },
}));

describe('connectivity monitor', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays online when a single dropped request is confirmed reachable', async () => {
    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

    const { reportNetworkFailure } = await import('./connectivity-monitor');
    const { useConnectivityStore } =
      await import('../store/connectivity.store');

    reportNetworkFailure();
    // No UI flip before the confirmation probe runs — avoids flicker on
    // a single transient failure.
    expect(useConnectivityStore.getState().status).toBe('online');

    await vi.advanceTimersByTimeAsync(800);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(useConnectivityStore.getState().status).toBe('online');
  });

  it('goes offline after a confirmed outage and recovers once polling succeeds', async () => {
    const axios = (await import('axios')).default;
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: {} });

    const { reportNetworkFailure } = await import('./connectivity-monitor');
    const { useConnectivityStore } =
      await import('../store/connectivity.store');

    reportNetworkFailure();
    await vi.advanceTimersByTimeAsync(800);
    expect(useConnectivityStore.getState().status).toBe('offline');

    await vi.advanceTimersByTimeAsync(4000);
    expect(useConnectivityStore.getState().status).toBe('offline');

    await vi.advanceTimersByTimeAsync(4000);
    expect(useConnectivityStore.getState().status).toBe('online');
  });

  it('collapses simultaneous failures into a single confirmation probe', async () => {
    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValue({ data: {} });

    const { reportNetworkFailure } = await import('./connectivity-monitor');

    reportNetworkFailure();
    reportNetworkFailure();
    reportNetworkFailure();

    await vi.advanceTimersByTimeAsync(800);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('retryConnectionNow bypasses the debounce and checks immediately', async () => {
    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

    const { retryConnectionNow } = await import('./connectivity-monitor');
    const { useConnectivityStore } =
      await import('../store/connectivity.store');

    const result = await retryConnectionNow();

    expect(result).toBe(true);
    expect(useConnectivityStore.getState().status).toBe('online');
  });

  it('reportRequestSuccess clears offline state without waiting for the next poll', async () => {
    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network down'));

    const { reportNetworkFailure, reportRequestSuccess } =
      await import('./connectivity-monitor');
    const { useConnectivityStore } =
      await import('../store/connectivity.store');

    reportNetworkFailure();
    await vi.advanceTimersByTimeAsync(800);
    expect(useConnectivityStore.getState().status).toBe('offline');

    reportRequestSuccess();

    expect(useConnectivityStore.getState().status).toBe('online');
  });
});
