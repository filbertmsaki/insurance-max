import { BadRequestException } from '@nestjs/common';
import {
  approvalFields as validateFields,
  normalizeBeneficiary,
  type BeneficiaryEvidence,
} from './finance-approval.types';
import { cashObject, cashAmount, cashText } from './finance-outgoing.types';
import {
  controlUuid,
  controlHash,
  controlDate,
  controlCurrency,
  controlScale,
} from './finance-receivables.types';
import {
  changeRef,
  signedChangeAmount,
  signedUnits,
  type ChangeRef,
} from './finance-policy-change.types';

export const COMMISSION_EVENT = 'source.commission.evidence-snapshotted.v1';
const approvalFields = (v: unknown, keys: string[]): void =>
  validateFields(v, keys);
/** Source calculation evidence, not permission to recognise a payable, expense or IFRS 17 asset. */
export interface CommissionEvidence {
  schema: 'FINANCE_COMMISSION_V1';
  id: string;
  sourceRevision: number;
  commissionId: string;
  sourceCompanyId: string;
  partyId: string;
  quotationId: string;
  policyId: string | null;
  originalBilling: ChangeRef;
  previous: ChangeRef | null;
  policyChange: ChangeRef | null;
  effect: 'INITIAL' | 'POLICY_CHANGE' | 'REVERSAL';
  reverses: ChangeRef | null;
  effectiveDate: string;
  currency: string;
  decimalScale: number;
  commissionDelta: string;
  taxDelta: string | null;
  withholdingDelta: string | null;
  payableDelta: string | null;
  taxEvidenceHash: string | null;
  calculation: { snapshot: Record<string, unknown>; hash: string };
  legacyPaid: string;
  legacyReserved: string;
  legacyEvidenceHash: string;
  beneficiary: BeneficiaryEvidence;
  acquisition: {
    classification:
      | 'UNASSESSED'
      | 'PROPOSED_ATTRIBUTABLE'
      | 'PROPOSED_NON_ATTRIBUTABLE';
    evidenceHash: string | null;
    allocationReference: string | null;
  };
}
const fail = (m: string): never => {
  throw new BadRequestException(m);
};
export function normalizeCommission(value: unknown): CommissionEvidence {
  const p: any = cashObject(value);
  approvalFields(p, [
    'schema',
    'id',
    'sourceRevision',
    'commissionId',
    'sourceCompanyId',
    'partyId',
    'quotationId',
    'policyId',
    'originalBilling',
    'previous',
    'policyChange',
    'effect',
    'reverses',
    'effectiveDate',
    'currency',
    'decimalScale',
    'commissionDelta',
    'taxDelta',
    'withholdingDelta',
    'payableDelta',
    'taxEvidenceHash',
    'calculation',
    'legacyPaid',
    'legacyReserved',
    'legacyEvidenceHash',
    'beneficiary',
    'acquisition',
  ]);
  if (
    p.schema !== 'FINANCE_COMMISSION_V1' ||
    !Number.isInteger(p.sourceRevision) ||
    p.sourceRevision < 1 ||
    p.sourceRevision > 2147483647
  )
    fail('Exact versioned commission evidence is required.');
  for (const k of [
    'id',
    'commissionId',
    'sourceCompanyId',
    'partyId',
    'quotationId',
  ])
    p[k] = controlUuid(p[k]);
  p.policyId = p.policyId === null ? null : controlUuid(p.policyId);
  for (const k of ['originalBilling', 'previous', 'policyChange', 'reverses'])
    p[k] = p[k] === null && k !== 'originalBilling' ? null : changeRef(p[k]);
  if (
    !['INITIAL', 'POLICY_CHANGE', 'REVERSAL'].includes(p.effect) ||
    (p.effect === 'INITIAL') !== (p.previous === null) ||
    (p.effect === 'REVERSAL') !== (p.reverses !== null) ||
    (p.effect !== 'INITIAL' && (p.policyChange === null || p.policyId === null))
  )
    fail(
      'Adjustments and reversals require a previous entitlement and an applied policy-change reference.',
    );
  p.effectiveDate = controlDate(p.effectiveDate);
  p.currency = controlCurrency(p.currency);
  p.decimalScale = controlScale(p.decimalScale);
  for (const k of [
    'commissionDelta',
    'taxDelta',
    'withholdingDelta',
    'payableDelta',
  ])
    p[k] =
      p[k] === null && k !== 'commissionDelta'
        ? null
        : signedChangeAmount(p[k], p.decimalScale);
  if (p.effect === 'INITIAL' && signedUnits(p.commissionDelta) < 0n)
    fail('An initial commission cannot be negative.');
  if (
    p.taxDelta !== null &&
    p.withholdingDelta !== null &&
    p.payableDelta !== null &&
    signedUnits(p.commissionDelta) +
      signedUnits(p.taxDelta) -
      signedUnits(p.withholdingDelta) !==
      signedUnits(p.payableDelta)
  )
    fail('Commission, tax and withholding must reconcile the payable.');
  p.taxEvidenceHash =
    p.taxEvidenceHash === null ? null : controlHash(p.taxEvidenceHash);
  approvalFields(p.calculation, ['snapshot', 'hash']);
  p.calculation.snapshot = cashObject(p.calculation.snapshot);
  p.calculation.hash = controlHash(p.calculation.hash);
  const calculated =
    p.calculation.snapshot[
      p.effect === 'INITIAL' ? 'commissionAmount' : 'commissionDifference'
    ];
  if (
    signedUnits(signedChangeAmount(calculated, p.decimalScale)) !==
    signedUnits(p.commissionDelta)
  )
    fail('Native calculation amount differs from the commission movement.');
  // Native pricing hashes are checked by the source adapter; this contract carries that evidence unchanged.
  p.legacyPaid = cashAmount(p.legacyPaid, p.decimalScale);
  p.legacyReserved = cashAmount(p.legacyReserved, p.decimalScale);
  p.legacyEvidenceHash = controlHash(p.legacyEvidenceHash);
  p.beneficiary = normalizeBeneficiary(p.beneficiary);
  if (
    p.beneficiary.mode !== 'REFERENCED' ||
    p.beneficiary.referenceId !== p.partyId
  )
    fail('A referenced beneficiary must identify the exact commission party.');
  approvalFields(p.acquisition, [
    'classification',
    'evidenceHash',
    'allocationReference',
  ]);
  if (
    ![
      'UNASSESSED',
      'PROPOSED_ATTRIBUTABLE',
      'PROPOSED_NON_ATTRIBUTABLE',
    ].includes(p.acquisition.classification)
  )
    fail('Acquisition classification is a proposal only.');
  p.acquisition.evidenceHash =
    p.acquisition.evidenceHash === null
      ? null
      : controlHash(p.acquisition.evidenceHash);
  p.acquisition.allocationReference =
    p.acquisition.allocationReference === null
      ? null
      : cashText(p.acquisition.allocationReference, 200);
  if (
    p.acquisition.classification !== 'UNASSESSED' &&
    (!p.acquisition.evidenceHash || !p.acquisition.allocationReference)
  )
    fail(
      'Proposed acquisition classification requires attribution and allocation evidence.',
    );
  return p;
}
export function commissionIssues(p: CommissionEvidence): string[] {
  return p.taxDelta === null ||
    p.withholdingDelta === null ||
    p.payableDelta === null ||
    p.taxEvidenceHash === null
    ? ['COMMISSION_TAX_BREAKDOWN_UNRESOLVED']
    : [];
}
export function commissionVector(p: CommissionEvidence) {
  const v: any = cashObject(p);
  delete v.sourceRevision;
  return v;
}
