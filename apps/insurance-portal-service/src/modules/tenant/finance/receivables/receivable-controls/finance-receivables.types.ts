import { BadRequestException } from '@nestjs/common';
import {
  approvalFields,
  APPROVAL_HASH,
} from '../../governance/finance-approvals/finance-approval.types';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  candidateAmount,
  candidateText,
} from '../../accounting/journal-entries/finance-journal-candidate.types';
export const RECEIVABLE_EVENT = 'source.receivables.evidence-snapshotted.v1';
export const RECEIVABLE_HOLDS = Object.freeze([
  'UNRESOLVED_ACCOUNTING_POLICIES',
  'LEGAL_DISCHARGE_UNASSIGNED',
  'IFRS9_SCOPE_UNASSIGNED',
  'LEGACY_EFFECTS_NOT_RECONCILED',
  'B43_B44_B45_PENDING',
]);
export interface ReceivableProfile {
  schema: 'FINANCE_RECEIVABLE_CONTROLS_V1';
  purpose: 'INACTIVE_CONTROLS_ONLY';
  recognition: 'HELD_INACTIVE';
  cashAccounts: {
    sourceAccountId: string;
    sourceCompanyId: string;
    currency: string;
    decimalScale: number;
  }[];
  ageingBands: number[];
}
export interface ReceiptEvidence {
  schema: 'FINANCE_RECEIVABLE_EVIDENCE_V1';
  kind: 'CONFIRMED_RECEIPT';
  id: string;
  sourceRevision: 1;
  sourceCompanyId: string;
  sourceAccountId: string;
  bankTransactionId: string;
  customerId: string;
  currency: string;
  decimalScale: number;
  received: string;
  bankSettled: string;
  bankFee: string;
  valueDate: string;
  bankEvidenceHash: string;
  legacyAllocated: string;
  legacyRefunded: string;
  legacyReserved: string;
  legacyEvidenceHash: string;
}
export interface TermsEvidence {
  schema: 'FINANCE_RECEIVABLE_EVIDENCE_V1';
  kind: 'BILLING_DUE_DATE';
  id: string;
  sourceRevision: 1;
  sourceCompanyId: string;
  memoId: string;
  memoHash: string;
  invoiceId: string;
  customerId: string;
  currency: string;
  decimalScale: number;
  dueDate: string;
}
function fail(): never {
  throw new BadRequestException(
    'Exact scoped receipt/receivable evidence and amounts are required; currency conversion, rounding and legal recognition elections are unsupported.',
  );
}
export function controlUuid(v: unknown): string {
  if (typeof v !== 'string' || !FINANCE_UUID.test(v)) fail();
  return v.toLowerCase();
}
export function controlHash(v: unknown): string {
  if (typeof v !== 'string' || !APPROVAL_HASH.test(v)) fail();
  return v;
}
export function controlCurrency(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) fail();
  return v;
}
export function controlScale(v: unknown): number {
  if (!Number.isInteger(v) || Number(v) < 0 || Number(v) > 12) fail();
  return Number(v);
}
export function controlDate(v: unknown): string {
  if (!isFinanceDate(v)) fail();
  return v;
}
export function receivableProfile(
  value: unknown,
  deps: string[],
): ReceivableProfile {
  const p = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'purpose',
    'recognition',
    'cashAccounts',
    'ageingBands',
  ]);
  if (
    p.schema !== 'FINANCE_RECEIVABLE_CONTROLS_V1' ||
    p.purpose !== 'INACTIVE_CONTROLS_ONLY' ||
    p.recognition !== 'HELD_INACTIVE' ||
    !['DEC-01', 'DEC-02', 'DEC-05', 'DEC-12', 'DEC-14'].every((d) =>
      deps.includes(d),
    ) ||
    !Array.isArray(p.cashAccounts) ||
    p.cashAccounts.length < 1 ||
    p.cashAccounts.length > 100 ||
    !Array.isArray(p.ageingBands) ||
    p.ageingBands.length < 1 ||
    p.ageingBands.length > 12
  )
    fail();
  const keys = new Set<string>();
  p.cashAccounts = p.cashAccounts.map((a: unknown) => {
    approvalFields(a, [
      'sourceAccountId',
      'sourceCompanyId',
      'currency',
      'decimalScale',
    ]);
    const b = {
      sourceAccountId: controlUuid(a.sourceAccountId),
      sourceCompanyId: controlUuid(a.sourceCompanyId),
      currency: controlCurrency(a.currency),
      decimalScale: controlScale(a.decimalScale),
    };
    const key = b.sourceCompanyId + ':' + b.sourceAccountId;
    if (keys.has(key)) fail();
    keys.add(key);
    return b;
  });
  p.ageingBands.forEach((n: number, i: number) => {
    if (
      !Number.isInteger(n) ||
      n < 1 ||
      n > 36500 ||
      (i > 0 && n <= (p.ageingBands as number[])[i - 1])
    )
      fail();
  });
  return p as unknown as ReceivableProfile;
}
export function normalizeReceivableEvidence(
  value: unknown,
): ReceiptEvidence | TermsEvidence {
  const p = JSON.parse(canonicalFinanceJson(value));
  if (p?.kind === 'CONFIRMED_RECEIPT') {
    approvalFields(p, [
      'schema',
      'kind',
      'id',
      'sourceRevision',
      'sourceCompanyId',
      'sourceAccountId',
      'bankTransactionId',
      'customerId',
      'currency',
      'decimalScale',
      'received',
      'bankSettled',
      'bankFee',
      'valueDate',
      'bankEvidenceHash',
      'legacyAllocated',
      'legacyRefunded',
      'legacyReserved',
      'legacyEvidenceHash',
    ]);
    p.sourceAccountId = controlUuid(p.sourceAccountId);
    if (!candidateText(p.bankTransactionId, 200)) fail();
    p.valueDate = controlDate(p.valueDate);
    p.bankEvidenceHash = controlHash(p.bankEvidenceHash);
  } else if (p?.kind === 'BILLING_DUE_DATE') {
    approvalFields(p, [
      'schema',
      'kind',
      'id',
      'sourceRevision',
      'sourceCompanyId',
      'memoId',
      'memoHash',
      'invoiceId',
      'customerId',
      'currency',
      'decimalScale',
      'dueDate',
    ]);
    p.memoId = controlUuid(p.memoId);
    p.memoHash = controlHash(p.memoHash);
    p.invoiceId = controlUuid(p.invoiceId);
    p.dueDate = controlDate(p.dueDate);
  } else fail();
  if (p.schema !== 'FINANCE_RECEIVABLE_EVIDENCE_V1' || p.sourceRevision !== 1)
    fail();
  p.id = controlUuid(p.id);
  p.sourceCompanyId = controlUuid(p.sourceCompanyId);
  p.customerId = controlUuid(p.customerId);
  p.currency = controlCurrency(p.currency);
  const scale = controlScale(p.decimalScale);
  p.decimalScale = scale;
  if (p.kind === 'CONFIRMED_RECEIPT') {
    const gross = candidateAmount(p.received, scale),
      bank = candidateAmount(p.bankSettled, scale),
      fee = candidateAmount(p.bankFee, scale);
    if (gross.units <= 0n || gross.units !== bank.units + fee.units) fail();
    p.received = gross.stored;
    p.bankSettled = bank.stored;
    p.bankFee = fee.stored;
    for (const key of ['legacyAllocated', 'legacyRefunded', 'legacyReserved'])
      p[key] = candidateAmount(p[key], scale).stored;
    p.legacyEvidenceHash = controlHash(p.legacyEvidenceHash);
  }
  return p as unknown as ReceiptEvidence | TermsEvidence;
}
export function receiptIdentity(s: ReceiptEvidence) {
  return {
    sourceAccountId: s.sourceAccountId,
    bankTransactionId: s.bankTransactionId,
  };
}
export function receiptVector(s: ReceiptEvidence) {
  const { id, sourceRevision, schema, kind, ...rest } = s;
  return rest;
}
export const controlUnits = (s: string) => candidateAmount(s, 12).units;
export function controlAmount(n: bigint): string {
  const sign = n < 0n ? '-' : '';
  const p = (n < 0n ? -n : n).toString().padStart(13, '0');
  return sign + p.slice(0, -12) + '.' + p.slice(-12);
}
export function dueAgeing(
  asOf: string,
  dueDate: string | null,
  bands: number[],
) {
  controlDate(asOf);
  if (dueDate === null)
    return {
      dueDate: null,
      daysPastDue: null,
      bucket: 'DUE_DATE_EVIDENCE_REQUIRED',
    };
  controlDate(dueDate);
  const days =
    (Date.parse(asOf + 'T00:00:00Z') - Date.parse(dueDate + 'T00:00:00Z')) /
    86400000;
  const bound = bands.find((b) => days <= b);
  return {
    dueDate,
    daysPastDue: days,
    bucket:
      days <= 0
        ? 'NOT_DUE'
        : bound === undefined
          ? 'OVER_' + bands[bands.length - 1]
          : 'UP_TO_' + bound,
  };
}
