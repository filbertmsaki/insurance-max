import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageFooterProvider } from '@/components/layout/PageFooterSlot';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { MotorQuotationWizardPage } from '../motor/MotorQuotationWizardPage';

// Query results are referentially stable between renders, as React Query's
// are; fresh arrays on every render would make effects re-run forever.
const reference = vi.hoisted(() => ({
  categories: { data: [{ id: 'category-1', name: 'Motor' }] },
  products: {
    data: [
      {
        id: 'product-1',
        product_name: 'Motor Private',
        category_id: 'category-1',
      },
      {
        id: 'product-2',
        product_name: 'Motor Commercial',
        category_id: 'category-1',
      },
    ],
  },
  empty: { data: [] as never[] },
  none: [] as never[],
}));

// Reference data the page loads up front.
vi.mock('@/modules/tenant/quotations/hooks', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/modules/tenant/quotations/hooks')
  >()),
  useQuotationCategories: () => reference.categories,
  useQuotationProducts: () => reference.products,
  useQuotationRisks: () => reference.empty,
  useQuotationVehicles: vi.fn(() => reference.empty),
  useIntermediaryCompanyOptions: () => reference.none,
}));
vi.mock('@/modules/platform/reference-data/hooks', () => ({
  useReferenceCurrencies: () => reference.empty,
}));
vi.mock(
  '@/modules/platform/reference-data/components/LocationReferenceSelects',
  () => ({ LocationReferenceSelects: () => null }),
);
vi.mock('@/modules/tenant/taxes/api', () => ({
  taxesApi: {
    active: vi.fn().mockResolvedValue([
      {
        id: 'tax-1',
        tax_code: 'VAT-MAINLAND',
        tax_name: 'VAT',
        tax_rate: '0.18',
        is_default: true,
      },
    ]),
  },
}));
vi.mock(
  '@/modules/tenant/quotations/wizard/hooks/useProductAddonDefinitions',
  () => ({ useProductAddonDefinitions: () => reference.empty }),
);
vi.mock('@/modules/tenant/customers/api', () => ({
  customersApi: {
    getCustomers: vi.fn(),
    searchCustomers: vi.fn(),
    getCustomer: vi.fn(),
    createCustomer: vi.fn(),
  },
}));
vi.mock('@/modules/tenant/motor/api', () => ({
  motorApi: {
    searchVehicles: vi.fn(),
    getVehicle: vi.fn(),
    getVehicles: vi.fn(),
  },
}));
vi.mock('@/modules/tenant/non-motor/hooks', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/modules/tenant/non-motor/hooks')
  >()),
  useSubjectMatterOptions: vi.fn(() => reference.empty),
}));

import { customersApi } from '@/modules/tenant/customers/api';
import { useQuotationVehicles } from '@/modules/tenant/quotations/hooks';
import { useSubjectMatterOptions } from '@/modules/tenant/non-motor/hooks';

/** Mirrors AppShell: the page comes through <Outlet />, the footer beside it. */
function Layout() {
  return (
    <PageFooterProvider>
      {(footer) => (
        <>
          <main>
            <Outlet />
          </main>
          {footer}
        </>
      )}
    </PageFooterProvider>
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/underwrite/motor/quotations/new']}>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/underwrite/motor/quotations/new"
              element={<MotorQuotationWizardPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  useAuthStore.setState({
    user: {
      id: 'user-1',
      companyId: 'company-1',
      roles: ['USER'],
      permissions: ['customers:create'],
      scope: 'company',
      defaultSalePointCode: 'SP-001',
    },
    company: { id: 'company-1' },
    authorizationContext: null,
  } as never);
});

describe('MotorQuotationWizardPage', () => {
  it('shows customer, vehicle, cover and premium on one step before review', async () => {
    renderPage();

    expect(await screen.findByText('Quote details')).toBeInTheDocument();
    expect(screen.getByText('Review & submit')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Policyholder' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vehicle' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Cover' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Premium' })).toBeNull();
    // Search fields replace the customer list and the TIRA form selects.
    expect(screen.getByRole('combobox', { name: /customer/i })).toBeVisible();
    expect(screen.getByRole('combobox', { name: /vehicle/i })).toBeVisible();
    expect(screen.queryByText('Search by')).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: /payment method/i }),
    ).toBeNull();
    // Direct-only users get no channel inputs; no add-ons are configured.
    expect(screen.queryByText('Insurance channel')).toBeNull();
    expect(screen.queryByText('Optional covers')).toBeNull();

    // No bulk customer, vehicle or subject-matter lists are loaded.
    expect(customersApi.getCustomers).not.toHaveBeenCalled();
    expect(useQuotationVehicles).toHaveBeenLastCalledWith(undefined);
    expect(useSubjectMatterOptions).toHaveBeenLastCalledWith(false);
  });

  it('stays on the first step and flags what is missing', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Select an existing policyholder'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Find the vehicle or enter its details.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /vehicle/i })).toBeVisible();
    expect(customersApi.createCustomer).not.toHaveBeenCalled();
  });
});
