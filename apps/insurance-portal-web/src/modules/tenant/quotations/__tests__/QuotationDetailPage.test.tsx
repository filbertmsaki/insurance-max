import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { financeTableApi } from '@/modules/tenant/finance/api';
import { QuotationDetailPage } from '../pages/QuotationDetailPage';
import { quotationDetailFixture } from './quotationDetailFixture';

const state = vi.hoisted(() => ({
  preview: null as unknown,
  commands: {} as Record<string, boolean>,
  mutate: vi.fn(),
  refetch: vi.fn(),
  isError: false,
}));
vi.mock('../hooks', () => {
  const mutation = () => ({ isPending: false, mutate: state.mutate });
  return {
    useQuotationPreview: () => ({
      data: state.preview,
      isLoading: false,
      isError: state.isError,
      refetch: state.refetch,
    }),
    useQuotationWorkflow: () => ({
      data: {
        quotationStage: 'COMPLETED',
        approval: { status: 'NOT_REQUIRED' },
        payment: { status: 'PAID' },
        submission: { status: 'NOT_READY' },
        availableCommands: state.commands,
      },
    }),
    useQuotationRealtime: () => undefined,
    useApproveQuotationPremiumOverride: mutation,
    useCancelQuotation: mutation,
    useRequestQuotationPayment: mutation,
    useRequestQuotationPremiumOverride: mutation,
    useRetryQuotationTira: mutation,
    useSyncQuotationTira: mutation,
    useSubmitQuotationForApproval: mutation,
    useSubmitQuotation: mutation,
    useRejectQuotationPremiumOverride: mutation,
    useTransitionQuotationStatus: mutation,
  };
});
vi.mock('@/modules/tenant/finance/api', () => ({
  financeTableApi: { payments: vi.fn() },
}));
vi.mock('@/modules/tenant/cover-notes/components/CoverNotesSection', () => ({
  CoverNotesSection: () => <p>Cover note actions</p>,
}));

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/quotations/quotation-1']}>
        <Routes>
          <Route path="/quotations/:id" element={<QuotationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function selectTab(name: string) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), {
    button: 0,
    ctrlKey: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.preview = quotationDetailFixture();
  state.commands = {};
  state.isError = false;
  useAuthStore.setState({ hasPermission: () => false });
  vi.mocked(financeTableApi.payments).mockResolvedValue({
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  });
});

describe('Quotation details redesign', () => {
  it('uses corporate policyholder fields when personal details do not apply', () => {
    const preview = quotationDetailFixture();
    preview.policyholders[0] = {
      ...preview.policyholders[0],
      policyholder_type: 'Corporate',
      full_name: 'Insurance Customer Ltd',
      date_of_birth: null,
      gender: null,
    };
    state.preview = preview;
    renderPage();
    expect(screen.getByText('Corporate')).toBeInTheDocument();
    expect(screen.queryByText('Date of Birth')).not.toBeInTheDocument();
    expect(screen.queryByText('Gender')).not.toBeInTheDocument();
  });
  it.each([
    ['SUBMIT_APPROVAL', 'Complete Quotation'],
    ['REQUEST_PAYMENT', 'Request Payment'],
    ['SUBMIT_TIRAMIS', 'Issue Cover'],
    ['RETRY_TIRAMIS', 'Retry Issue Cover'],
  ])('preserves the %s workflow action', (command, label) => {
    state.commands = { [command]: true };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });
  it('supports keyboard navigation between the four tabs', async () => {
    renderPage();
    const details = screen.getByRole('tab', { name: 'Quotation Details' });
    details.focus();
    fireEvent.keyDown(details, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'Payment Details & History' }),
      ).toHaveAttribute('aria-selected', 'true'),
    );
  });
  it.each(['MOTOR_SINGLE', 'NON_MOTOR', 'MOTOR_FLEET'] as const)(
    'keeps exactly four tabs and category-specific details for %s',
    (flow) => {
      state.preview = quotationDetailFixture(flow);
      renderPage();
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Quotation Details',
        'Payment Details & History',
        'TIRAMIS Information',
        'Quotation History',
      ]);
      const sectionHeadings =
        flow === 'MOTOR_FLEET'
          ? ['Fleet overview', 'Vehicles', 'Cover and terms', 'Record details']
          : ['Quotation Information', 'Cover and Insurance Details'];
      sectionHeadings.forEach((name) =>
        expect(screen.getByRole('heading', { name })).toBeInTheDocument(),
      );
      expect(
        screen.getByRole('heading', { name: 'Premium Summary' }),
      ).toBeInTheDocument();
      if (flow === 'MOTOR_SINGLE')
        expect(screen.getByText('T123ABC')).toBeInTheDocument();
      if (flow === 'NON_MOTOR') {
        expect(screen.getByText('Office building')).toBeInTheDocument();
        expect(
          screen.queryByText('Registration Number'),
        ).not.toBeInTheDocument();
      }
      if (flow === 'MOTOR_FLEET')
        expect(screen.getAllByText('Total payable').length).toBeGreaterThan(0);
      expect(financeTableApi.payments).not.toHaveBeenCalled();
    },
  );
  it('does not fetch payment transactions without permission', () => {
    renderPage();
    selectTab('Payment Details & History');
    expect(
      screen.getByText(
        'Payment transaction history requires payment viewing permission.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('PAY-2026-001')).toBeInTheDocument();
    expect(financeTableApi.payments).not.toHaveBeenCalled();
  });
  it('loads quotation-scoped transactions on first visit and retains them across tab switches', async () => {
    useAuthStore.setState({
      hasPermission: (permission) => permission === 'payments:read',
    });
    renderPage();
    expect(financeTableApi.payments).not.toHaveBeenCalled();
    selectTab('Payment Details & History');
    await waitFor(() =>
      expect(financeTableApi.payments).toHaveBeenCalledTimes(1),
    );
    expect(financeTableApi.payments).toHaveBeenCalledWith(
      expect.objectContaining({ quotation_id: 'quotation-1', page: 1 }),
      expect.anything(),
    );
    selectTab('Quotation Details');
    selectTab('Payment Details & History');
    await waitFor(() =>
      expect(
        screen.getByText(
          'No payment transactions recorded for this quotation.',
        ),
      ).toBeInTheDocument(),
    );
    expect(financeTableApi.payments).toHaveBeenCalledTimes(1);
  });
  it('preserves TIRAMIS information, cover-note actions and authentic history', () => {
    renderPage();
    selectTab('TIRAMIS Information');
    expect(screen.getByText('REQ-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Cover note actions')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgement received')).toBeInTheDocument();
    selectTab('Quotation History');
    expect(screen.getByText('Quotation created')).toBeInTheDocument();
  });
  it('keeps workflow actions gated by backend commands', () => {
    state.commands = { APPROVE: true };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Issue Cover' }),
    ).not.toBeInTheDocument();
  });
  it('offers retry when loading fails', () => {
    state.isError = true;
    state.preview = null;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });
});
