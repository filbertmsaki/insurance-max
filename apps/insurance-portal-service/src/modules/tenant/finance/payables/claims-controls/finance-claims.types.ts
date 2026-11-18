import { BadRequestException } from '@nestjs/common';
import {
  approvalFields as validateFields,
  normalizeBeneficiary,
  type BeneficiaryEvidence,
} from '../../governance/finance-approvals/finance-approval.types';
import { cashObject, cashAmount, cashText } from '../outgoing-payments/finance-outgoing.types';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import {
  controlUuid,
  controlHash,
  controlDate,
  controlCurrency,
  controlScale,
  controlUnits as units,
  controlAmount as amount,
} from '../../receivables/receivable-controls/finance-receivables.types';
import {
  changeRef,
  signedChangeAmount,
  signedUnits,
  type ChangeRef,
} from '../../governance/accounting-policies/finance-policy-change.types';
export const CLAIMS_EVENT = 'source.claims.evidence-snapshotted.v1';
export interface CaseVector {
  approvedLimit: string;
  acceptedOffer: string | null;
  voucher: { id: string; version: number; hash: string } | null;
  paidIndemnity: string;
  paidExpenses: string;
  legacyReserved: string;
  caseEstimateIncludingPaid: string;
  caseOutstanding: string;
  ibnr: string | null;
  expenseOutstanding: string | null;
  riskAdjustment: string | null;
  discount: string | null;
  fullLicTarget: string | null;
}
export interface PayableVector {
  amount: string;
  legacyPaid: string;
  legacyReserved: string;
  component: 'INDEMNITY' | 'EXPENSE';
  sourceApproved: boolean;
  beneficiary: BeneficiaryEvidence;
  taxEvidenceHash: string | null;
  writer: 'LEGACY_ACTIVE' | 'HANDOFF_RECONCILED';
  writerEvidenceHash: string | null;
}
export interface RecoveryVector {
  type: 'SALVAGE' | 'SUBROGATION' | 'CONTRIBUTION' | 'OTHER' | 'REINSURANCE';
  expected: string;
  legacyReceived: string;
  debtorId: string | null;
  legalStatus: 'UNRESOLVED' | 'ESTABLISHED' | 'DISPUTED';
  legalEvidenceHash: string | null;
}
export interface ClaimsEvidence {
  schema: 'FINANCE_CLAIMS_V1';
  kind: 'CASE' | 'PAYABLE' | 'RECOVERY';
  id: string;
  sourceRevision: number;
  sourceCompanyId: string;
  claimId: string;
  policyId: string;
  previous: ChangeRef | null;
  caseRef: ChangeRef | null;
  effectiveDate: string;
  currency: string;
  decimalScale: number;
  source: { snapshot: Record<string, unknown>; hash: string };
  data: CaseVector | PayableVector | RecoveryVector;
}
const fields = (v: unknown, keys: string[]): void => validateFields(v, keys);
const fail = (m: string): never => {
  throw new BadRequestException(m);
};
export function normalizeClaims(value: unknown): ClaimsEvidence {
  const p: any = cashObject(value);
  fields(p, [
    'schema',
    'kind',
    'id',
    'sourceRevision',
    'sourceCompanyId',
    'claimId',
    'policyId',
    'previous',
    'caseRef',
    'effectiveDate',
    'currency',
    'decimalScale',
    'source',
    'data',
  ]);
  if (
    p.schema !== 'FINANCE_CLAIMS_V1' ||
    !['CASE', 'PAYABLE', 'RECOVERY'].includes(p.kind) ||
    !Number.isInteger(p.sourceRevision) ||
    p.sourceRevision < 1 ||
    p.sourceRevision > 2147483647
  )
    fail('Exact versioned claims evidence is required.');
  for (const k of ['id', 'sourceCompanyId', 'claimId', 'policyId'])
    p[k] = controlUuid(p[k]);
  p.previous = p.previous === null ? null : changeRef(p.previous);
  p.caseRef = p.caseRef === null ? null : changeRef(p.caseRef);
  if (
    (p.kind === 'CASE') !== (p.caseRef === null) ||
    (p.kind === 'CASE' && p.id !== p.claimId)
  )
    fail(
      'Payables/recoveries require an exact reviewed case; case identity must equal the claim.',
    );
  p.effectiveDate = controlDate(p.effectiveDate);
  p.currency = controlCurrency(p.currency);
  p.decimalScale = controlScale(p.decimalScale);
  fields(p.source, ['snapshot', 'hash']);
  p.source.snapshot = cashObject(p.source.snapshot);
  p.source.hash = controlHash(p.source.hash);
  if (hash(p.source.snapshot) !== p.source.hash)
    fail('Native claims evidence hash differs.');
  const d = p.data;
  if (p.kind === 'CASE') {
    fields(d, [
      'approvedLimit',
      'acceptedOffer',
      'voucher',
      'paidIndemnity',
      'paidExpenses',
      'legacyReserved',
      'caseEstimateIncludingPaid',
      'caseOutstanding',
      'ibnr',
      'expenseOutstanding',
      'riskAdjustment',
      'discount',
      'fullLicTarget',
    ]);
    for (const k of [
      'approvedLimit',
      'paidIndemnity',
      'paidExpenses',
      'legacyReserved',
      'caseEstimateIncludingPaid',
    ])
      d[k] = cashAmount(d[k], p.decimalScale);
    d.caseOutstanding = signedChangeAmount(d.caseOutstanding, p.decimalScale);
    if (
      signedUnits(d.caseOutstanding) !==
      units(d.caseEstimateIncludingPaid) -
        units(d.paidIndemnity) -
        units(d.paidExpenses)
    )
      fail(
        'Case estimate including paid must reconcile paid and signed outstanding amounts without flooring.',
      );
    for (const k of [
      'acceptedOffer',
      'ibnr',
      'expenseOutstanding',
      'riskAdjustment',
      'fullLicTarget',
    ])
      if (d[k] !== null) d[k] = cashAmount(d[k], p.decimalScale);
    if (d.discount !== null)
      d.discount = signedChangeAmount(d.discount, p.decimalScale);
    if (d.voucher !== null) {
      fields(d.voucher, ['id', 'version', 'hash']);
      d.voucher.id = controlUuid(d.voucher.id);
      d.voucher.hash = controlHash(d.voucher.hash);
      if (!Number.isInteger(d.voucher.version) || d.voucher.version < 1)
        fail('Positive accepted-voucher version required.');
    }
    if ((d.voucher === null) !== (d.acceptedOffer === null))
      fail('Accepted offer and voucher evidence must be supplied together.');
  } else if (p.kind === 'PAYABLE') {
    fields(d, [
      'amount',
      'legacyPaid',
      'legacyReserved',
      'component',
      'sourceApproved',
      'beneficiary',
      'taxEvidenceHash',
      'writer',
      'writerEvidenceHash',
    ]);
    for (const k of ['amount', 'legacyPaid', 'legacyReserved'])
      d[k] = cashAmount(d[k], p.decimalScale);
    if (
      !['INDEMNITY', 'EXPENSE'].includes(d.component) ||
      typeof d.sourceApproved !== 'boolean' ||
      !['LEGACY_ACTIVE', 'HANDOFF_RECONCILED'].includes(d.writer)
    )
      fail(
        'Explicit payment component, source approval and writer ownership are required.',
      );
    d.beneficiary = normalizeBeneficiary(d.beneficiary);
    if (d.beneficiary.mode !== 'REFERENCED')
      fail('A referenced claim payee is required.');
    for (const k of ['taxEvidenceHash', 'writerEvidenceHash'])
      if (d[k] !== null) d[k] = controlHash(d[k]);
    if (d.writer === 'HANDOFF_RECONCILED' && d.writerEvidenceHash === null)
      fail('A reconciled writer handoff needs explicit evidence.');
  } else {
    fields(d, [
      'type',
      'expected',
      'legacyReceived',
      'debtorId',
      'legalStatus',
      'legalEvidenceHash',
    ]);
    if (
      ![
        'SALVAGE',
        'SUBROGATION',
        'CONTRIBUTION',
        'OTHER',
        'REINSURANCE',
      ].includes(d.type) ||
      !['UNRESOLVED', 'ESTABLISHED', 'DISPUTED'].includes(d.legalStatus)
    )
      fail('Explicit recovery classification and legal status required.');
    d.expected = cashAmount(d.expected, p.decimalScale);
    d.legacyReceived = cashAmount(d.legacyReceived, p.decimalScale);
    d.debtorId = d.debtorId === null ? null : controlUuid(d.debtorId);
    d.legalEvidenceHash =
      d.legalEvidenceHash === null ? null : controlHash(d.legalEvidenceHash);
  }
  const projection: any = cashObject(p.source.snapshot.financeProjection),
    expected = claimsProjection(p);
  if (!projection.data || typeof projection.data !== 'object')
    fail('Source-owned financial projection is required.');
  for (const key of Object.keys(d))
    if (typeof d[key] === 'string' && /^-?\d+\.\d{12}$/.test(d[key]))
      projection.data[key] = signedChangeAmount(
        projection.data[key],
        p.decimalScale,
      );
  if (hash(projection) !== hash(expected))
    fail(
      'Claims components differ from the source-owned financial projection.',
    );
  return p;
}
function claimsProjection(p: ClaimsEvidence) {
  return {
    kind: p.kind,
    id: p.id,
    claimId: p.claimId,
    policyId: p.policyId,
    sourceCompanyId: p.sourceCompanyId,
    currency: p.currency,
    decimalScale: p.decimalScale,
    data: p.data,
  };
}
/** Used only by native source adapters/producers; intake always verifies the resulting signed bytes. */
export function sealClaimsSource(
  p: Omit<ClaimsEvidence, 'source'>,
  native: Record<string, unknown>,
): ClaimsEvidence {
  const snapshot = {
    native,
    financeProjection: claimsProjection(p as ClaimsEvidence),
  };
  return normalizeClaims({ ...p, source: { snapshot, hash: hash(snapshot) } });
}
export function claimsVector(p: ClaimsEvidence) {
  const v: any = cashObject(p);
  delete v.sourceRevision;
  delete v.previous;
  return v;
}
export function claimsIssues(p: ClaimsEvidence): string[] {
  const d: any = p.data,
    issues: string[] = [];
  if (p.kind === 'PAYABLE') {
    if (!d.sourceApproved) issues.push('SOURCE_PAYMENT_NOT_APPROVED');
    if (d.taxEvidenceHash === null) issues.push('CLAIM_PAYMENT_TAX_UNRESOLVED');
  }
  if (p.kind === 'RECOVERY') {
    if (d.type === 'REINSURANCE')
      issues.push('REINSURANCE_RECOVERY_REQUIRES_B19');
    if (
      d.legalStatus !== 'ESTABLISHED' ||
      d.legalEvidenceHash === null ||
      d.debtorId === null
    )
      issues.push('RECOVERY_RIGHT_OR_DEBTOR_UNRESOLVED');
  }
  return issues;
}
export function claimLimit(d: CaseVector): bigint {
  return d.acceptedOffer === null
    ? 0n
    : units(d.approvedLimit) < units(d.acceptedOffer)
      ? units(d.approvedLimit)
      : units(d.acceptedOffer);
}
export function claimsReviewAmount(p: ClaimsEvidence): string {
  const d: any = p.data;
  const values: string[] =
    p.kind === 'CASE'
      ? [
          d.caseEstimateIncludingPaid,
          d.approvedLimit,
          d.acceptedOffer ?? '0',
          amount(
            units(d.paidIndemnity) +
              units(d.paidExpenses) +
              units(d.legacyReserved),
          ),
        ]
      : p.kind === 'PAYABLE'
        ? [d.amount, amount(units(d.legacyPaid) + units(d.legacyReserved))]
        : [d.expected, d.legacyReceived];
  return amount(
    values.reduce(
      (maximum, v) => (units(v) > maximum ? units(v) : maximum),
      0n,
    ),
  );
}
/** Comparison proposal only: never posts a target, assumes a zero IBNR, or recognises settlement expense. */
export function licComparison(d: CaseVector) {
  const base = signedUnits(d.caseOutstanding),
    known =
      d.ibnr !== null &&
      d.expenseOutstanding !== null &&
      d.riskAdjustment !== null &&
      d.discount !== null &&
      d.fullLicTarget !== null;
  return {
    state: known
      ? 'MEASUREMENT_POLICY_HELD'
      : 'MEASUREMENT_COMPONENTS_UNRESOLVED',
    caseOutstanding: amount(base),
    ibnr: d.ibnr,
    expenseOutstanding: d.expenseOutstanding,
    riskAdjustment: d.riskAdjustment,
    discount: d.discount,
    fullLicTarget: d.fullLicTarget,
    remainingMeasurementDelta: known
      ? amount(units(d.fullLicTarget!) - base)
      : null,
    postingEffects: 0,
    settlementExpenseEffects: 0,
  };
}
