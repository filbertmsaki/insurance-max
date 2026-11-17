import { BadRequestException } from '@nestjs/common';
import { policyPricingHashMatches } from '../utils/endorsement-invoice-tax';
import {
  approvalFields as validateFields,
  normalizeBeneficiary,
  type BeneficiaryEvidence,
} from './finance-approval.types';
import { cashObject, cashAmount, cashText } from './finance-outgoing.types';
import {
  controlDate,
  controlCurrency,
  controlScale,
  controlUuid,
  controlHash,
  controlUnits as units,
  controlAmount as amount,
} from './finance-receivables.types';

export const POLICY_CHANGE_EVENT =
  'source.policy-change.evidence-snapshotted.v1';
export interface ChangeRef {
  id: string;
  hash: string;
}
export interface TermRef {
  id: string;
  number: number;
  hash: string;
}
export interface PolicyChangeEvidence {
  schema: 'FINANCE_POLICY_CHANGE_V1';
  id: string;
  sourceRevision: number;
  workflowRevision: number;
  sourceCompanyId: string;
  policyId: string;
  quotationId: string;
  customerId: string;
  kind: 'ENDORSEMENT' | 'CANCELLATION';
  stage: 'APPLIED';
  regulatoryStatus: 'ACCEPTED';
  sourceVersion: TermRef;
  targetVersion: TermRef;
  previousChange: ChangeRef | null;
  correctionOf: ChangeRef | null;
  effect: 'NORMAL' | 'REVERSAL' | 'ADJUSTMENT';
  effectiveDate: string;
  currency: string;
  decimalScale: number;
  originalBilling: ChangeRef;
  pricing: { snapshot: Record<string, unknown>; hash: string };
  additionalPremium: string;
  returnPremium: string;
  taxDifference: string | null;
  feeDifference: string | null;
  commissionDifference: string | null;
  taxLines:
    | { code: string; kind: 'TAX' | 'LEVY'; amount: string; ruleHash: string }[]
    | null;
  taxEvidenceHash: string | null;
  invoiceReconciliation: 'MATCHED' | 'UNRESOLVED';
}
export interface RefundPlan {
  commandKey: string;
  change: ChangeRef;
  assignment: ChangeRef;
  amount: string;
  beneficiary: BeneficiaryEvidence;
  expiresAt: string;
}
const fields = (v: unknown, k: string[]): void => validateFields(v, k);
const fail = (message: string): never => {
  throw new BadRequestException(message);
};
export function changeRef(value: unknown): ChangeRef {
  const v: any = cashObject(value);
  fields(v, ['id', 'hash']);
  return { id: controlUuid(v.id), hash: controlHash(v.hash) };
}
export function signedChangeAmount(v: unknown, scale: number): string {
  if (
    typeof v !== 'string' ||
    v === '-0' ||
    (v.startsWith('-0.') && !/[1-9]/.test(v.slice(1)))
  )
    return fail('A canonical signed policy-change amount is required.');
  return typeof v === 'string' && v.startsWith('-')
    ? '-' + cashAmount(v.slice(1), scale)
    : cashAmount(v, scale);
}
export const signedUnits = (v: string) =>
  v.startsWith('-') ? -units(v.slice(1)) : units(v);
