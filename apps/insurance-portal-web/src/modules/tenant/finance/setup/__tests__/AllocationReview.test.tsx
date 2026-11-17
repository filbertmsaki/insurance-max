import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllocationReview } from '../AllocationReview';
import { CONFIG_REVIEW, setupApi } from '../api';
import { scope } from './fixtures';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  setupApi: { allocationPreviews: vi.fn(), reviewAllocationPreview: vi.fn() },
}));
const api = vi.mocked(setupApi);
const preview = {
  id: '4db3709a-f50a-4e11-9a60-4971e8100001',
  subject_hash: 'a'.repeat(64),
  occurrence_date: '2026-11-15',
  review_id: null,
  payload: {
    ...scope,
    postingAuthorized: false as const,
    amountMinor: '101',
    currency: 'USD',
    decimalScale: 2,
    lines: [
      { branch: 'HQ', role: 'EXPENSE', debitMinor: '0', creditMinor: '101' },
    ],
  },
};
function mount(permissions: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AllocationReview
        scope={scope}
        identity={['synthetic']}
        permissions={permissions}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.allocationPreviews.mockResolvedValue([preview]);
  api.reviewAllocationPreview.mockResolvedValue({});
});
describe('allocation preview review', () => {
  it('shows lines and submits the exact hash with a reason', async () => {
    mount([CONFIG_REVIEW]);
    expect(await screen.findByText('EXPENSE')).toBeInTheDocument();
    const button = screen.getByRole('button', {
      name: 'Review inactive preview',
    });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review reason for 2026-11-15'), {
      target: { value: 'Verified source and allocation' },
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(api.reviewAllocationPreview).toHaveBeenCalledWith(
        scope,
        preview.id,
        preview.subject_hash,
        'Verified source and allocation',
      ),
    );
  });
  it('does not offer review to a reader without review permission', async () => {
    mount([]);
    expect(await screen.findByText('EXPENSE')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review inactive preview' }),
    ).not.toBeInTheDocument();
  });
});
