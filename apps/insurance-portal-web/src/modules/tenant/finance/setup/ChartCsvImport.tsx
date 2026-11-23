import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CHART_CSV_HEADER,
  parseChartCsv,
  type ImportedChartAccount,
} from './chartCsvParser';
import type { ChartDraftAccount } from './chartDraftValidation';

export function ChartCsvImport({
  existing,
  onAdd,
}: {
  existing: ChartDraftAccount[];
  onAdd: (accounts: ImportedChartAccount[]) => void;
}) {
  const [fileText, setFileText] = useState('');
  const [preview, setPreview] = useState<ImportedChartAccount[]>([]);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(0);
  const request = useRef(0);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([CHART_CSV_HEADER + '\r\n'], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chart-accounts-template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const choose = async (file: File | undefined) => {
    const sequence = ++request.current;
    setError('');
    setFileText('');
    setPreview([]);
    setAdded(0);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1024 * 1024) {
      setError('Choose a CSV file no larger than 1 MB.');
      return;
    }
    try {
      const text = await file.text();
      if (sequence !== request.current) return;
      const parsed = parseChartCsv(text, existing);
      setFileText(text);
      setPreview(parsed);
    } catch (e) {
      if (sequence === request.current)
        setError(
          e instanceof Error ? e.message : 'Unable to read this CSV file.',
        );
    }
  };
  return (
    <section
      className="space-y-3 rounded-md border p-4"
      aria-label="Import draft accounts"
    >
      <h3 className="font-semibold">Import accounts from CSV</h3>
      <p className="text-sm">
        Download the template, enter your account details and preview the file.
        Adding accounts changes only this draft; review and approval are still
        required.
      </p>
      <p className="text-sm">
        Use ASSET, LIABILITY, EQUITY, INCOME or EXPENSE for type; DR or CR for
        normal balance; and true or false for posting and control. Leave
        parentCode blank for top-level accounts. In a spreadsheet, format
        account codes as text so leading zeros are preserved.
      </p>
      <Button type="button" variant="outline" onClick={download}>
        Download CSV template
      </Button>
      <label className="block text-sm">
        Choose CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void choose(file);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {preview.length} accounts ready to add
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {preview.slice(0, 20).map((account) => (
              <li key={account.code}>
                {account.code} — {account.name} ({account.type})
              </li>
            ))}
          </ul>
          {preview.length > 20 && (
            <p className="text-sm">Showing the first 20 accounts.</p>
          )}
          <Button
            type="button"
            onClick={() => {
              try {
                const rows = parseChartCsv(fileText, existing);
                onAdd(rows);
                setPreview([]);
                setFileText('');
                setError('');
                setAdded(rows.length);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : 'Review the CSV file.',
                );
              }
            }}
          >
            Add accounts to draft
          </Button>
        </div>
      )}
      {added > 0 && (
        <p role="status" className="text-sm text-green-800">
          Added {added} accounts to the draft. Save the chart when it is ready.
        </p>
      )}
    </section>
  );
}
