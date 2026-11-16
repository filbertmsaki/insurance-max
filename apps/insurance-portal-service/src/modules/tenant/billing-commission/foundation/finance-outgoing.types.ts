import { BadRequestException } from '@nestjs/common';
import {
  approvalFields as validateFields,
  normalizeBeneficiary,
  type BeneficiaryEvidence,
} from './finance-approval.types';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from './finance-configuration.types';
import {
  candidateAmount,
  candidateText,
} from './finance-journal-candidate.types';
import {
  controlCurrency,
  controlDate,
  controlHash,
  controlScale,
  controlUuid,
} from './finance-receivables.types';

export const OUTGOING_EVENT = 'source.outgoing.evidence-snapshotted.v1';
export const OUTGOING_SIMULATORS = Symbol('FINANCE_OUTGOING_SIMULATORS');
export const OUTGOING_HOLDS = Object.freeze([
  'UNRESOLVED_ACCOUNTING_POLICIES',
  'INACTIVE_CONTROLS_ONLY',
  'LEGAL_DISCHARGE_HELD',
  'LEGACY_CASH_WRITER_NOT_MIGRATED',
]);
export type CashPermission =
  | 'OBSERVE_CASH'
  | 'PREPARE_PAYMENT'
  | 'REVIEW_PAYMENT'
  | 'RESERVE_CASH'
  | 'EXECUTE_SIMULATION'
  | 'RECONCILE_CASH'
  | 'READ_CASH';
interface BaseEvidence {
  schema: 'FINANCE_OUTGOING_EVIDENCE_V1';
  id: string;
  sourceRevision: 1;
  sourceCompanyId: string;
  sourceAccountId: string;
  currency: string;
  decimalScale: number;
}
export interface FundingEvidence extends BaseEvidence {
  kind: 'FUNDING';
  providerCode: string;
  providerAccountReference: string;
  available: string;
  clearedBalance: string;
  legacyReserved: string;
  legacyCommitted: string;
  unavailable: string;
  asOf: string;
  sourceEvidenceHash: string;
}
export interface ObligationEvidence extends BaseEvidence {
  kind: 'OBLIGATION';
  obligationId: string;
  amount: string;
  beneficiary: BeneficiaryEvidence;
  entitlementEvidenceHash: string;
}
export interface BankPaymentEvidence extends BaseEvidence {
  kind: 'BANK_PAYMENT';
  executionKey: string;
  providerCode: string;
  providerAccountReference: string;
  providerPaymentId: string;
  beneficiaryHash: string;
  amount: string;
  fee: string;
  valueDate: string;
  bankEvidenceHash: string;
}
export type OutgoingEvidence =
  | FundingEvidence
  | ObligationEvidence
  | BankPaymentEvidence;
export interface PaymentPlan {
  commandKey: string;
  fundingId: string;
  fundingHash: string;
  obligationId: string;
  obligationHash: string;
  amount: string;
  maximumFee: string;
  beneficiaryHash: string;
  expiresAt: string;
}
export type ProviderState =
  | 'PENDING'
  | 'UNKNOWN'
  | 'NOT_FOUND'
  | 'FAILED_FINAL'
  | 'CONFIRMED';
