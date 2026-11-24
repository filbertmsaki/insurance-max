import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '@/modules/shared/api/client';
import { FirstFinanceBook } from '../FirstFinanceBook';
import { OperatingPostings } from '../OperatingPostings';
import { scope, uuid } from './fixtures';

afterEach(() => {
  vi.restoreAllMocks();
});
function show(child: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
}
it('submits the first book with the chosen preparer and bounded reviewer appointment', async () => {
  const preparer = uuid(20),
    created = vi.fn(),
    post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      currency: 'TZS',
      members: [{ id: preparer, firstName: 'Asha', lastName: 'Moshi' }],
    },
  });
  show(<FirstFinanceBook identity={['company']} created={created} />);
  await screen.findByRole('option', { name: 'Asha Moshi' });
  const fill = (name: string, value: string) =>
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  fill('Business profile', 'BROKER');
  fill('Finance preparer', preparer);
  fill('Appointment reference', 'Board resolution 12');
  fill('Appointment ends before', '2027-06-01');
  fill('Journal approval role', 'REVIEWER');
  fill('Journal approval limit (TZS)', '1000');
  fireEvent.click(screen.getByRole('button', { name: /Create draft book/ }));
  await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith(
    '/tenant/finance/setup/onboarding',
    expect.objectContaining({
      preparerUserId: preparer,
      approvalRole: 'REVIEWER',
      authorityReference: 'Board resolution 12',
      limits: { TZS: '1000' },
    }),
  );
});
it('shows both journal legs and sends the selected candidate hash with the review decision', async () => {
  const id = uuid(45),
    hash = 'a'.repeat(64),
    post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { journalId: uuid(46) } });
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: [
      {
        candidateId: id,
        hash,
        maker: false,
        expired: false,
        decisions: 0,
        requiredCheckers: '1',
        snapshot: {
          sourceId: uuid(44),
          eventType: 'RECEIPT_POSTED',
          reference: 'RC0001',
          amount: '125.00',
          currency: 'TZS',
          transactionDate: '2026-11-24',
        },
        lines: [
          { account: '1100', role: 'CASH', debit: '125.00', credit: '0' },
          { account: '1200', role: 'AR', debit: '0', credit: '125.00' },
        ],
      },
    ],
  });
  show(<OperatingPostings scope={scope} canApprove />);
  expect(await screen.findByText('1100')).toBeInTheDocument();
  expect(screen.getByText('1200')).toBeInTheDocument();
  const approve = screen.getByRole('button', { name: 'Approve journal' });
  expect(approve).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Decision reason'), {
    target: { value: 'Verified source receipt' },
  });
  fireEvent.click(approve);
  await screen.findByText('Journal posted.');
  expect(post).toHaveBeenCalledWith(
    '/tenant/finance/foundation/operating-postings/' + id + '/approve',
    {
      scope: { legalEntityId: scope.legalEntityId, bookId: scope.bookId },
      subjectHash: hash,
      reason: 'Verified source receipt',
    },
  );
});
