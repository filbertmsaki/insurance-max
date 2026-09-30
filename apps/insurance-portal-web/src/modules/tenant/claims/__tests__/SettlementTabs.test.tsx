import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { claimsApi } from '../api';
import { PaymentsTab } from '../pages/detail/PaymentsTab';
import { VoucherTab } from '../pages/detail/VoucherTab';
import type { ClaimDetail } from '../types';

vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (
    select: (state: { hasPermission: () => boolean }) => unknown,
  ) => select({ hasPermission: () => true }),
}));

vi.mock('../api', () => ({
  claimsApi: {
    createVoucher: vi.fn(),
    respondToVoucher: vi.fn(),
    requestDisbursement: vi.fn(),
    confirmDisbursement: vi.fn(),
  },
}));

const api = vi.mocked(claimsApi);

function claim(overrides: Partial<ClaimDetail>): ClaimDetail {
  return {
    id: 'claim-1',
    claim_no: 'CLM-2026-00001',
    claim_reference_number: 'TIRA-CLM-1',
    status: 'APPROVED',
    currency_code: 'TZS',
    approved_amount: '900000.00',
    paid_amount: '0.00',
    claimants: [
      {
        id: 'c-1',
        claimant_type: 'POLICYHOLDER',
        full_name: 'Asha Juma',
        is_primary: true,
        status: 'ACTIVE',
      },
    ],
    discharge_vouchers: [],
    payments: [],
    disbursements: [],
    approvals: [],
    regulatory_operations: [],
    allowed_actions: [],
    user_names: {},
    ...overrides,
  } as ClaimDetail;
}

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('VoucherTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses an offer above the outstanding approved amount', async () => {
    render(
      wrap(
        <VoucherTab claim={claim({ allowed_actions: ['create_discharge'] })} />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /Prepare voucher/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Offer amount/), {
      target: { value: '950000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    expect(
      await within(dialog).findByText(
        /exceeds the outstanding approved amount/,
      ),
    ).toBeInTheDocument();
    expect(api.createVoucher).not.toHaveBeenCalled();
  });

  it('records the claimant accepting an issued voucher', async () => {
    api.respondToVoucher.mockResolvedValue({});
    render(
      wrap(
        <VoucherTab
          claim={claim({
            status: 'DISCHARGE_ISSUED',
            discharge_vouchers: [
              {
                id: 'v-1',
                discharge_voucher_number: 'DV-2026-00001',
                version: 1,
                status: 'SENT_TO_CLAIMANT',
                claim_offer_amount: '850000',
              },
            ],
          })}
        />,
      ),
    );

    expect(
      screen.getByText(/the response reports the voucher to\s+TIRA/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Record claimant response/ }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Record response' }),
    );

    await waitFor(() =>
      expect(api.respondToVoucher).toHaveBeenCalledWith(
        'v-1',
        expect.objectContaining({ response: 'ACCEPT' }),
      ),
    );
  });
});

describe('PaymentsTab', () => {
  beforeEach(() => vi.clearAllMocks());

  const accepted = {
    id: 'v-1',
    discharge_voucher_number: 'DV-2026-00001',
    version: 1,
    status: 'ACCEPTED',
    claim_offer_amount: '850000',
  };

  it('requests a disbursement with a stable key per attempt', async () => {
    api.requestDisbursement.mockResolvedValue({} as never);
    render(
      wrap(
        <PaymentsTab
          claim={claim({
            status: 'PAYMENT_PENDING',
            discharge_vouchers: [accepted],
            payments: [
              {
                id: 'p-1',
                claim_payment_number: 'CP-2026-00001',
                status: 'APPROVED',
                paid_amount: '850000',
                payment_mode: 3,
              },
            ],
            disbursements: [
              {
                id: 'd-0',
                claim_payment_id: 'p-1',
                disbursement_no: 'DSB-1',
                status: 'FAILED',
                amount: '850000',
                currency_code: 'TZS',
                failure_message: 'Account closed',
              },
            ],
          })}
        />,
      ),
    );

    expect(screen.getByText(/Account closed/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Request disbursement/ }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request' }));

    await waitFor(() =>
      expect(api.requestDisbursement).toHaveBeenCalledWith(
        'p-1',
        'claim-payment:p-1:2',
      ),
    );
  });

  it('confirms a requested disbursement', async () => {
    api.confirmDisbursement.mockResolvedValue({} as never);
    render(
      wrap(
        <PaymentsTab
          claim={claim({
            status: 'PAYMENT_PENDING',
            discharge_vouchers: [accepted],
            payments: [
              {
                id: 'p-1',
                claim_payment_number: 'CP-2026-00001',
                status: 'PROCESSING',
                paid_amount: '850000',
                payment_mode: 3,
                finance_disbursement_id: 'd-1',
              },
            ],
            disbursements: [
              {
                id: 'd-1',
                claim_payment_id: 'p-1',
                disbursement_no: 'DSB-2',
                status: 'REQUESTED',
                amount: '850000',
                currency_code: 'TZS',
              },
            ],
          })}
        />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirm paid/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(
      within(dialog).getByLabelText(/Bank \/ provider reference/),
      {
        target: { value: 'FT26273XYZ' },
      },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirm paid' }),
    );

    await waitFor(() =>
      expect(api.confirmDisbursement).toHaveBeenCalledWith('d-1', {
        payment_method: 'EFT / bank transfer',
        provider_reference: 'FT26273XYZ',
      }),
    );
  });

  it('explains that settlement waits for TIRA', () => {
    render(
      wrap(
        <PaymentsTab
          claim={claim({ status: 'PAID', discharge_vouchers: [accepted] })}
        />,
      ),
    );
    expect(
      screen.getByText('Fully paid, waiting for TIRA'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New payment/ })).toBeNull();
  });
});
