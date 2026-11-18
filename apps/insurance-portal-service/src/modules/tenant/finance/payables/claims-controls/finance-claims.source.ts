import { ConflictException } from '@nestjs/common';
import { ClaimPaymentType } from '@insurance-max/contracts';
import type { EntityManager } from 'typeorm';
import type { BeneficiaryEvidence } from '../../governance/finance-approvals/finance-approval.types';
import type { ChangeRef } from '../../governance/accounting-policies/finance-policy-change.types';
import { cashAmount } from '../outgoing-payments/finance-outgoing.types';
import {
  controlUuid,
  controlScale,
  controlUnits as units,
  controlAmount as amount,
} from '../../receivables/receivable-controls/finance-receivables.types';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import { integrationSnapshot } from '../../integrations/finance-events/finance-integration.controls';
import { sealClaimsSource, type ClaimsEvidence } from './finance-claims.types';
interface NativeInput {
  companyId: string;
  claimId: string;
  sourceRevision: number;
  decimalScale: number;
  effectiveDate: string;
  previous: ChangeRef | null;
}
const fail = (message: string): never => {
  throw new ConflictException(message);
};
async function claim(
  m: EntityManager,
  input: NativeInput,
): Promise<Record<string, any>> {
  if (!m.queryRunner?.isTransactionActive)
    fail('A transaction-bound native claims snapshot is required.');
  const [c] = await m.query(
    'SELECT id,company_id,insurer_company_id,intermediary_company_id,branch_id,sale_point_id,policy_id,policy_risk_id,customer_id,claim_no,claim_report_date,loss_date,loss_type,currency_code,exchange_rate,status,approved_amount,gross_case_reserve,paid_amount,outstanding_reserve,coverage_status,tiramis_status FROM claims WHERE company_id=$1 AND id=$2 FOR SHARE',
    [controlUuid(input.companyId), controlUuid(input.claimId)],
  );
  if (!c) fail('Native claim is unavailable in this company.');
  return integrationSnapshot(c);
}
function base(c: any, input: NativeInput) {
  return {
    schema: 'FINANCE_CLAIMS_V1' as const,
    id: c.id,
    sourceRevision: input.sourceRevision,
    sourceCompanyId: c.company_id,
    claimId: c.id,
    policyId: c.policy_id,
    previous: input.previous,
    caseRef: null,
    effectiveDate: input.effectiveDate,
    currency: c.currency_code,
    decimalScale: controlScale(input.decimalScale),
  };
}
/** Read-only projection: the native reserve ledger and payment/disbursement records remain authoritative facts. */
export async function readClaimCaseSource(
  m: EntityManager,
  input: NativeInput,
): Promise<ClaimsEvidence> {
  const c = await claim(m, input),
    scale = controlScale(input.decimalScale),
    n = (v: unknown) => units(cashAmount(v, scale));
  const movements = await m.query(
    'SELECT id,company_id,claim_id,reserve_id,movement_type,amount,signed_amount,currency_code,source_event_id FROM claim_reserve_movements WHERE claim_id=$1 ORDER BY id FOR SHARE',
    [c.id],
  );
  const payments = await m.query(
    'SELECT p.id,p.company_id,p.claim_id,p.currency_code,p.payment_type,p.paid_amount,p.status,p.finance_disbursement_id,d.status AS disbursement_status,d.amount AS disbursement_amount,d.currency_code AS disbursement_currency FROM claim_payments p LEFT JOIN claim_disbursements d ON d.id=p.finance_disbursement_id AND d.company_id=p.company_id AND d.claim_payment_id=p.id AND d.claim_id=p.claim_id WHERE p.claim_id=$1 ORDER BY p.id FOR SHARE OF p',
    [c.id],
  );
  const vouchers = await m.query(
    "SELECT id,company_id,claim_id,version,claim_offer_amount,currency_code,offer_accepted,status FROM claim_discharge_vouchers WHERE claim_id=$1 AND status='ACCEPTED' ORDER BY version DESC,id FOR SHARE",
    [c.id],
  );
  let estimate = 0n,
    indemnity = 0n,
    expenses = 0n,
    reserved = 0n;
  for (const r of movements) {
    if (
      r.company_id !== c.company_id ||
      r.currency_code !== c.currency_code ||
      typeof r.signed_amount !== 'string'
    )
      fail('Native reserve scope, currency or signed movement is unresolved.');
    const signed = r.signed_amount.startsWith('-')
      ? -n(r.signed_amount.slice(1))
      : n(r.signed_amount);
    estimate += signed;
  }
  for (const p of payments) {
    if (!(Object.values(ClaimPaymentType) as string[]).includes(p.payment_type))
      fail('Native claim payment component is unresolved.');
    if (p.company_id !== c.company_id || p.currency_code !== c.currency_code)
      fail('Native claim payment scope or currency differs.');
    if (p.status === 'PAID') {
      if (
        p.disbursement_status !== 'PAID' ||
        p.disbursement_currency !== c.currency_code ||
        n(p.disbursement_amount) !== n(p.paid_amount)
      )
        fail('Native paid payment lacks its matching confirmed disbursement.');
      if (p.payment_type === 'INDEMNITY') indemnity += n(p.paid_amount);
      else expenses += n(p.paid_amount);
    } else if (
      ['DRAFT', 'SUBMITTED', 'APPROVED', 'PROCESSING'].includes(p.status)
    )
      reserved += n(p.paid_amount);
    else if (
      !['REVERSED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(p.status)
    )
      fail('Native payment state is unresolved.');
  }
  const voucher = vouchers[0] ?? null;
  if (
    voucher &&
    (voucher.company_id !== c.company_id ||
      voucher.currency_code !== c.currency_code ||
      voucher.offer_accepted !== 'Y' ||
      vouchers.filter((v) => v.version === voucher.version).length !== 1)
  )
    fail('A unique accepted native discharge voucher is required.');
  return sealClaimsSource(
    {
      ...base(c, input),
      kind: 'CASE',
      data: {
        approvedLimit: cashAmount(c.approved_amount, scale),
        acceptedOffer: voucher
          ? cashAmount(voucher.claim_offer_amount, scale)
          : null,
        voucher: voucher
          ? {
              id: voucher.id,
              version: voucher.version,
              hash: hash(integrationSnapshot(voucher)),
            }
          : null,
        paidIndemnity: amount(indemnity),
        paidExpenses: amount(expenses),
        legacyReserved: amount(reserved),
        caseEstimateIncludingPaid: amount(estimate),
        caseOutstanding: amount(estimate - indemnity - expenses),
        ibnr: null,
        expenseOutstanding: null,
        riskAdjustment: null,
        discount: null,
        fullLicTarget: null,
      },
    },
    {
      claim: c,
      movements: movements.map(integrationSnapshot),
      payments: payments.map(integrationSnapshot),
      vouchers: vouchers.map(integrationSnapshot),
      legacyProjectionComparison: {
        storedPaid: c.paid_amount,
        storedOutstanding: c.outstanding_reserve,
        derivedOutstanding: amount(estimate - indemnity - expenses),
      },
    },
  );
}
export async function readClaimPayableSource(
  m: EntityManager,
  input: NativeInput & {
    paymentId: string;
    caseRef: ChangeRef;
    beneficiary: BeneficiaryEvidence;
  },
): Promise<ClaimsEvidence> {
  const c = await claim(m, input),
    scale = controlScale(input.decimalScale),
    [p] = await m.query(
      'SELECT * FROM claim_payments WHERE company_id=$1 AND claim_id=$2 AND id=$3 FOR SHARE',
      [c.company_id, c.id, controlUuid(input.paymentId)],
    );
  if (
    !p ||
    p.currency_code !== c.currency_code ||
    input.beneficiary.mode !== 'REFERENCED' ||
    ![p.payee_id, p.claimant_id].includes(input.beneficiary.referenceId)
  )
    fail('Native payment or exact payee is unavailable.');
  const [v] = await m.query(
    'SELECT * FROM claim_discharge_vouchers WHERE company_id=$1 AND claim_id=$2 AND id=$3 FOR SHARE',
    [c.company_id, c.id, p.discharge_voucher_id],
  );
  const approved =
    !['DRAFT', 'REJECTED', 'CANCELLED'].includes(c.status) &&
    !!p.approved_by &&
    !!p.approved_at &&
    ['APPROVED', 'PROCESSING', 'PAID'].includes(p.status) &&
    v?.status === 'ACCEPTED' &&
    v?.offer_accepted === 'Y' &&
    v.currency_code === c.currency_code;
  const value = cashAmount(p.paid_amount, scale);
  if (!(Object.values(ClaimPaymentType) as string[]).includes(p.payment_type))
    fail('Native claim payment component is unresolved.');
  return sealClaimsSource(
    {
      ...base(c, input),
      id: p.id,
      kind: 'PAYABLE',
      caseRef: input.caseRef,
      data: {
        amount: value,
        legacyPaid: p.status === 'PAID' ? value : amount(0n),
        legacyReserved: [
          'DRAFT',
          'SUBMITTED',
          'APPROVED',
          'PROCESSING',
        ].includes(p.status)
          ? value
          : amount(0n),
        component: p.payment_type === 'INDEMNITY' ? 'INDEMNITY' : 'EXPENSE',
        sourceApproved: approved,
        beneficiary: input.beneficiary,
        taxEvidenceHash: null,
        writer: 'LEGACY_ACTIVE',
        writerEvidenceHash: null,
      },
    },
    {
      claim: c,
      payment: integrationSnapshot(p),
      voucher: v ? integrationSnapshot(v) : null,
    },
  );
}
export async function readClaimRecoverySource(
  m: EntityManager,
  input: NativeInput & { recoveryId: string; caseRef: ChangeRef },
): Promise<ClaimsEvidence> {
  const c = await claim(m, input),
    [r] = await m.query(
      'SELECT * FROM claim_recoveries WHERE company_id=$1 AND claim_id=$2 AND id=$3 FOR SHARE',
      [c.company_id, c.id, controlUuid(input.recoveryId)],
    );
  if (
    !r ||
    ![
      'SALVAGE',
      'SUBROGATION',
      'CONTRIBUTION',
      'OTHER',
      'REINSURANCE',
    ].includes(r.recovery_type)
  )
    fail('Native recovery classification is unavailable or unsupported.');
  return sealClaimsSource(
    {
      ...base(c, input),
      id: r.id,
      kind: 'RECOVERY',
      caseRef: input.caseRef,
      data: {
        type: r.recovery_type,
        expected: cashAmount(r.expected_amount, input.decimalScale),
        legacyReceived: cashAmount(r.received_amount, input.decimalScale),
        debtorId: null,
        legalStatus: 'UNRESOLVED',
        legalEvidenceHash: null,
      },
    },
    { claim: c, recovery: integrationSnapshot(r) },
  );
}
