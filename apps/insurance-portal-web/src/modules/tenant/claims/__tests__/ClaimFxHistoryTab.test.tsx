import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ClaimFxHistoryTab } from '../pages/detail/ClaimFxHistoryTab';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/modules/shared/api/client', () => ({ apiClient: { get } }));

describe('Claim FX history', () => {
  it('warns when no verified snapshots exist', async () => {
    get.mockResolvedValue({ data: [] });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ClaimFxHistoryTab claimId="claim-id" />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(/Historical rate provenance is unverified/),
    ).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      '/tenant/claims-fx/claims/claim-id/snapshots',
    );
  });
});
