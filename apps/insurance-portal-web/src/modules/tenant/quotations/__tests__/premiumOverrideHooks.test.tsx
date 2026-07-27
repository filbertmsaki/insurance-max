import { act, renderHook } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useRequestQuotationPremiumOverride } from '../hooks';

const {
  requestPremiumOverride,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  requestPremiumOverride: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../api', () => ({
  quotationsApi: {
    requestPremiumOverride,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useRequestQuotationPremiumOverride', () => {
  it('submits the override request and invalidates quotation caches', async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    requestPremiumOverride.mockResolvedValueOnce({
      id: 'override-1',
      approval_status: 'PENDING',
    });

    const { result } = renderHook(
      () => useRequestQuotationPremiumOverride('quotation-1'),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await act(async () => {
      await result.current.mutateAsync({
        riskId: 'risk-1',
        payload: {
          proposed_premium: 125000,
          override_reason: 'Manual underwriting adjustment',
          supporting_notes: 'Approved for retained account',
        },
      });
    });

    expect(requestPremiumOverride).toHaveBeenCalledWith(
      'quotation-1',
      'risk-1',
      {
        proposed_premium: 125000,
        override_reason: 'Manual underwriting adjustment',
        supporting_notes: 'Approved for retained account',
      },
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['quotations'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['quotations', 'detail', 'quotation-1'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['quotations', 'preview', 'quotation-1'],
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      'Premium override request submitted',
    );
    expect(toastError).not.toHaveBeenCalled();
  });
});
