import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwriteApi } from '../api';
import { FleetVehiclesPanel } from '../fleet/FleetVehiclesPanel';
import type { FleetSummary } from '../types';

vi.mock('../api', () => ({
  underwriteApi: { getFleetVehicles: vi.fn(), syncFleetRegister: vi.fn() },
}));
vi.mock('@/components/data-table', () => ({ DataTable: () => null }));
const failed: FleetSummary = {
  fleet_id: 'FLT-1',
  fleet_reference: 'FLT-1',
  fleet_type: 1,
  fleet_size: 2,
  comprehensive_insured: 2,
  register_fleet_id: null,
  register_status: null,
  register_sync_status: 'FAILED',
  register_sync_error:
    'Fleet register synchronization failed. Retry to synchronize the latest quotation.',
  register_sync_attempted_at: '2026-11-07T12:00:00Z',
  vehicles: [],
  totals: {
    vehicles: 2,
    sum_insured: 1000,
    premium_excluding_tax: 100,
    premium_including_tax: 118,
    issued_cover_notes: 0,
  },
};
function panel() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <FleetVehiclesPanel kind="quotation" id="q-1" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ hasPermission: () => true });
});
describe('Fleet register synchronization status', () => {
  it('shows a persisted failure, retries it and replaces it with the refreshed success status', async () => {
    vi.mocked(underwriteApi.getFleetVehicles)
      .mockResolvedValueOnce(failed)
      .mockResolvedValue({
        ...failed,
        register_fleet_id: 'register-1',
        register_sync_status: 'SYNCED',
        register_sync_error: null,
      });
    vi.mocked(underwriteApi.syncFleetRegister).mockResolvedValue({
      fleetId: 'register-1',
    });
    panel();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Fleet register: failed',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry synchronization' }),
    );
    await waitFor(() =>
      expect(underwriteApi.syncFleetRegister).toHaveBeenCalledWith('q-1'),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Fleet register: synced',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('shows failures after reload without offering a write action to a reader', async () => {
    useAuthStore.setState({ hasPermission: () => false });
    vi.mocked(underwriteApi.getFleetVehicles).mockResolvedValue(failed);
    panel();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Retry to synchronize',
    );
    expect(
      screen.queryByRole('button', { name: 'Retry synchronization' }),
    ).not.toBeInTheDocument();
    expect(underwriteApi.syncFleetRegister).not.toHaveBeenCalled();
  });
});
