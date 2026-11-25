import type { Info } from './ap-model';
export function amountLabel(input: string) {
  const [whole, fraction = ''] = String(input).split('.'),
    decimal = fraction.replace(/0+$/, '');
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimal ? '.' + decimal : '')
  );
}
export function downloadInstructions(rows: Info[], reference: string) {
  const columns = [
    'id',
    'reference',
    'beneficiaryId',
    'bankName',
    'accountName',
    'accountNumber',
    'branch',
    'swift',
    'sourceAccount',
    'currency',
    'amount',
    'scheduledDate',
    'status',
  ];
  downloadCsv(reference + '-payment-instructions', [
    columns,
    ...rows.map((r) => columns.map((c) => r[c])),
  ]);
}
export function downloadCsv(reference: string, rows: unknown[][]) {
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=\-+@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const body = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(
    new Blob([body], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = reference.replace(/[^\w-]/g, '_') + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
