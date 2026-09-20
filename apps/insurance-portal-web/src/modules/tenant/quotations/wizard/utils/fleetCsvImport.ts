// Bulk vehicle entry for the Fleet Vehicles wizard step. Lets an underwriter
// paste in a fleet's vehicle list instead of adding each row through the
// modal one at a time.

export interface FleetCsvRow {
  registration_number: string;
  chassis_number: string;
  engine_number: string;
  make: string;
  model: string;
  body_type: string;
  color: string;
  year_of_manufacture: string;
  sitting_capacity: string;
  owner_name: string;
  owner_address: string;
  risk_code: string;
  sum_insured: string;
  subject_matter_reference: string;
  subject_matter_desc: string;
}

export const FLEET_CSV_COLUMNS: Array<{
  key: keyof FleetCsvRow;
  header: string;
  required: boolean;
}> = [
  {
    key: 'registration_number',
    header: 'Registration Number',
    required: false,
  },
  { key: 'chassis_number', header: 'Chassis Number', required: false },
  { key: 'engine_number', header: 'Engine Number', required: false },
  { key: 'make', header: 'Make', required: false },
  { key: 'model', header: 'Model', required: false },
  { key: 'body_type', header: 'Body Type', required: false },
  { key: 'color', header: 'Colour', required: false },
  {
    key: 'year_of_manufacture',
    header: 'Year of Manufacture',
    required: false,
  },
  { key: 'sitting_capacity', header: 'Seating Capacity', required: false },
  { key: 'owner_name', header: 'Owner Name', required: false },
  { key: 'owner_address', header: 'Owner Address', required: false },
  { key: 'risk_code', header: 'Risk Code', required: false },
  { key: 'sum_insured', header: 'Sum Insured', required: false },
  {
    key: 'subject_matter_reference',
    header: 'Subject Matter Reference',
    required: false,
  },
  {
    key: 'subject_matter_desc',
    header: 'Subject Matter Description',
    required: false,
  },
];

export function buildFleetCsvTemplate(): string {
  return [
    FLEET_CSV_COLUMNS.map((column) => column.header).join(','),
    'T123ABC,CHS0001,ENG0001,Toyota,Hiace,Van,White,2020,14,Acme Ltd,Dar es Salaam,MOTOR-COMP,25000000,,',
  ].join('\n');
}

/** Minimal RFC 4180 line splitter — handles quoted fields containing commas. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

export function parseFleetCsv(text: string): {
  rows: FleetCsvRow[];
  errors: string[];
} {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ['The CSV file is empty.'] };
  }

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const columnIndexByKey = new Map<keyof FleetCsvRow, number>();
  FLEET_CSV_COLUMNS.forEach((column) => {
    const index = headerCells.indexOf(normalizeHeader(column.header));
    if (index !== -1) columnIndexByKey.set(column.key, index);
  });

  const missingRequired = FLEET_CSV_COLUMNS.filter(
    (column) => column.required && !columnIndexByKey.has(column.key),
  );
  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [
        `Missing required column(s): ${missingRequired.map((c) => c.header).join(', ')}.`,
      ],
    };
  }

  const rows: FleetCsvRow[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, lineIndex) => {
    const cells = splitCsvLine(line);
    const rowNumber = lineIndex + 2; // account for the header row
    const get = (key: keyof FleetCsvRow) => {
      const index = columnIndexByKey.get(key);
      return index == null ? '' : (cells[index] ?? '').trim();
    };

    const row: FleetCsvRow = {
      registration_number: get('registration_number'),
      chassis_number: get('chassis_number'),
      engine_number: get('engine_number'),
      make: get('make'),
      model: get('model'),
      body_type: get('body_type'),
      color: get('color'),
      year_of_manufacture: get('year_of_manufacture'),
      sitting_capacity: get('sitting_capacity'),
      owner_name: get('owner_name'),
      owner_address: get('owner_address'),
      risk_code: get('risk_code'),
      sum_insured: get('sum_insured'),
      subject_matter_reference: get('subject_matter_reference'),
      subject_matter_desc: get('subject_matter_desc'),
    };

    const rowErrors: string[] = [];
    if (!row.registration_number && !row.chassis_number) {
      rowErrors.push('registration number or chassis number is required');
    }

    if (
      row.sum_insured &&
      (!Number.isFinite(Number(row.sum_insured)) || Number(row.sum_insured) < 0)
    ) {
      rowErrors.push('sum insured must be a number');
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join(', ')}.`);
      return;
    }

    rows.push(row);
  });

  return { rows, errors };
}