export interface CashProviderRequest {
  executionKey: string;
  providerCode: string;
  providerAccountReference: string;
  beneficiaryHash: string;
  beneficiary: BeneficiaryEvidence;
  amount: string;
  maximumFee: string;
  currency: string;
  decimalScale: number;
}
export interface CashProviderOutcome {
  executionKey: string;
  providerCode: string;
  providerAccountReference: string;
  beneficiaryHash: string;
  currency: string;
  amount: string;
  fee: string;
  state: ProviderState;
  providerPaymentId: string | null;
  evidenceHash: string;
}
/** Trusted test-only adapters. No real provider is registered by the application. */
export interface CashSimulationAdapter {
  readonly purpose: 'ISOLATED_TEST_SIMULATOR_ONLY';
  readonly providerCode: string;
  submit(request: CashProviderRequest): Promise<CashProviderOutcome>;
  query(request: CashProviderRequest): Promise<CashProviderOutcome>;
}
export function cashObject<T>(v: T): T {
  return JSON.parse(canonicalFinanceJson(v));
}
function approvalFields(value: unknown, keys: string[]): void {
  validateFields(value, keys);
}
export function cashText(v: unknown, max = 200): string {
  if (!candidateText(v, max))
    throw new BadRequestException(
      'Exact outgoing-cash references are required.',
    );
  return v;
}
export function cashAmount(
  v: unknown,
  scale: number,
  positive = false,
): string {
  const amount = candidateAmount(v, scale).stored;
  if (amount.split('.')[0].length > 18)
    throw new BadRequestException(
      'Outgoing amount exceeds exact storage capacity.',
    );
  if (positive && BigInt(amount.replace('.', '')) <= 0n)
    throw new BadRequestException(
      'A positive exact payment amount is required.',
    );
  return amount;
}
export function normalizeCashEvidence(value: unknown): OutgoingEvidence {
  const p: any = cashObject(value);
  const base = [
    'schema',
    'kind',
    'id',
    'sourceRevision',
    'sourceCompanyId',
    'sourceAccountId',
    'currency',
    'decimalScale',
  ];
  const extra =
    p?.kind === 'FUNDING'
      ? [
          'providerCode',
          'providerAccountReference',
          'available',
          'clearedBalance',
          'legacyReserved',
          'legacyCommitted',
          'unavailable',
          'asOf',
          'sourceEvidenceHash',
        ]
      : p?.kind === 'OBLIGATION'
        ? ['obligationId', 'amount', 'beneficiary', 'entitlementEvidenceHash']
        : p?.kind === 'BANK_PAYMENT'
          ? [
              'executionKey',
              'providerCode',
              'providerAccountReference',
              'providerPaymentId',
              'beneficiaryHash',
              'amount',
              'fee',
              'valueDate',
              'bankEvidenceHash',
            ]
          : null;
  if (!extra)
    throw new BadRequestException('Unsupported outgoing-cash evidence kind.');
  approvalFields(p, [...base, ...extra]);
  if (p.schema !== 'FINANCE_OUTGOING_EVIDENCE_V1' || p.sourceRevision !== 1)
    throw new BadRequestException(
      'Versioned outgoing-cash source evidence is required.',
    );
  for (const k of ['id', 'sourceCompanyId', 'sourceAccountId'])
    p[k] = controlUuid(p[k]);
  p.currency = controlCurrency(p.currency);
  p.decimalScale = controlScale(p.decimalScale);
  if (p.kind === 'FUNDING') {
    p.available = cashAmount(p.available, p.decimalScale);
    for (const key of [
      'clearedBalance',
      'legacyReserved',
      'legacyCommitted',
      'unavailable',
    ])
      p[key] = cashAmount(p[key], p.decimalScale);
    const n = (v: string) => BigInt(v.replace('.', ''));
    if (
      n(p.available) !==
      n(p.clearedBalance) -
        n(p.legacyReserved) -
        n(p.legacyCommitted) -
        n(p.unavailable)
    )
      throw new BadRequestException(
        'Funding capacity must reconcile cleared cash, legacy commitments and unavailable funds.',
      );
    p.asOf = controlDate(p.asOf);
    p.sourceEvidenceHash = controlHash(p.sourceEvidenceHash);
  } else {
    p.amount = cashAmount(p.amount, p.decimalScale, true);
    if (p.kind === 'OBLIGATION') {
      p.obligationId = controlUuid(p.obligationId);
      p.beneficiary = normalizeBeneficiary(p.beneficiary);
      if (p.beneficiary.mode !== 'REFERENCED')
        throw new BadRequestException(
          'Outgoing obligations require a referenced beneficiary.',
        );
      p.entitlementEvidenceHash = controlHash(p.entitlementEvidenceHash);
    } else {
      p.executionKey = cashText(p.executionKey);
      p.providerPaymentId = cashText(p.providerPaymentId);
      p.fee = cashAmount(p.fee, p.decimalScale);
      p.beneficiaryHash = controlHash(p.beneficiaryHash);
      p.valueDate = controlDate(p.valueDate);
      p.bankEvidenceHash = controlHash(p.bankEvidenceHash);
    }
  }
  if (p.kind !== 'OBLIGATION') {
    p.providerCode = cashText(p.providerCode, 80);
    p.providerAccountReference = cashText(p.providerAccountReference);
  }
  return p;
}
/** Global economic identity excludes the accounting book and delivery alias. */
export function cashEconomicKey(v: OutgoingEvidence): string {
  return hash({
    company: v.sourceCompanyId,
    kind: v.kind,
    key:
      v.kind === 'FUNDING'
        ? [v.sourceAccountId, v.currency]
        : v.kind === 'OBLIGATION'
          ? v.obligationId
          : [v.providerCode, v.providerAccountReference, v.providerPaymentId],
  });
}
export function cashEvidenceVector(v: OutgoingEvidence): string {
  const vector: any = cashObject(v);
  delete vector.id;
  return hash(vector);
}
export function normalizePaymentPlan(
  value: unknown,
  scale: number,
): PaymentPlan {
  const p: any = cashObject(value);
  approvalFields(p, [
    'commandKey',
    'fundingId',
    'fundingHash',
    'obligationId',
    'obligationHash',
    'amount',
    'maximumFee',
    'beneficiaryHash',
    'expiresAt',
  ]);
  p.commandKey = cashText(p.commandKey, 150);
  p.fundingId = controlUuid(p.fundingId);
  p.obligationId = controlUuid(p.obligationId);
  for (const k of ['fundingHash', 'obligationHash', 'beneficiaryHash'])
    p[k] = controlHash(p[k]);
  p.amount = cashAmount(p.amount, scale, true);
  p.maximumFee = cashAmount(p.maximumFee, scale);
  if (
    typeof p.expiresAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.expiresAt) ||
    !Number.isFinite(Date.parse(p.expiresAt))
  )
    throw new BadRequestException('An exact UTC approval expiry is required.');
  return p;
}
export function normalizeCashOutcome(
  value: unknown,
  scale: number,
): CashProviderOutcome {
  const p: any = cashObject(value);
  approvalFields(p, [
    'executionKey',
    'providerCode',
    'providerAccountReference',
    'beneficiaryHash',
    'currency',
    'amount',
    'fee',
    'state',
    'providerPaymentId',
    'evidenceHash',
  ]);
  for (const k of ['executionKey', 'providerAccountReference'])
    p[k] = cashText(p[k]);
  p.providerCode = cashText(p.providerCode, 80);
  p.beneficiaryHash = controlHash(p.beneficiaryHash);
  p.evidenceHash = controlHash(p.evidenceHash);
  p.currency = controlCurrency(p.currency);
  p.amount = cashAmount(p.amount, scale);
  p.fee = cashAmount(p.fee, scale);
  if (
    !['PENDING', 'UNKNOWN', 'NOT_FOUND', 'FAILED_FINAL', 'CONFIRMED'].includes(
      p.state,
    ) ||
    (p.providerPaymentId !== null && !candidateText(p.providerPaymentId, 200))
  )
    throw new BadRequestException('An explicit provider outcome is required.');
  if (
    p.state === 'CONFIRMED' &&
    (!p.providerPaymentId || BigInt(p.amount.replace('.', '')) <= 0n)
  )
    throw new BadRequestException(
      'Confirmed cash requires a payment reference and positive amount.',
    );
  if (
    p.state === 'FAILED_FINAL' &&
    (BigInt(p.amount.replace('.', '')) !== 0n ||
      BigInt(p.fee.replace('.', '')) !== 0n)
  )
    throw new BadRequestException(
      'Definitive failure must certify no funds moved.',
    );
  return p;
}
