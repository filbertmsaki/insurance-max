import { ConflictException } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { EntityManager } from 'typeorm';
import { cashAmount } from '../outgoing-payments/finance-outgoing.types';
import {
  controlUuid,
  controlScale,
  controlUnits,
  controlAmount,
} from '../../receivables/receivable-controls/finance-receivables.types';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import {
  normalizeCommission,
  type CommissionEvidence,
} from './finance-commission.types';
import type { ChangeRef } from '../../governance/accounting-policies/finance-policy-change.types';
import type { BeneficiaryEvidence } from '../../governance/finance-approvals/finance-approval.types';

/** Initial read-only adapter. Commission calculation remains owned by the existing pricing service.
 * Legacy commission rows do not prove tax or withholding, so these remain explicitly unresolved.
 */
export async function readCommissionSource(
  m: EntityManager,
  input: {
    companyId: string;
    commissionId: string;
    sourceRevision: number;
    decimalScale: number;
    originalBilling: ChangeRef;
    beneficiary: BeneficiaryEvidence;
    effectiveDate: string;
  },
): Promise<CommissionEvidence> {
  const company = controlUuid(input.companyId),
    id = controlUuid(input.commissionId),
    scale = controlScale(input.decimalScale);
  const [c] = await m.query(
    'SELECT * FROM commission_transactions WHERE company_id=$1 AND id=$2 AND deleted_at IS NULL FOR SHARE',
    [company, id],
  );
  const fail = (): never => {
    throw new ConflictException(
      'Native commission, calculation or legacy settlement evidence does not reconcile.',
    );
  };
  if (
    !c ||
    !['ACCRUED', 'APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(c.status) ||
    !c.quotation_id ||
    !c.commission_snapshot ||
    new ProductDefinitionHashService().hashDefinition(c.commission_snapshot) !==
      c.commission_snapshot_hash
  )
    return fail();
  const snap = c.commission_snapshot;
  if (
    snap.quotationId !== c.quotation_id ||
    snap.intermediaryCompanyId !== c.intermediary_company_id ||
    typeof snap.currencyCode !== 'string' ||
    snap.commissionBase !== c.net_premium ||
    snap.commissionRate !== c.commission_rate ||
    snap.commissionAmount !== c.commission_amount
  )
    return fail();
  const paid = cashAmount(c.paid_amount, scale),
    amount = cashAmount(c.commission_amount, scale),
    balance = cashAmount(c.balance_amount, scale);
  if (controlUnits(paid) + controlUnits(balance) !== controlUnits(amount))
    return fail();
  const payments = await m.query(
    'SELECT i.id,i.amount,i.status AS item_status,p.id AS payment_id,p.company_id,p.intermediary_company_id,p.currency,p.status,p.deleted_at FROM commission_payment_items i JOIN commission_payments p ON p.id=i.commission_payment_id WHERE i.commission_transaction_id=$1 ORDER BY i.id FOR SHARE OF i,p',
    [id],
  );
  let settled = 0n,
    reserved = 0n;
  for (const p of payments) {
    if (p.item_status === 'REVERSED' || p.status === 'REVERSED') continue;
    if (
      p.item_status !== 'ACTIVE' ||
      p.deleted_at ||
      p.company_id !== company ||
      p.intermediary_company_id !== c.intermediary_company_id ||
      p.currency !== snap.currencyCode ||
      !['DRAFT', 'APPROVED', 'PAID'].includes(p.status)
    )
      return fail();
    const value = controlUnits(cashAmount(p.amount, scale));
    if (p.status === 'PAID') settled += value;
    else reserved += value;
  }
  if (settled !== controlUnits(paid)) return fail();
  return normalizeCommission({
    schema: 'FINANCE_COMMISSION_V1',
    id,
    sourceRevision: input.sourceRevision,
    commissionId: id,
    sourceCompanyId: company,
    partyId: c.intermediary_company_id,
    quotationId: c.quotation_id,
    policyId: c.policy_id,
    originalBilling: input.originalBilling,
    previous: null,
    policyChange: null,
    effect: 'INITIAL',
    reverses: null,
    effectiveDate: input.effectiveDate,
    currency: snap.currencyCode,
    decimalScale: scale,
    commissionDelta: amount,
    taxDelta: null,
    withholdingDelta: null,
    payableDelta: null,
    taxEvidenceHash: null,
    calculation: { snapshot: snap, hash: c.commission_snapshot_hash },
    legacyPaid: paid,
    legacyReserved: controlAmount(reserved),
    legacyEvidenceHash: hash({
      commissionId: id,
      status: c.status,
      paid,
      balance,
      payments,
    }),
    beneficiary: input.beneficiary,
    acquisition: {
      classification: 'UNASSESSED',
      evidenceHash: null,
      allocationReference: null,
    },
  });
}
