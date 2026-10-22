import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PageFooterProvider } from '@/components/layout/PageFooterSlot';
import { claimsApi } from '../api';
import { ClaimWizardPage } from '../wizard/ClaimWizardPage';

// The policy search waits 350 ms before querying; on a loaded machine the
// default 1 s findBy* window is too tight for search + render.
configure({ asyncUtilTimeout: 5000 });

vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (
    select: (state: { hasPermission: () => boolean }) => unknown,
  ) => select({ hasPermission: () => true }),
}));

vi.mock('../api', () => ({
  claimsApi: {
    policyLookup: vi.fn(),
    policyDetail: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    submitNotification: vi.fn(),
    retryNotification: vi.fn(),
  },
}));

const api = vi.mocked(claimsApi);

const policy = {
  id: 'policy-1',
  policy_no: 'POL-2026-00012',
  cover_note_no: 'CN-1',
  policy_reference_number: null,
  policy_status: 'ACTIVE',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  currency: 'TZS',
  business_line: 'MOTOR' as const,
  customer_name: 'Asha Juma',
};

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/apps/claims/new']}>
        <PageFooterProvider>
          {(footer) => (
            <>
              <Routes>
                <Route path="/apps/claims/new" element={<ClaimWizardPage />} />
                <Route
                  path="/apps/claims/:id"
                  element={<p>Claim detail page</p>}
                />
              </Routes>
              <footer data-testid="footer">{footer}</footer>
            </>
          )}
        </PageFooterProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const footerButton = (name: string) =>
  within(screen.getByTestId('footer')).getByRole('button', { name });

describe('ClaimWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.policyLookup.mockResolvedValue([policy]);
    api.policyDetail.mockResolvedValue({
      ...policy,
      sum_insured: '25000000',
      total_premium: '900000',
      product_id: null,
      category_id: null,
      branch_id: null,
      open_claims: 0,
      customer: {
        id: 'customer-1',
        customer_no: 'CUS-1',
        name: 'Asha Juma',
        customer_type: 'INDIVIDUAL',
        phone: null,
        email: null,
        region: null,
        district: null,
      },
      risks: [
        {
          id: 'risk-1',
          risk_name: 'Motor comprehensive',
          risk_code: 'MC',
          sum_insured: '25000000',
          status: 'ACTIVE',
          subject_matter: null,
          vehicle: {
            id: 'vehicle-1',
            registration_no: 'T123ABC',
            chassis_no: 'CH-1',
            make: 'Toyota',
            model: 'IST',
            body_type: null,
            manufacture_year: 2015,
            usage_type: null,
            vehicle_value: null,
          },
          cover_note_reference_number: 'TIRA-CN-1',
        },
      ],
    });
    api.create.mockResolvedValue({
      id: 'claim-1',
      claim_no: 'CLM-2026-00001',
      status: 'DRAFT',
    } as never);
  });

  it('registers a claim against the looked-up policy and its single risk', async () => {
    renderWizard();

    fireEvent.change(screen.getByLabelText('Search policies'), {
      target: { value: 'T123' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    await screen.findByText('Selected policy');
    await waitFor(() =>
      expect(api.policyDetail).toHaveBeenCalledWith('policy-1'),
    );

    fireEvent.click(footerButton('Next'));
    // The only risk is preselected, so the risk step passes straight away.
    expect(
      await screen.findByText(/T123ABC · Toyota · IST/),
    ).toBeInTheDocument();
    fireEvent.click(footerButton('Next'));

    fireEvent.change(await screen.findByLabelText(/Date and time of loss/), {
      target: { value: '2026-09-01T08:30' },
    });
    fireEvent.change(screen.getByLabelText(/Location of loss/), {
      target: { value: 'Morogoro Road' },
    });
    fireEvent.change(screen.getByLabelText(/Nature of loss/), {
      target: { value: 'Collision' },
    });
    fireEvent.change(screen.getByLabelText(/Type of loss/), {
      target: { value: 'Own damage' },
    });
    fireEvent.change(screen.getByLabelText(/^Description/), {
      target: { value: 'Rear-ended at the lights.' },
    });
    fireEvent.click(footerButton('Next'));

    // The policyholder was added as the primary claimant.
    expect(await screen.findByText('Policyholder record')).toBeInTheDocument();
    fireEvent.click(footerButton('Next'));

    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));

    await screen.findByText('Claim detail page');
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        policy_id: 'policy-1',
        policy_risk_id: 'risk-1',
        loss_nature: 'Collision',
        loss_location: 'Morogoro Road',
        claimants: [
          expect.objectContaining({
            claimant_type: 'POLICYHOLDER',
            uses_policyholder: true,
            is_primary: true,
          }),
        ],
      }),
    );
    expect(api.submitNotification).not.toHaveBeenCalled();
  });

  it('keeps the user on the incident step until the TIRA loss fields are filled', async () => {
    renderWizard();

    fireEvent.change(screen.getByLabelText('Search policies'), {
      target: { value: 'POL' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    await waitFor(() => expect(api.policyDetail).toHaveBeenCalled());
    fireEvent.click(footerButton('Next'));
    await screen.findByText(/T123ABC/);
    fireEvent.click(footerButton('Next'));
    await screen.findByLabelText(/Date and time of loss/);

    fireEvent.click(footerButton('Next'));

    expect(
      await screen.findByText('Enter the nature of loss'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enter the date and time of loss'),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
});
