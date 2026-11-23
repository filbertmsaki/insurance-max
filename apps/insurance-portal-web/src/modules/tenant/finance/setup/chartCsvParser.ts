import { chartDraftIssue } from './chartDraftValidation';

export type ImportedChartAccount = {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  normalBalance: 'DR' | 'CR';
  posting: boolean;
  control: boolean;
  parentCode: string | null;
};

export const CHART_CSV_HEADER =
  'code,name,type,normalBalance,posting,control,parentCode';

/** Read a bounded CSV without interpreting spreadsheet values as formulas. */
function csvRows(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    quoteEnded = false;
  const addCell = () => {
    row.push(cell);
    cell = '';
    quoteEnded = false;
  };
  const addRow = () => {
    addCell();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    if (rows.length > 2001)
      throw new Error('The file may contain at most 2,000 accounts.');
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        quoteEnded = true;
      } else cell += char;
    } else if (char === '"') {
      if (cell || quoteEnded)
        throw new Error('Invalid quotation in the CSV file.');
      quoted = true;
    } else if (char === ',') addCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      addRow();
    } else {
      if (quoteEnded)
        throw new Error('Unexpected text after a quoted CSV value.');
      cell += char;
    }
  }
  if (quoted) throw new Error('A quoted CSV value is not closed.');
  if (cell || row.length || quoteEnded) addRow();
  return rows;
}

export function parseChartCsv(
  content: string,
  existing: {
    code: string;
    type: string;
    posting: boolean;
    control: boolean;
    parentCode: string | null;
  }[],
): ImportedChartAccount[] {
  const [header, ...rows] = csvRows(content);
  if (
    !header ||
    header.map((cell) => cell.trim()).join(',') !== CHART_CSV_HEADER
  )
    throw new Error(
      'Use the provided CSV template and keep its column headings in order.',
    );
  if (!rows.length)
    throw new Error('Add at least one account to the CSV file.');
  const accounts = rows.map((cells, index): ImportedChartAccount => {
    const rowNumber = index + 2;
    if (cells.length !== 7)
      throw new Error(`Row ${rowNumber} must have seven columns.`);
    const [code, name, type, balance, posting, control, parent] = cells.map(
      (cell) => cell.trim(),
    );
    if (
      !code ||
      !name ||
      name.length > 200 ||
      !['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].includes(type) ||
      !['DR', 'CR'].includes(balance) ||
      !['true', 'false'].includes(posting.toLowerCase()) ||
      !['true', 'false'].includes(control.toLowerCase())
    )
      throw new Error(
        `Row ${rowNumber} needs a code, name, valid type, DR or CR balance, and true or false for posting and control.`,
      );
    return {
      code,
      name,
      type: type as ImportedChartAccount['type'],
      normalBalance: balance as 'DR' | 'CR',
      posting: posting.toLowerCase() === 'true',
      control: control.toLowerCase() === 'true',
      parentCode: parent || null,
    };
  });
  const issue = chartDraftIssue([...existing, ...accounts], []);
  if (issue) throw new Error(issue);
  return accounts;
}
