import { BadRequestException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
  isFinanceDate,
} from './finance-configuration.types';

export const CANDIDATE_STORAGE_SCALE = 12;
export interface JournalCandidateLine {
  lineKey: string;
  roleCode: string;
  debit: string;
  credit: string;
  dimensions: Record<string, string>;
}
export interface JournalCandidateInput {
  schema: 'FINANCE_JOURNAL_CANDIDATE_V1';
  periodId: string;
  periodRevision: number;
  accountingDate: string;
  chartReleaseId: string;
  chartReleaseHash: string;
  currency: string;
  decimalScale: number;
  economicOrigin: string;
  economicSourceId: string;
  economicComponent: string;
  sourceRevision: string;
  correctionOf: { id: string; hash: string } | null;
  lines: JournalCandidateLine[];
}
function fail(message: string): never {
  throw new BadRequestException(message);
}
function exactKeys(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    keys.some((k) => !Object.hasOwn(value, k))
  )
    fail('Journal candidates require exactly the declared fields.');
}
export function candidateText(value: unknown, length = 150): value is string {
  return (
    typeof value === 'string' &&
    !!value.trim() &&
    value === value.trim() &&
    value.length <= length
  );
}
export function candidateCode(value: unknown): value is string {
  return candidateText(value, 80) && /^[A-Z0-9][A-Z0-9_.:-]*$/.test(value);
}
export function candidateRevision(value: unknown): value is number {
  return (
    Number.isInteger(value) && Number(value) > 0 && Number(value) <= 2147483647
  );
}
/** Reject rounding rather than silently applying an unresolved currency rule. */
export function candidateAmount(
  value: unknown,
  scale: number,
): { units: bigint; stored: string } {
  if (
    !Number.isInteger(scale) ||
    scale < 0 ||
    scale > CANDIDATE_STORAGE_SCALE ||
    typeof value !== 'string' ||
    !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)
  )
    fail(
      'Amounts must be unsigned plain decimal strings with an explicit supported scale.',
    );
  const [whole, fraction = ''] = value.split('.');
  if (
    whole.length > 26 ||
    fraction.length > CANDIDATE_STORAGE_SCALE ||
    /[1-9]/.test(fraction.slice(scale))
  )
    fail(
      'Amount exceeds exact storage capacity or the declared candidate scale; rounding is not allowed.',
    );
  const padded = fraction.padEnd(CANDIDATE_STORAGE_SCALE, '0');
  return { units: BigInt(whole + padded), stored: whole + '.' + padded };
}
export function normalizeJournalCandidate(
  value: unknown,
): JournalCandidateInput {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  exactKeys(p, [
    'schema',
    'periodId',
    'periodRevision',
    'accountingDate',
    'chartReleaseId',
    'chartReleaseHash',
    'currency',
    'decimalScale',
    'economicOrigin',
    'economicSourceId',
    'economicComponent',
    'sourceRevision',
    'correctionOf',
    'lines',
  ]);
  if (
    p.schema !== 'FINANCE_JOURNAL_CANDIDATE_V1' ||
    typeof p.periodId !== 'string' ||
    !FINANCE_UUID.test(p.periodId) ||
    typeof p.chartReleaseId !== 'string' ||
    !FINANCE_UUID.test(p.chartReleaseId) ||
    typeof p.chartReleaseHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(p.chartReleaseHash) ||
    !candidateRevision(p.periodRevision) ||
    !isFinanceDate(p.accountingDate) ||
    typeof p.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !Number.isInteger(p.decimalScale) ||
    Number(p.decimalScale) < 0 ||
    Number(p.decimalScale) > 12 ||
    !candidateCode(p.economicOrigin) ||
    !candidateText(p.economicSourceId) ||
    !candidateCode(p.economicComponent) ||
    !candidateText(p.sourceRevision, 100) ||
    !Array.isArray(p.lines) ||
    p.lines.length < 2 ||
    p.lines.length > 1000
  )
    fail(
      'Explicit candidate scope, date, chart, currency/scale, economic identity and bounded lines are required.',
    );
  if (p.correctionOf !== null) {
    exactKeys(p.correctionOf, ['id', 'hash']);
    if (
      typeof p.correctionOf.id !== 'string' ||
      !FINANCE_UUID.test(p.correctionOf.id) ||
      typeof p.correctionOf.hash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(p.correctionOf.hash)
    )
      fail('Corrections require the exact predecessor ID and hash.');
    p.correctionOf.id = p.correctionOf.id.toLowerCase();
  }
  const keys = new Set<string>();
  let debit = 0n,
    credit = 0n;
  for (const line of p.lines) {
    exactKeys(line, ['lineKey', 'roleCode', 'debit', 'credit', 'dimensions']);
    if (
      !candidateCode(line.lineKey) ||
      !candidateCode(line.roleCode) ||
      keys.has(line.lineKey) ||
      !line.dimensions ||
      typeof line.dimensions !== 'object' ||
      Array.isArray(line.dimensions) ||
      Object.entries(line.dimensions).some(
        ([key, v]) => !candidateCode(key) || !candidateText(v, 200),
      )
    )
      fail(
        'Line keys, roles and explicit dimension values must be valid and unique.',
      );
    keys.add(line.lineKey);
    const dr = candidateAmount(line.debit, p.decimalScale as number),
      cr = candidateAmount(line.credit, p.decimalScale as number);
    if (dr.units > 0n === cr.units > 0n)
      fail(
        'Every line must have exactly one positive side and a zero opposite side.',
      );
    debit += dr.units;
    credit += cr.units;
    line.debit = dr.stored;
    line.credit = cr.stored;
  }
  if (debit !== credit)
    fail(
      'The exact stored candidate must balance without a plug or tolerance.',
    );
  p.periodId = p.periodId.toLowerCase();
  p.chartReleaseId = p.chartReleaseId.toLowerCase();
  p.lines.sort((a, b) =>
    a.lineKey < b.lineKey ? -1 : a.lineKey > b.lineKey ? 1 : 0,
  );
  return p as unknown as JournalCandidateInput;
}
