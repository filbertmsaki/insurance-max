// Quick fleet entry: one vehicle per line, as pasted from a spreadsheet,
// email or chat. Each line is a registration (or chassis) number, optionally
// followed by a sum insured. Everything else is fetched from TIRA afterwards.

import { normalizeMotorTextInput } from '../../utils/motorText';
import type { FleetCsvRow } from './fleetCsvImport';

export interface FleetQuickAddResult {
  rows: FleetCsvRow[];
  errors: string[];
  /** Identifiers skipped because they repeat in the paste or the fleet. */
  duplicates: string[];
}

// Tanzanian plates are short (T123ABC, MC123ABC); chassis/VIN numbers are long.
const CHASSIS_MIN_LENGTH = 11;

function emptyRow(): FleetCsvRow {
  return {
    registration_number: '',
    chassis_number: '',
    engine_number: '',
    make: '',
    model: '',
    body_type: '',
    color: '',
    year_of_manufacture: '',
    sitting_capacity: '',
    owner_name: '',
    owner_address: '',
    risk_code: '',
    sum_insured: '',
    subject_matter_reference: '',
    subject_matter_desc: '',
  };
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, '').replace(/^TZS/i, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function parseFleetQuickAdd(
  text: string,
  existingIdentifiers: Iterable<string> = [],
): FleetQuickAddResult {
  const seen = new Set(
    Array.from(existingIdentifiers, (value) =>
      normalizeMotorTextInput(value).replace(/\s+/g, ''),
    ).filter(Boolean),
  );
  const rows: FleetCsvRow[] = [];
  const errors: string[] = [];
  const duplicates: string[] = [];

  text.split(/\r\n|\r|\n/).forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    // The first tab, comma, semicolon or pipe separates the plate from the
    // sum insured, so "T123ABC,25,000,000" keeps its thousands separators.
    // Plates are often written with spaces ("T 123 ABC"), so without a
    // separator only a trailing 4+ digit number counts as the sum insured.
    const separator = /[\t,;|]/.exec(line);
    let identifierText = separator ? line.slice(0, separator.index) : line;
    let amountText = separator ? line.slice(separator.index + 1).trim() : '';
    if (!separator) {
      const match = /^(.*?)\s+(\d[\d,]{3,}(?:\.\d+)?)$/.exec(line);
      if (match) {
        identifierText = match[1];
        amountText = match[2];
      }
    }

    const identifier = normalizeMotorTextInput(identifierText).replace(
      /\s+/g,
      '',
    );
    const lineNumber = lineIndex + 1;
    if (!identifier || !/^[A-Z0-9-]+$/.test(identifier)) {
      errors.push(`Line ${lineNumber}: "${line}" is not a valid plate.`);
      return;
    }
    if (seen.has(identifier)) {
      duplicates.push(identifier);
      return;
    }

    let sumInsured = '';
    if (amountText) {
      const amount = parseAmount(amountText);
      if (amount === null) {
        errors.push(
          `Line ${lineNumber}: sum insured "${amountText}" is not a number.`,
        );
        return;
      }
      sumInsured = String(amount);
    }

    seen.add(identifier);
    const row = emptyRow();
    if (identifier.length >= CHASSIS_MIN_LENGTH) {
      row.chassis_number = identifier;
    } else {
      row.registration_number = identifier;
    }
    row.sum_insured = sumInsured;
    rows.push(row);
  });

  return { rows, errors, duplicates };
}