function term(value: unknown): TermRef {
  const v: any = cashObject(value);
  fields(v, ['id', 'number', 'hash']);
  if (!Number.isInteger(v.number) || v.number < 1 || v.number > 2147483646)
    fail('A positive policy version is required.');
  return { id: controlUuid(v.id), number: v.number, hash: controlHash(v.hash) };
}
export function normalizePolicyChange(value: unknown): PolicyChangeEvidence {
  const p: any = cashObject(value);
  fields(p, [
    'schema',
    'id',
    'sourceRevision',
    'workflowRevision',
    'sourceCompanyId',
    'policyId',
    'quotationId',
    'customerId',
    'kind',
    'stage',
    'regulatoryStatus',
    'sourceVersion',
    'targetVersion',
    'previousChange',
    'correctionOf',
    'effect',
    'effectiveDate',
    'currency',
    'decimalScale',
    'originalBilling',
    'pricing',
    'additionalPremium',
    'returnPremium',
    'taxDifference',
    'feeDifference',
    'commissionDifference',
    'taxLines',
    'taxEvidenceHash',
    'invoiceReconciliation',
  ]);
  if (
    p.schema !== 'FINANCE_POLICY_CHANGE_V1' ||
    !['ENDORSEMENT', 'CANCELLATION'].includes(p.kind) ||
    p.stage !== 'APPLIED' ||
    p.regulatoryStatus !== 'ACCEPTED' ||
    !Number.isInteger(p.sourceRevision) ||
    p.sourceRevision < 1 ||
    p.sourceRevision > 2147483647 ||
    !Number.isInteger(p.workflowRevision) ||
    p.workflowRevision < 1 ||
    p.workflowRevision > 2147483647
  )
    fail(
      'Only exact applied, regulator-accepted policy-change evidence is eligible.',
    );
  for (const k of [
    'id',
    'sourceCompanyId',
    'policyId',
    'quotationId',
    'customerId',
  ])
    p[k] = controlUuid(p[k]);
  p.sourceVersion = term(p.sourceVersion);
  p.targetVersion = term(p.targetVersion);
  if (
    p.targetVersion.number !== p.sourceVersion.number + 1 ||
    p.targetVersion.id === p.sourceVersion.id
  )
    fail('The applied target must be the next distinct policy version.');
  p.originalBilling = changeRef(p.originalBilling);
  p.previousChange =
    p.previousChange === null ? null : changeRef(p.previousChange);
  p.correctionOf = p.correctionOf === null ? null : changeRef(p.correctionOf);
  if (
    !['NORMAL', 'REVERSAL', 'ADJUSTMENT'].includes(p.effect) ||
    (p.effect === 'NORMAL') !== (p.correctionOf === null)
  )
    fail('Corrections require an exact original accepted control reference.');
  p.effectiveDate = controlDate(p.effectiveDate);
  p.currency = controlCurrency(p.currency);
  p.decimalScale = controlScale(p.decimalScale);
  fields(p.pricing, ['snapshot', 'hash']);
  p.pricing.hash = controlHash(p.pricing.hash);
  if (
    !p.pricing.snapshot ||
    Array.isArray(p.pricing.snapshot) ||
    typeof p.pricing.snapshot !== 'object' ||
    !policyPricingHashMatches(p.pricing.snapshot, p.pricing.hash)
  )
    fail('The original pricing-engine snapshot and native hash must agree.');
  p.additionalPremium = cashAmount(p.additionalPremium, p.decimalScale);
  p.returnPremium = cashAmount(p.returnPremium, p.decimalScale);
  if (units(p.additionalPremium) > 0n && units(p.returnPremium) > 0n)
    fail('One source change cannot be both a debit and a return premium.');
  for (const k of ['taxDifference', 'feeDifference', 'commissionDifference'])
    if (p[k] !== null) p[k] = signedChangeAmount(p[k], p.decimalScale);
  if (p.taxEvidenceHash !== null)
    p.taxEvidenceHash = controlHash(p.taxEvidenceHash);
  if (!['MATCHED', 'UNRESOLVED'].includes(p.invoiceReconciliation))
    fail('Declare invoice reconciliation explicitly.');
  if (p.taxLines !== null) {
    if (!Array.isArray(p.taxLines) || p.taxLines.length > 100)
      fail('Tax and levy lines must remain distinct.');
    const keys = new Set();
    p.taxLines = p.taxLines.map((line: any) => {
      fields(line, ['code', 'kind', 'amount', 'ruleHash']);
      if (!['TAX', 'LEVY'].includes(line.kind))
        fail('Unsupported tax component kind.');
      const code = cashText(line.code, 80),
        key = line.kind + '/' + code;
      if (keys.has(key)) fail('Duplicate tax/levy components are not allowed.');
      keys.add(key);
      return {
        code,
        kind: line.kind,
        amount: signedChangeAmount(line.amount, p.decimalScale),
        ruleHash: controlHash(line.ruleHash),
      };
    });
    if (
      p.taxDifference === null ||
      p.taxLines.reduce(
        (n: bigint, l: any) => n + signedUnits(l.amount),
        0n,
      ) !== signedUnits(p.taxDifference)
    )
      fail('Tax/levy lines must reconcile their signed source aggregate.');
  }
  return p;
}
export function changeVector(p: PolicyChangeEvidence) {
  const vector: any = cashObject(p);
  delete vector.sourceRevision;
  delete vector.workflowRevision;
  return vector;
}
export function changeIssues(p: PolicyChangeEvidence): string[] {
  const issues: string[] = [];
  if (
    p.taxDifference === null ||
    p.taxLines === null ||
    p.taxEvidenceHash === null ||
    p.feeDifference === null ||
    p.commissionDifference === null
  )
    issues.push('SOURCE_COMPONENT_BREAKDOWN_UNRESOLVED');
  if (p.invoiceReconciliation !== 'MATCHED')
    issues.push('SOURCE_INVOICE_RECONCILIATION_REQUIRED');
  return issues;
}
export function payableDifference(p: PolicyChangeEvidence) {
  return units(p.additionalPremium) - units(p.returnPremium);
}
export function entitlementDifference(p: PolicyChangeEvidence) {
  return p.effect === 'NORMAL' ? units(p.returnPremium) : -payableDifference(p);
}
export function netPremiumDifference(p: PolicyChangeEvidence) {
  return p.taxDifference === null || p.feeDifference === null
    ? null
    : amount(
        payableDifference(p) -
          signedUnits(p.taxDifference) -
          signedUnits(p.feeDifference),
      );
}
export function normalizeRefundPlan(value: unknown, scale: number): RefundPlan {
  const p: any = cashObject(value);
  fields(p, [
    'commandKey',
    'change',
    'assignment',
    'amount',
    'beneficiary',
    'expiresAt',
  ]);
  p.commandKey = cashText(p.commandKey, 150);
  p.change = changeRef(p.change);
  p.assignment = changeRef(p.assignment);
  p.amount = cashAmount(p.amount, scale, true);
  p.beneficiary = normalizeBeneficiary(p.beneficiary);
  if (p.beneficiary.mode !== 'REFERENCED')
    fail('Refunds require a frozen referenced beneficiary.');
  if (
    typeof p.expiresAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.expiresAt) ||
    !Number.isFinite(Date.parse(p.expiresAt)) ||
    new Date(p.expiresAt).toISOString() !== p.expiresAt
  )
    fail('A canonical refund approval expiry is required.');
  return p;
}
