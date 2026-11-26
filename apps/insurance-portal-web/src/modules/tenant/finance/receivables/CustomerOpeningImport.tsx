import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { csvRows } from '../setup/chartCsvParser';
import { downloadCsv } from '../payables/ap-export';
import { openingColumns as columns } from './customer-account-model';
export function CustomerOpeningImport({
  currency,
  items,
  change,
}: {
  currency: string;
  items: Record<string, string>[];
  change: (rows: Record<string, string>[]) => void;
}) {
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  async function read(file?: File) {
    const id = ++version.current;
    change([]);
    setError('');
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error('Choose a CSV under 2 MB.');
      const [header, ...rows] = csvRows(await file.text(), 5000, 'invoices');
      if (
        !header ||
        header.length !== columns.length ||
        columns.some((k) => !header.includes(k)) ||
        !rows.length
      )
        throw Error(
          'Use the template column names and include at least one invoice.',
        );
      const parsed = rows.map((row, i) => {
        if (row.length !== columns.length || row.some((x) => !x.trim()))
          throw Error('Complete every field on row ' + (i + 2) + '.');
        return Object.fromEntries(header.map((k, j) => [k, row[j].trim()]));
      });
      if (id === version.current) change(parsed);
    } catch (e) {
      if (id === version.current)
        setError(e instanceof Error ? e.message : 'Could not read the file.');
    }
  }
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend>Opening invoices in {currency}</legend>
      <p>
        Use the certified opening date. Each row identifies the customer,
        external invoice, original dates and unpaid amount.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => downloadCsv('customer-opening-template', [columns])}
      >
        Download CSV template
      </Button>
      <label className="block">
        Opening invoice CSV{' '}
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {!!items.length && (
        <p role="status">
          {items.length} {items.length === 1 ? 'invoice' : 'invoices'} ready for
          review
        </p>
      )}
    </fieldset>
  );
}
