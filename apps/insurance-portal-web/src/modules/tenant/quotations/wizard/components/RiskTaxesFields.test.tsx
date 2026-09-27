import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { setPricingFormValue } from '../utils/pricingFormUpdates';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form } from '@/components/ui/form';
import {
  createEmptyRiskRow,
  createEmptyRiskTaxRow,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { RiskTaxesFields } from './RiskTaxesFields';

vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ company: { id: 'company' } }),
}));
const catalogue = [
  {
    id: 'vat',
    tax_code: 'VAT-MAINLAND',
    tax_name: 'VAT',
    tax_rate: '0.18',
    is_active: true,
    is_default: true,
  },
  {
    id: 'wht',
    tax_code: 'WITHHOLDING',
    tax_name: 'Withholding',
    tax_rate: '0.10',
    is_active: true,
    is_default: false,
  },
];
vi.mock('@/modules/tenant/taxes/api', () => ({
  taxesApi: { active: vi.fn() },
}));
afterEach(cleanup);

function Harness({
  fleet = false,
  empty = false,
  onReady,
}: {
  fleet?: boolean;
  empty?: boolean;
  onReady?: (form: UseFormReturn<QuotationFormSchemaValues>) => void;
}) {
  const risk = {
    ...createEmptyRiskRow(),
    premium_before_discount: '100000',
    premium_after_discount: '100000',
    premium_excluding_tax_equivalent: '100000',
    premium_including_tax: '128000',
    taxes_charged: empty
      ? []
      : catalogue.map((tax) => ({
          ...createEmptyRiskTaxRow(),
          tax_code: tax.tax_code,
          tax_rate: tax.tax_rate,
          tax_amount: '',
        })),
  };
  const form = useForm<QuotationFormSchemaValues>({
    defaultValues: {
      risks: [risk],
      fleet: { items: [{ risks_covered: [risk] }] },
    },
  });
  useEffect(() => {
    onReady?.(form);
  }, [form, onReady]);
  const riskPath = fleet ? 'fleet.items.0.risks_covered.0' : 'risks.0';
  const value = useWatch({ control: form.control, name: riskPath });
  return (
    <Form {...form}>
      <RiskTaxesFields form={form} riskPath={riskPath} />
      <output data-testid="risk">{JSON.stringify(value)}</output>
    </Form>
  );
}
function setup(props: { fleet?: boolean; empty?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['taxes', 'company', 'active'], catalogue);
  let currentForm: UseFormReturn<QuotationFormSchemaValues>;
  render(
    <QueryClientProvider client={client}>
      <Harness
        {...props}
        onReady={(form) => {
          currentForm = form;
        }}
      />
    </QueryClientProvider>,
  );
  return Object.assign(
    () => JSON.parse(screen.getByTestId('risk').textContent ?? '{}'),
    {
      applyCalculation: () => {
        const name = props.fleet
          ? 'fleet.items.0.risks_covered.0.taxes_charged'
          : 'risks.0.taxes_charged';
        setPricingFormValue(
          currentForm,
          name,
          currentForm
            .getValues(name)
            .map((row) => ({ ...row, tax_amount: '123' })),
        );
      },
    },
  );
}

describe('Multiple tax selection', () => {
  it.each([false, true])(
    'keeps saved selections and recalculates after removal (fleet=%s)',
    async (fleet) => {
      const read = setup({ fleet });
      await waitFor(() => expect(read().premium_including_tax).toBe('128000'));
      expect(
        screen.getAllByRole('button', { name: /Remove tax/ }),
      ).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'Remove tax 2' }));
      await waitFor(() => expect(read().premium_including_tax).toBe('118000'));
      expect(
        read().taxes_charged.map((tax: { tax_code: string }) => tax.tax_code),
      ).toEqual(['VAT-MAINLAND']);
      fireEvent.click(screen.getByRole('button', { name: 'Add tax' }));
      await waitFor(() => expect(read().taxes_charged).toHaveLength(2));
      expect(read().taxes_charged[1].tax_code).toBe('');
      expect(read().premium_including_tax).toBe('118000');
    },
  );
  it('keeps the tax dropdown open while a calculation updates its row', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const read = setup();
    await waitFor(() => expect(read().premium_including_tax).toBe('128000'));
    const trigger = screen.getAllByRole('combobox')[0];
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await screen.findByRole('listbox');
    act(() => read.applyCalculation());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(trigger).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    await waitFor(() => expect(read().taxes_charged[0].tax_code).toBe(''));
  });

  it('selects the configured default tax automatically', async () => {
    const read = setup({ empty: true });
    await waitFor(() => expect(read().premium_including_tax).toBe('118000'));
    expect(read().taxes_charged[0].tax_code).toBe('VAT-MAINLAND');
    fireEvent.click(screen.getByRole('button', { name: 'Add tax' }));
    await waitFor(() => expect(read().taxes_charged).toHaveLength(2));
    expect(read().taxes_charged[1].tax_code).toBe('');
    expect(read().premium_including_tax).toBe('118000');
  });
});
