import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Form } from '@/components/ui/form';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { customersApi } from '@/modules/tenant/customers/api';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import { defaultValuesForLine } from '@/modules/tenant/underwrite/wizard/defaults';
import {
  createQuotationFormSchema,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { PolicyholderStep } from './PolicyholderStep';

vi.mock('@/modules/tenant/customers/api', () => ({
  customersApi: {
    searchCustomers: vi.fn(),
    getCustomer: vi.fn(),
    createCustomer: vi.fn(),
  },
}));
// Reference-data lookups are irrelevant here.
vi.mock(
  '@/modules/platform/reference-data/components/LocationReferenceSelects',
  () => ({ LocationReferenceSelects: () => null }),
);

const customer = {
  id: 'customer-1',
  customer_no: 'CUST-2026-000001',
  customer_type: 'INDIVIDUAL',
  first_name: 'John',
  middle_name: null,
  last_name: 'Mwita',
  company_name: null,
  phone: '0712345678',
  id_type: 1,
  id_number: '19900101123450000112',
  date_of_birth: '1990-01-01',
  gender: 'M',
  country_code: 'TZA',
  region: 'Dar es Salaam',
  district: null,
  street: 'Samora Ave',
  status: 'ACTIVE',
} as unknown as CustomerRecord;

function renderStep() {
  function Harness() {
    const form = useForm<QuotationFormSchemaValues>({
      resolver: zodResolver(
        createQuotationFormSchema() as unknown as Parameters<
          typeof zodResolver
        >[0],
      ) as unknown as Resolver<QuotationFormSchemaValues>,
      defaultValues: defaultValuesForLine(
        getUnderwriteLineMeta(UnderwriteLine.MOTOR),
      ),
    });
    const customerId = useWatch({ control: form.control, name: 'customer_id' });
    return (
      <Form {...form}>
        <form>
          <PolicyholderStep
            form={form}
            customerOptions={[]}
            newCustomerInDialog
          />
        </form>
        <button
          type="button"
          data-testid="fill"
          onClick={() =>
            form.setValue('policyholder', {
              ...form.getValues('policyholder'),
              policy_holder_type: 1,
              policy_holder_name: 'Amina Hassan',
              gender: 'F',
              policy_holder_birth_date: '1992-05-05',
              policy_holder_id_type: 1,
              policy_holder_id_number: '19920505123450000111',
              policy_holder_phone_number: '0754000111',
              country_code: 'TZA',
              region: 'Arusha',
              district: 'Arusha',
              street: 'Sokoine Rd',
            })
          }
        />
        <output data-testid="customer-id">{customerId}</output>
      </Form>
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: { id: 'user-1', roles: ['USER'], permissions, scope: 'company' },
    authorizationContext: null,
  } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('PolicyholderStep customer selection', () => {
  it('searches customers on the server and loads the chosen record', async () => {
    signIn([]);
    vi.mocked(customersApi.searchCustomers).mockResolvedValue({
      data: [
        {
          id: 'customer-1',
          customer_no: 'CUST-2026-000001',
          customer_type: 'INDIVIDUAL',
          policy_holder_type: 1,
          name: 'John Mwita',
          phone: '0712345678',
          id_type: 1,
          id_number_masked: '****************0112',
          status: 'ACTIVE',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    vi.mocked(customersApi.getCustomer).mockResolvedValue(customer);
    renderStep();

    fireEvent.click(screen.getByRole('combobox', { name: /customer/i }));
    fireEvent.change(
      await screen.findByPlaceholderText('Name, phone, ID or customer number'),
      { target: { value: '0712 345' } },
    );
    const option = await screen.findByRole('option', { name: /John Mwita/ });
    expect(option).toHaveTextContent('NIN ****************0112');
    fireEvent.click(option);

    expect(customersApi.searchCustomers).toHaveBeenCalledWith(
      { q: '0712 345', limit: 20 },
      expect.anything(),
    );
    expect(
      await screen.findByText('CUST-2026-000001 · Individual'),
    ).toBeVisible();
    expect(screen.getByTestId('customer-id')).toHaveTextContent('customer-1');
    // The record lacks a district, which TIRA needs.
    expect(screen.getByText('Missing for TIRA: district')).toBeVisible();
  });

  it('saves a new customer straight away and selects it', async () => {
    signIn(['customers:create']);
    vi.mocked(customersApi.createCustomer).mockResolvedValue({
      ...customer,
      id: 'customer-new',
      first_name: 'Amina',
      last_name: 'Hassan',
      district: 'Arusha',
    } as CustomerRecord);
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: /new customer/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('New customer');
    fireEvent.click(screen.getByTestId('fill'));
    fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));

    await waitFor(() =>
      expect(screen.getByTestId('customer-id')).toHaveTextContent(
        'customer-new',
      ),
    );
    expect(customersApi.createCustomer).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(customersApi.createCustomer).mock.calls[0][0],
    ).toMatchObject({
      policy_holder_phone_number: '0754000111',
      policy_holder_id_number: '19920505123450000111',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the details on the quotation when the user cannot create customers', async () => {
    signIn([]);
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: /new customer/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByTestId('fill'));
    fireEvent.click(screen.getByRole('button', { name: 'Use these details' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(customersApi.createCustomer).not.toHaveBeenCalled();
    expect(screen.getByText('Amina Hassan')).toBeVisible();
  });
});
