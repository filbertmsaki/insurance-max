import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/modules/shared/api/client';
import { useConnectivityStore } from '@/modules/shared/connectivity/store/connectivity.store';
import { BuyCoverPage, InsurancePage } from './PublicWebsite';
import { isPublicWebsitePath } from './public-routes';

vi.mock('@/modules/shared/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

const options = {
  companies: [
    {
      id: 'insurer',
      name: 'Available insurer',
      products: [
        {
          id: 'motor',
          name: 'Motor cover',
          risks: [{ id: 'risk', name: 'Third party' }],
        },
      ],
    },
  ],
};

function show(page: React.ReactNode) {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {page}
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
  useConnectivityStore.getState().setStatus('online');
});

describe('public catalogue and purchase', () => {
  it('reviews the premium, allows editing and preserves confirmed submission payloads', async () => {
    const vehicle = {
      registration_number: 'T123ABC',
      chassis_number: 'CHASSIS123456',
      make: 'Toyota',
      model: 'Corolla',
      body_type: 'Saloon',
      color: 'White',
      engine_number: 'EN1234',
      engine_capacity: '1500',
      fuel_used: 'Petrol',
      year_of_manufacture: 2020,
      tare_weight: 1200,
      gross_weight: 1600,
    };
    const quote = {
      company: { id: 'insurer', name: 'Available insurer' },
      product: { id: 'motor' },
      risk: { id: 'risk', name: 'Third party' },
      default_branch: { name: 'Dar es Salaam' },
      cover_period: { start_date: '2026-10-19', end_date: '2027-10-19' },
      premium: {
        pricing_quote_id: 'QUOTE-TEST',
        basic_premium: 100000,
        discount_amount: 0,
        charges_amount: 5000,
        vat_amount: 18900,
        total_amount_payable: 123900,
      },
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: options });
    vi.mocked(apiClient.post).mockImplementation(async (url) => ({
      data: url.endsWith('/verify')
        ? { status: 'NO_ACTIVE_COVER', vehicle }
        : url.endsWith('/quote')
          ? quote
          : { quotation_no: 'REQUEST-TEST' },
    }));
    show(<BuyCoverPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Check vehicle' }),
      ).toBeEnabled(),
    );
    for (const [label, value] of [
      ['Full name', 'Amina Juma'],
      ['Vehicle registration number', 'T123ABC'],
      ['Phone number', '+255712345678'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Check vehicle' }));
    await screen.findByRole('heading', {
      name: 'Confirm details and choose cover',
    });
    for (const [label, value] of [
      ['Date of birth', '1990-01-01'],
      ['ID number', 'NIN123456'],
      ['Gender', 'F'],
      ['Region', 'Dar es Salaam'],
      ['District', 'Kinondoni'],
      ['Vehicle value (TZS)', '20000000'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate quote' }));
    await screen.findByText('QUOTE-TEST');
    expect(
      screen.queryByRole('button', { name: 'Calculate quote' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit insurance request' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit details and cover' }),
    );
    expect(screen.getByLabelText('Vehicle value (TZS)')).toHaveValue(
      '20000000',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Calculate quote' }));
    await screen.findByText('QUOTE-TEST');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit insurance request' }),
    );
    expect(await screen.findByText('REQUEST-TEST')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenLastCalledWith(
      '/public/motor-purchase/submit',
      expect.objectContaining({
        company_id: 'insurer',
        product_id: 'motor',
        risk_id: 'risk',
        sum_insured: 20000000,
        confirmed: true,
        idempotency_key: 'T123ABC-QUOTE-TEST',
        policy_holder: expect.objectContaining({
          policy_holder_phone_number: '+255712345678',
          gender: 'F',
        }),
      }),
      { skipAuthRefresh: true, suppressErrorToast: true },
    );
    expect(screen.getByText(/not proof of insurance/)).toBeInTheDocument();
  });

  it('shows all published categories and routes non-motor enquiries to contact', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: Array.from({ length: 6 }, (_, index) => ({
        id: String(index),
        name: `Category ${index}`,
        code: `C${index}`,
        business_line: 'NON_MOTOR',
        products: [
          {
            id: `p${index}`,
            name: `Product ${index}`,
            business_line: 'NON_MOTOR',
            company: { name: 'Available insurer' },
          },
        ],
      })),
    });
    show(<InsurancePage />);
    const category = await screen.findByRole('button', { name: /Category 5/ });
    fireEvent.click(category);
    expect(
      await screen.findByRole('heading', { name: 'Product 5' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Enquire about cover/ }),
    ).toHaveAttribute('href', '/contact');
    expect(category).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables verification and gives recovery when insurers cannot load', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Unavailable'));
    show(<BuyCoverPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'load available insurers',
    );
    expect(
      screen.getByRole('button', { name: 'Check vehicle' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('validates intake before calling vehicle verification', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: options });
    show(<BuyCoverPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Check vehicle' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check vehicle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('full name');
    expect(screen.getByLabelText('Full name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Amina' },
    });
    expect(screen.getByLabelText('Full name')).toHaveValue('Amina');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('preserves the verify API payload and blocks purchase for active cover', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: options });
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        status: 'ACTIVE_COVER',
        active_cover: {
          registrationNumber: 'T123ABC',
          insurerName: 'Existing insurer',
        },
      },
    });
    show(<BuyCoverPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Check vehicle' }),
      ).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Amina Juma' },
    });
    fireEvent.change(screen.getByLabelText('Vehicle registration number'), {
      target: { value: 'T123ABC' },
    });
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '+255712345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check vehicle' }));
    expect(
      await screen.findByRole('heading', { name: 'Active insurance found' }),
    ).toHaveFocus();
    expect(apiClient.post).toHaveBeenCalledWith(
      '/public/motor-purchase/verify',
      {
        company_id: 'insurer',
        full_name: 'Amina Juma',
        registration_number: 'T123ABC',
        phone: '+255712345678',
        motor_category: 1,
      },
      { skipAuthRefresh: true, suppressErrorToast: true },
    );
    expect(
      screen.queryByRole('button', { name: 'Calculate quote' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit insurance request' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Existing insurer')).toBeInTheDocument();
  });

  it('keeps information and support reachable during a connection outage', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    useConnectivityStore.getState().setStatus('offline');
    show(<InsurancePage />);
    const notice = screen.getByText(/We cannot connect to online services/);
    expect(
      within(notice).getByRole('button', { name: 'Check connection' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Insurance products' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('link', { name: 'Contact options' }).length,
    ).toBeGreaterThan(0);
  });

  it('limits non-blocking connectivity handling to public routes', () => {
    for (const path of [
      '/',
      '/insurance/',
      '/buy-cover',
      '/register',
      '/documents/verify/ABC',
      '/signatures/respond/secret',
    ])
      expect(isPublicWebsitePath(path)).toBe(true);
    for (const path of [
      '/apps/dashboard',
      '/apps/customer/policies',
      '/apps/finance/payments',
      '/apps/documents',
    ])
      expect(isPublicWebsitePath(path)).toBe(false);
  });
});
