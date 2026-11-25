import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { csvRows } from '../setup/chartCsvParser';
import { downloadCsv } from './ap-export';
import type { Info } from './ap-model';

const required = [
  'supplierCode',
  'reference',
  'invoiceDate',
  'dueDate',
  'currency',
  'amount',
];
const columns = [
  ...required,
  'documentType',
  'creditableAmount',
  'functionalAmount',
  'withholding',
  'discountBps',
  'discountUntil',
];

export function OpeningInvoiceImport({
  lines,
  change,
  currency,
}: {
  lines: Info[];
  change: (rows: Info[]) => void;
  currency: string;
}) {
  const [error, setError] = useState('');
  const current = useRef(0);
  useEffect(
    () => () => {
      current.current++;
    },
    [],
  );
  async function load(file?: File) {
    const version = ++current.current;
    setError('');
    change([]);
    if (!file) return;
    try {
      if (file.size > 500000)
        throw Error('The CSV exceeds the import size limit of 500 KB.');
      const [rawHeader, ...rows] = csvRows(await file.text(), 5000, 'invoices');
      const header = rawHeader?.map((x) => x.trim());
      if (
        !header ||
        new Set(header).size !== header.length ||
        required.some((key) => !header.includes(key)) ||
        header.some((key) => !columns.includes(key))
      )
        throw Error('Use the column names in the opening invoice template.');
      if (!rows.length)
        throw Error('Add at least one outstanding supplier invoice.');
      const parsed = rows.map((cells, i) => {
        if (cells.length !== header.length)
          throw Error('Check the number of columns in row ' + (i + 2) + '.');
        const row = Object.fromEntries(
          header.map((key, j) => [key, cells[j].trim()]),
        );
        if (
          required.some(
            (key) =>
              !row[key] &&
              !(key === 'dueDate' && row.documentType === 'CREDIT'),
          ) ||
          (row.currency !== currency && !row.functionalAmount)
        )
          throw Error(
            'Complete the invoice and its carrying amount in row ' +
              (i + 2) +
              '.',
          );
        return row;
      });
      if (current.current === version) change(parsed);
    } catch (e) {
      if (current.current === version)
        setError(
          e instanceof Error ? e.message : 'Could not read the invoice file.',
        );
    }
  }
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend>Opening invoices</legend>
      <p>
        Enter outstanding amounts as positive numbers. Use CREDIT in the
        documentType column for an unused supplier credit. Invoices less credits
        must match the unallocated GL balance in {currency}.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => downloadCsv('opening-supplier-invoices', [columns])}
      >
        Download CSV template
      </Button>
      <label className="block">
        Opening invoice CSV
        <input
          className="block"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void load(e.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {!!lines.length && (
        <>
          <p role="status">
            {lines.length} opening items selected. Showing the first{' '}
            {Math.min(lines.length, 20)}.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  'Supplier',
                  'Type',
                  'Invoice',
                  'Due date',
                  'Outstanding',
                  'Carrying amount',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.slice(0, 20).map((l, i) => (
                <tr key={i}>
                  <td>{l.supplierCode}</td>
                  <td>{l.documentType || 'BILL'}</td>
                  <td>{l.reference}</td>
                  <td>{l.dueDate}</td>
                  <td>
                    {l.currency} {l.amount}
                  </td>
                  <td>
                    {currency} {l.functionalAmount || l.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </fieldset>
  );
}
