import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { financeTableApi } from '@/modules/tenant/finance/api';
import { coverNotesApi } from '@/modules/tenant/cover-notes/api';
import type { CoverNoteRecord } from '@/modules/tenant/cover-notes/types';
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
vi.mock('@/modules/tenant/cover-notes/api', () => ({
  coverNotesApi: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/modules/tenant/cover-notes/components/CoverNotesSection', () => ({
  CoverNotesSection: () => <p>Cover note actions</p>,
}));

function renderPage(line?: 'fleet') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/quotations/quotation-1']}>
        <Routes>
          <Route
            path="/quotations/:id"
            element={<QuotationDetailPage line={line} />}
          />
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
  it('gives fleet vehicles their own tab with TIRA sticker and cover note references', async () => {
    const preview = quotationDetailFixture('MOTOR_FLEET');
    const [vehicle] = fleetVehicles([1]);
    preview.fleet!.vehicles = [
      {
        ...vehicle,
        motor_details: {
          ...vehicle.motor_details,
          registration_number: 'T777FLT',
        },
        tiramis: {
          ...vehicle.tiramis!,
          source: 'vehicle',
          sticker_number: 'STK-0001',
          cover_note_reference_number: 'CNR-0001',
        },
      },
    ];
    state.preview = preview;
    renderPage('fleet');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Vehicles (1)',
      'Payments',
      'TIRAMIS',
      'History',
    ]);
    expect(screen.queryByText('T777FLT')).not.toBeInTheDocument();
    selectTab('Vehicles (1)');
    expect((await screen.findAllByText('T777FLT')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('STK-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CNR-0001').length).toBeGreaterThan(0);
  });
  it('shows the chassis number for a fleet vehicle without a registration', () => {
    const preview = quotationDetailFixture('MOTOR_FLEET');
    const [vehicle] = fleetVehicles([1]);
    preview.fleet!.vehicles = [
      {
        ...vehicle,
        motor_details: {
          ...vehicle.motor_details,
          registration_number: null,
          chassis_number: 'CHS-UNREG-001',
        },
      },
    ];
    state.preview = preview;
    renderPage('fleet');
    selectTab('Vehicles (1)');
    expect(screen.getAllByText('CHS-UNREG-001').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'View vehicle CHS-UNREG-001' })
        .length,
    ).toBeGreaterThan(0);
  });
  it('links each issued cover note to its own fleet vehicle', async () => {
    const preview = quotationDetailFixture('MOTOR_FLEET');
    preview.fleet!.vehicles = fleetVehicles([1, 2]);
    state.preview = preview;
    const note = (
      entry: number,
      status: string,
      suffix: string,
    ): CoverNoteRecord => ({
      id: `cn-${entry}-${suffix}`,
      quotation_id: preview.overview.quotation_id,
      policy_id: null,
      cover_note_number: `AICL-${entry}-${suffix}`,
      cover_note_reference_number: `REF-${entry}-${suffix}`,
      sticker_number: `STK-${entry}-${suffix}`,
      entry_type: 'FLEET_ITEM',
      fleet_entry: entry,
      status,
      regulatory_sync_status: 'SYNCED',
      start_date: '2026-11-02',
      end_date: '2027-11-01',
      currency_code: 'TZS',
      sum_insured: '0',
      premium_including_tax: '23600',
      issued_at: '2026-11-02T10:00:00Z',
      expires_at: null,
    });
    vi.mocked(coverNotesApi.list).mockResolvedValue([
      note(2, 'CANCELLED', 'old'),
      note(2, 'ISSUED', 'live'),
      note(1, 'ISSUED', 'live'),
    ]);
    useAuthStore.setState({
      hasPermission: (permission) => permission === 'cover-notes:read',
    });
    renderPage('fleet');
    selectTab('Vehicles (2)');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search vehicles' }), {
      target: { value: 'STK-2-live' },
    });
    expect((await screen.findAllByText('REF-2-live')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('AICL-2-live').length).toBeGreaterThan(0);
    expect(screen.getAllByText('T002AAA').length).toBeGreaterThan(0);
    expect(screen.queryByText('T001AAA')).toBeNull();
    expect(screen.queryByText('STK-2-old')).toBeNull();
    expect(coverNotesApi.list).toHaveBeenCalledWith({
      quotation_id: preview.overview.quotation_id,
    });
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
          ? ['Fleet overview', 'Cover and terms', 'Record details']
          : ['Quotation Information', 'Cover and Insurance Details'];
      sectionHeadings.forEach((name) =>
        expect(screen.getByRole('heading', { name })).toBeInTheDocument(),
      );
      // Fleet shows its premium make-up under the total payable instead.
      if (flow !== 'MOTOR_FLEET')
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
    expect(
      screen.queryByRole('heading', {
        name: 'Submission and Synchronization History',
      }),
    ).not.toBeInTheDocument();
    selectTab('Quotation History');
    expect(screen.getByText('Quotation created')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Submission and Synchronization History',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Acknowledgement received').length,
    ).toBeGreaterThan(0);
  });
  it('opens the existing TIRAMIS tab from a fleet submission warning', () => {
    const preview = quotationDetailFixture('MOTOR_FLEET');
    preview.fleet!.summary.failed_entries = 1;
    state.preview = preview;
    renderPage('fleet');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Vehicles (0)',
      'Payments',
      'TIRAMIS',
      'History',
    ]);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'View vehicle submission status in TIRAMIS',
      }),
    );
    expect(screen.getByRole('tab', { name: 'TIRAMIS' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Cover note actions')).toBeInTheDocument();
    expect(financeTableApi.payments).not.toHaveBeenCalled();
  });
  it('keeps fleet vehicle detail and risk actions accessible after searching', () => {
    const preview = quotationDetailFixture('MOTOR_FLEET');
    preview.fleet!.vehicles = fleetVehicles([1, 2]);
    state.preview = preview;
    useAuthStore.setState({
      hasPermission: (permission) => permission === 'pricing.request_override',
    });
    renderPage('fleet');
    selectTab('Vehicles (2)');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search vehicles' }), {
      target: { value: 'T002AAA' },
    });
    expect(screen.queryByText('T001AAA')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'View vehicle T002AAA' }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Fleet vehicle cover');
    expect(screen.getByRole('dialog')).toHaveTextContent('Vehicle Risk');
    expect(
      screen.getByRole('button', { name: 'Request Override' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'CHASSIS-LONG-12345678901234567890',
    );
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

function fleetVehicles(entries: number[]) {
  const single = quotationDetailFixture('MOTOR_SINGLE');
  return entries.map((entry) => ({
    fleet_entry_number: entry,
    cover_note_number: null,
    previous_cover_note_reference_number: null,
    cover_note_description: 'Fleet vehicle cover',
    operative_clause: 'Fleet operative clause',
    endorsement_type: null,
    endorsement_reason: null,
    endorsement_premium_earned: null,
    risks: [
      {
        risk_id: 'risk-' + entry,
        risk_number: 1,
        risk_code: 'COMP',
        risk_name: 'Comprehensive',
        sum_insured: 20000000,
        sum_insured_equivalent: 20000000,
        premium_rate: 0.05,
        premium_before_discount: 1000000,
        premium_after_discount: 1000000,
        premium_excluding_tax_equivalent: 1000000,
        premium_including_tax: 1180000,
        discounts: [],
        premium_overrides: [],
        taxes: [],
      },
    ],
    subject_matters: [],
    addons: [],
    motor_details: {
      ...single.motor_details!,
      registration_number: 'T00' + entry + 'AAA',
    },
    tiramis: single.tiramis,
  }));
}
