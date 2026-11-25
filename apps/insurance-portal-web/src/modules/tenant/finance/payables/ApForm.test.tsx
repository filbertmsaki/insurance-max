import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ApForm } from './ApForm';
import {
  currentRows,
  type Controls,
  type Register,
  type Row,
} from './ap-model';

const controls: Controls = {
  functionalCurrency: 'TZS',
  currencies: { TZS: 2 },
  documents: [
    {
      id: 'receipt',
      documentId: 'doc',
      hash: 'a'.repeat(64),
      title: 'ABC invoice',
    },
  ],
  dimensions: [
    {
      code: 'BRANCH',
      label: 'Branch',
      required: true,
      options: [{ value: 'dar', label: 'Dar es Salaam' }],
    },
  ],
  roles: [{ code: 'COMPUTERS', accountCode: '121002', accountType: 'ASSET' }],
};
const row = (
  id: string,
  kind: string,
  reference: string,
  details: Record<string, unknown>,
  revision = 1,
): Row => ({
  id,
  kind,
  reference,
  currency: 'TZS',
  status: 'APPROVED',
  state: 'APPROVED',
  party: '',
  sequence: '1',
  revision,
  amount: '0',
  doc_date: '2026-01-01',
  data: { details, dimensions: {}, lines: [], movements: [] },
});
const setup = row('cfg', 'SETTINGS', 'AP', {
  taxRules: [{ supplierClass: 'STANDARD', transactionClass: 'EQUIPMENT' }],
});
const supplier = row('abc', 'SUPPLIER', 'SUP-0001', {
  name: 'ABC Technology Ltd',
  taxClass: 'STANDARD',
});
const registry: Register = { staff: [], terms: [], records: [setup, supplier] };
const choose = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name, { exact: true }), {
    target: { value },
  });
it('builds a supplier invoice with evidence, dimensions, quantities and its approved tax classification', async () => {
  const save = vi.fn(async () => {});
  render(<ApForm w={controls} registry={registry} save={save} />);
  choose('Document type', 'BILL');
  choose('Supplier', 'abc');
  choose('Supplier invoice number', 'ABC-INV-2026-001');
  choose('Branch', 'dar');
  choose('Supporting document version', 'receipt');
  choose('Description', 'Laptop purchase');
  fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
  choose('Item', 'LAPTOP');
  fireEvent.change(screen.getAllByLabelText('Description')[1], {
    target: { value: 'Computer equipment' },
  });
  choose('Quantity', '10');
  choose('Unit Price', '1200000');
  choose('Role', 'COMPUTERS');
  choose('Transaction Class', 'EQUIPMENT');
  fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'BILL',
        supplierId: 'abc',
        reference: 'ABC-INV-2026-001',
        dimensions: { BRANCH: 'dar' },
        evidence: { id: 'receipt', documentId: 'doc', hash: 'a'.repeat(64) },
        details: {
          description: 'Laptop purchase',
          lines: [
            {
              item: 'LAPTOP',
              description: 'Computer equipment',
              quantity: '10',
              unitPrice: '1200000',
              role: 'COMPUTERS',
              transactionClass: 'EQUIPMENT',
            },
          ],
        },
      }),
    ),
  );
});
it('limits employee submission to personal expenses, imprests, retirements and bank details', () => {
  render(
    <ApForm w={controls} registry={registry} employee="self" save={vi.fn()} />,
  );
  const selector = screen.getByLabelText('Document type') as HTMLSelectElement;
  expect(
    Array.from(selector.options)
      .map((o) => o.value)
      .filter(Boolean),
  ).toEqual(['EXPENSE', 'IMPREST', 'RETIREMENT', 'BANK']);
  expect(screen.queryByLabelText('Employee')).toBeNull();
  expect(screen.queryByLabelText('Supplier')).toBeNull();
});
it('suppresses superseded bank versions after approval of a deactivation', () => {
  const old = row('old', 'BANK', 'MAIN', {}),
    revised = row('new', 'BANK', 'MAIN', { disabled: true }, 2);
  expect(currentRows([revised, old], 'BANK')).toEqual([]);
});
it('submits each opening invoice with its original dates, currency and carrying amount', async () => {
  const save = vi.fn(async () => {});
  render(<ApForm w={controls} registry={registry} save={save} />);
  choose('Document type', 'OPENING_IMPORT');
  choose('Reference', 'CUTOVER');
  choose('Cutover date', '2026-10-31');
  const csv =
    'supplierCode,reference,invoiceDate,dueDate,currency,amount,functionalAmount\r\nSUP-0001,"ABC,01",2026-08-01,2026-08-30,USD,5,13000';
  const file = new File([csv], 'opening.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => csv });
  fireEvent.change(screen.getByLabelText('Opening invoice CSV'), {
    target: { files: [file] },
  });
  expect(await screen.findByText('ABC,01')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'OPENING_IMPORT',
        date: '2026-10-31',
        details: expect.objectContaining({
          lines: [
            {
              supplierCode: 'SUP-0001',
              reference: 'ABC,01',
              invoiceDate: '2026-08-01',
              dueDate: '2026-08-30',
              currency: 'USD',
              amount: '5',
              functionalAmount: '13000',
            },
          ],
        }),
      }),
    ),
  );
});
it('shows an incoming account only for returned imprest cash and selects the supplier credit on a refund', () => {
  const credit = {
    ...row('credit', 'CREDIT', 'CN-LAPTOP', { availableCredit: '1200000' }),
    status: 'POSTED',
    party: 'S:abc',
  };
  render(
    <ApForm
      w={controls}
      registry={{
        ...registry,
        records: [...registry.records, credit],
        availableCredits: { credit: '1200000' },
        receivingRoles: [{ code: 'IN', accountCode: '1100' }],
      }}
      save={vi.fn()}
    />,
  );
  choose('Document type', 'RETIREMENT');
  choose('Cash Returned', '0');
  expect(screen.queryByLabelText('Receiving account')).toBeNull();
  choose('Cash Returned', '10');
  expect(screen.getByRole('option', { name: '1100 · IN' })).toBeTruthy();
  choose('Document type', 'SUPPLIER_REFUND');
  choose('Supplier', 'abc');
  choose('Supplier credit note', 'credit');
  expect(screen.queryByLabelText('Approved beneficiary account')).toBeNull();
});
