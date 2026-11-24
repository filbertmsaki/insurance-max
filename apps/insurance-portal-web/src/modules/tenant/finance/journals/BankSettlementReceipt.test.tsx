import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { context, user, uuid } from '../foundation/__tests__/fixtures';
import { BankSettlementReceipt } from './BankSettlementReceipt';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, authorizationContext: null });
});
function show(permissions: string[]) {
  useAuthStore.setState({
    user,
    authorizationContext: { ...context, permissions },
  });
  const refresh = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BankSettlementReceipt kind="refunds" id={uuid(50)} refresh={refresh} />
    </QueryClientProvider>,
  );
  return refresh;
}
it('requires refund settlement permission to show the bank receipt control', () => {
  show(['commissions:pay']);
  expect(
    screen.queryByLabelText('Signed bank settlement observation'),
  ).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Awaiting verified bank settlement',
  );
});
it('submits a signed receipt to the refund command and keeps the document pending when the file is incomplete', async () => {
  const refresh = show(['refunds:pay']);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  const upload = (body: Record<string, string>) => {
    const content = JSON.stringify(body);
    const file = Object.assign(
      new File([content], 'bank.json', { type: 'application/json' }),
      { text: () => Promise.resolve(content) },
    );
    fireEvent.change(
      screen.getByLabelText('Signed bank settlement observation'),
      { target: { files: [file] } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Record verified settlement' }),
    );
  };
  upload({ reference: 'BANK-1' });
  await screen.findByRole('alert');
  expect(post).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  const receipt = {
    issuer: 'bank',
    keyId: 'test',
    reference: 'BANK-1',
    settledAt: '2026-11-24T10:00:00.000Z',
    signature: 'signed-receipt-test-value',
  };
  upload(receipt);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(post).toHaveBeenCalledWith(
    '/tenant/finance/refunds/' + uuid(50) + '/pay',
    { idempotency_key: 'bank-' + uuid(50), settlement_observation: receipt },
  );
});
