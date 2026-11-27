import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Decimal from 'decimal.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getApiErrorMessage } from '@/lib/api-error';
import { financeApi, type ManualInvoiceCustomer } from '../api';
import { amountLabel } from '../payables/ap-export';

const newLine = () => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: '1',
  price: '',
});
function lineTotal(line: ReturnType<typeof newLine>, scale: number) {
  if (
    !/^\d{1,9}$/.test(line.quantity) ||
    !/^\d{1,12}(\.\d+)?$/.test(line.price)
  )
    return null;
  const price = new Decimal(line.price);
  if (
    !price.gt(0) ||
    price.decimalPlaces() > scale ||
    Number(line.quantity) < 1
  )
    return null;
  return price.times(line.quantity);
}
export function FinanceManualInvoicePage() {
  const { user, authorizationContext } = useAuthStore();
  return (
    <ManualInvoiceForm
      key={[
        user?.companyId,
        user?.id,
        user?.companyMembershipId,
        authorizationContext?.authorizationVersion,
      ].join('/')}
    />
  );
}

function ManualInvoiceForm() {
  const { user, authorizationContext } = useAuthStore();
  const identity = [
    user?.id,
    user?.companyId,
    user?.companyMembershipId,
    authorizationContext?.authorizationVersion,
  ];
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [customer, select] = useState<ManualInvoiceCustomer>();
  const [ccy, setCurrency] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [lines, setLines] = useState(() => [newLine()]);
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const options = useQuery({
    queryKey: ['manual-invoice-options', ...identity],
    queryFn: ({ signal }) => financeApi.manualInvoiceOptions(signal),
  });
  const customers = useQuery({
    queryKey: ['manual-invoice-customers', ...identity, term],
    enabled: options.data?.ready === true && !customer && term.length >= 2,
    queryFn: ({ signal }) => financeApi.manualInvoiceCustomers(term, signal),
  });
  const book = options.data?.ready ? options.data : undefined;
  const currency = ccy || book?.currency || '';
  const scale = book?.scales[currency] ?? 2;
  const totals = lines.map((line) => lineTotal(line, scale));
  const total = totals.reduce<Decimal>(
    (sum, value) => sum.plus(value ?? 0),
    new Decimal(0),
  );
  const valid =
    !!book &&
    !!customer &&
    !!user?.companyId &&
    !!lines.length &&
    lines.every((line, i) => line.description.trim() && totals[i]);
  const canRead = user?.permissions.includes('invoices:read');
  const save = useMutation({
    retry: false,
    mutationFn: () => {
      if (!valid || !customer || !user?.companyId)
        throw Error('Select a customer and complete every line.');
      return financeApi.createManualInvoice({
        insurer_company_id: user.companyId,
        customer_id: customer.id,
        invoice_type: 'FEE',
        currency,
        payment_term_code: paymentTerm || undefined,
        items: lines.map((line, i) => ({
          item_type: 'FEE',
          item_name: line.description.trim(),
          quantity: line.quantity,
          unit_amount: line.price,
          total_amount: totals[i]!.toFixed(scale),
        })),
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });
  const update = (
    id: string,
    field: 'description' | 'quantity' | 'price',
    value: string,
  ) =>
    setLines((rows) =>
      rows.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  const selectClass =
    'block h-10 w-full rounded-md border bg-white px-3 text-sm';
  return (
    <section className="max-w-4xl space-y-4">
      <PageHeader
        title="New manual invoice"
        description="Create a draft for a fee billed by your company. Premium invoices originate from the insurance transaction."
      />
      {save.data ? (
        <div className="space-y-3 rounded-md border bg-white p-4" role="status">
          <p>
            Draft invoice <strong>{save.data.invoice_no}</strong> created.
          </p>
          {canRead && (
            <Button asChild>
              <Link to={'/apps/finance/invoices/' + save.data.id}>
                Open invoice
              </Link>
            </Button>
          )}
        </div>
      ) : options.isPending ? (
        <p role="status">Loading invoice settings…</p>
      ) : options.error ? (
        <p role="alert">{getApiErrorMessage(options.error)}</p>
      ) : !book ? (
        <div role="status">
          <p>
            Activate the primary accounting book before creating an invoice.
          </p>
          {user?.permissions.includes('finance-foundation:read') && (
            <Link to="/apps/finance/setup" className="text-primary underline">
              Accounting setup
            </Link>
          )}
        </div>
      ) : (
        <form
          className="space-y-5 rounded-lg border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !save.isPending) save.mutate();
          }}
        >
          <fieldset disabled={save.isPending} className="space-y-5">
            {customer ? (
              <div>
                <p>
                  Customer{' '}
                  <strong>
                    {customer.label} · {customer.code}
                  </strong>
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    select(undefined);
                    setSearch('');
                    setTerm('');
                  }}
                >
                  Change customer
                </Button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium">
                  Find customer
                  <Input
                    type="search"
                    placeholder="Enter at least two letters or a customer number"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {customers.error && (
                  <p role="alert">{getApiErrorMessage(customers.error)}</p>
                )}
                {term === search.trim() &&
                  term.length >= 2 &&
                  (customers.isFetching ? (
                    <p role="status">Finding customers…</p>
                  ) : customers.data?.length === 0 ? (
                    <p role="status">No matching customers.</p>
                  ) : (
                    <ul>
                      {customers.data?.map((option) => (
                        <li key={option.id}>
                          <Button
                            variant="link"
                            type="button"
                            onClick={() => select(option)}
                          >
                            {option.label} · {option.code}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Currency
                <select
                  className={selectClass}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {Object.keys(book.scales).map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label>
                Payment terms
                <select
                  className={selectClass}
                  value={paymentTerm}
                  onChange={(e) => setPaymentTerm(e.target.value)}
                >
                  <option value="">Company default</option>
                  {book.terms.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {lines.map((line, i) => (
              <fieldset
                key={line.id}
                className="grid gap-2 border-t pt-2 sm:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <legend className="text-sm font-semibold">
                  Invoice line {i + 1}
                </legend>
                <label>
                  Description
                  <Input
                    required
                    maxLength={150}
                    value={line.description}
                    onChange={(e) =>
                      update(line.id, 'description', e.target.value)
                    }
                  />
                </label>
                <label>
                  Quantity
                  <Input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(e) =>
                      update(line.id, 'quantity', e.target.value)
                    }
                  />
                </label>
                <label>
                  Unit price ({currency})
                  <Input
                    required
                    type="number"
                    min={new Decimal(10).pow(-scale).toFixed(scale)}
                    step={new Decimal(10).pow(-scale).toFixed(scale)}
                    value={line.price}
                    onChange={(e) => update(line.id, 'price', e.target.value)}
                  />
                </label>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-end"
                    aria-label={'Remove line ' + (i + 1)}
                    onClick={() =>
                      setLines(lines.filter((row) => row.id !== line.id))
                    }
                  >
                    Remove
                  </Button>
                )}
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLines([...lines, newLine()])}
            >
              Add line
            </Button>
            <p className="font-semibold">
              Total {currency} {amountLabel(total.toFixed(scale))}
            </p>
            {save.error && <p role="alert">{getApiErrorMessage(save.error)}</p>}
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save draft invoice'}
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
