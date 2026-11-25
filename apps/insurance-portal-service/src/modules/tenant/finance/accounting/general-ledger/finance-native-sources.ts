import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { OperatingSource } from './finance-operating-posting.service';

const specs = {
  INVOICE: [
    'INVOICE_ISSUED',
    'ORDINARY',
    "SELECT i.invoice_no reference,i.total_amount::text amount,i.currency,i.customer_id,i.issued_at at_time,i.invoice_type,i.branch_id,i.finance_dimensions FROM invoices i WHERE i.company_id=$1 AND i.id=$2 AND i.status='ISSUED' FOR SHARE OF i",
  ],
  INVOICE_WRITE_OFF: [
    'INVOICE_WRITTEN_OFF',
    'ORDINARY',
    'SELECT w.reference,w.amount::text,w.currency,i.customer_id,w.accounting_date::timestamp AT TIME ZONE $3 at_time,i.branch_id,w.dimensions finance_dimensions,w.invoice_id,w.evidence FROM finance_gl_writeoffs w JOIN invoices i ON i.id=w.invoice_id AND i.company_id=w.company_id WHERE w.company_id=$1 AND w.id=$2 FOR SHARE OF w,i',
  ],
  RECEIPT: [
    'RECEIPT_POSTED',
    'CASH',
    "SELECT r.receipt_no reference,r.amount::text,r.currency,r.customer_id,i.invoice_type,i.id AS billing_invoice_id,r.received_at at_time,r.settlement_account_code,coalesce(r.branch_id,i.branch_id) branch_id,coalesce(r.finance_dimensions,i.finance_dimensions) finance_dimensions FROM receipts r LEFT JOIN invoices i ON i.id=r.invoice_id AND i.company_id=r.company_id WHERE r.company_id=$1 AND r.id=$2 AND r.status='POSTED' FOR SHARE OF r",
  ],
  REFUND: [
    'REFUND_PAID',
    'CASH',
    "SELECT r.refund_no reference,r.amount::text,r.currency_code currency,r.customer_id,r.paid_at at_time,r.settlement_account_code,coalesce(i.branch_id,t.branch_id) branch_id,coalesce(i.finance_dimensions,t.finance_dimensions) finance_dimensions FROM finance_refunds r LEFT JOIN receipts t ON t.id=r.receipt_id AND t.company_id=r.company_id LEFT JOIN invoices i ON i.id=coalesce(r.invoice_id,t.invoice_id) AND i.company_id=r.company_id WHERE r.company_id=$1 AND r.id=$2 AND r.status='PAID' FOR SHARE OF r",
  ],
  COMMISSION_ACCRUAL: [
    'COMMISSION_ACCRUED',
    'ORDINARY',
    "SELECT c.accrual_no reference,c.commission_amount::text amount,coalesce(c.commission_snapshot->>'currencyCode',i.currency) currency,c.accrued_at at_time,i.branch_id,i.finance_dimensions FROM commission_transactions c LEFT JOIN invoices i ON i.id=c.invoice_id AND i.company_id=c.company_id WHERE c.company_id=$1 AND c.id=$2 AND c.status='ACCRUED' FOR SHARE OF c",
  ],
  COMMISSION_PAYMENT: [
    'COMMISSION_PAYMENT_PAID',
    'CASH',
    "SELECT p.payment_no reference,p.allocated_amount::text amount,p.currency,p.paid_at at_time,p.settlement_account_code,coalesce(p.branch_id::text,b.branch) branch_id FROM commission_payments p LEFT JOIN LATERAL (SELECT CASE WHEN count(*)=count(coalesce(i.branch_id::text,i.finance_dimensions->>'BRANCH')) AND count(DISTINCT coalesce(i.branch_id::text,i.finance_dimensions->>'BRANCH'))=1 THEN min(coalesce(i.branch_id::text,i.finance_dimensions->>'BRANCH')) END branch FROM commission_payment_items x JOIN commission_transactions t ON t.id=x.commission_transaction_id AND t.company_id=p.company_id LEFT JOIN invoices i ON i.id=t.invoice_id AND i.company_id=p.company_id WHERE x.commission_payment_id=p.id) b ON true WHERE p.company_id=$1 AND p.id=$2 AND p.status='PAID' FOR SHARE OF p",
  ],
  CLAIM_DISBURSEMENT: [
    'CLAIM_DISBURSEMENT_PAID',
    'CASH',
    "SELECT d.disbursement_no reference,d.amount::text,d.currency_code currency,d.confirmed_at at_time,d.settlement_account_code,c.customer_id,c.branch_id FROM claim_disbursements d JOIN claims c ON c.id=d.claim_id AND c.company_id=d.company_id WHERE d.company_id=$1 AND d.id=$2 AND d.status='PAID' FOR SHARE OF d,c",
  ],
  CLAIM_RECOVERY_RECEIPT: [
    'RECOVERY_RECEIPT_RECORDED',
    'CASH',
    "SELECT r.recovery_no reference,e.metadata->>'received_amount' amount,c.currency_code currency,e.created_at at_time,c.branch_id,e.id movement_id FROM claim_recoveries r JOIN claims c ON c.id=r.claim_id AND c.company_id=r.company_id JOIN claim_events e ON e.subject_id=r.id AND e.company_id=r.company_id AND e.claim_id=r.claim_id AND e.subject_type='CLAIM_RECOVERY' AND e.event_type='RECOVERY_RECEIPT_RECORDED' WHERE r.company_id=$1 AND r.id=$2 AND 'recovery-receipt:'||e.id::text=$4 FOR SHARE OF e,r,c",
  ],
  REINSURANCE_SETTLEMENT: [
    'REINSURANCE_SETTLEMENT_PAID',
    'CASH',
    "SELECT s.settlement_no reference,s.paid_amount::text amount,s.currency,s.settled_at at_time,s.settlement_account_code,s.branch_id,s.settlement_type FROM reinsurance_settlements s WHERE s.company_id=$1 AND s.id=$2 AND s.status='PAID' FOR SHARE OF s",
  ],
} as const;

export const reversalSources: Record<string, [keyof typeof specs, string]> = {
  WRITE_OFF: [
    'INVOICE',
    "SELECT voided_at at_time,invoice_type FROM invoices WHERE company_id=$1 AND id=$2 AND status='VOIDED' FOR SHARE",
  ],
  INVOICE_WRITE_OFF_REVERSAL: [
    'INVOICE_WRITE_OFF',
    'SELECT statement_timestamp() at_time FROM finance_gl_writeoffs WHERE company_id=$1 AND id=$2 FOR SHARE',
  ],
  RECEIPT_REVERSAL: [
    'RECEIPT',
    "SELECT reversed_at at_time FROM receipts WHERE company_id=$1 AND id=$2 AND status='REVERSED' FOR SHARE",
  ],
  COMMISSION_ACCRUAL_REVERSAL: [
    'COMMISSION_ACCRUAL',
    "SELECT reversed_at at_time FROM commission_transactions WHERE company_id=$1 AND id=$2 AND status='REVERSED' FOR SHARE",
  ],
  COMMISSION_PAYMENT_REVERSAL: [
    'COMMISSION_PAYMENT',
    "SELECT reversed_at at_time FROM commission_payments WHERE company_id=$1 AND id=$2 AND status='REVERSED' FOR SHARE",
  ],
  CLAIM_DISBURSEMENT_REVERSAL: [
    'CLAIM_DISBURSEMENT',
    "SELECT updated_at at_time FROM claim_disbursements WHERE company_id=$1 AND id=$2 AND status='REVERSED' FOR SHARE",
  ],
};

export const nativeComponents = Object.entries(specs).map(
  ([kind, [event, effect]]) => ({ kind, event, effect }),
);
export const nativeLedgerEvents = new Set<string>([
  ...Object.values(specs).map((x) => x[0]),
  'PREMIUM_RECEIPT_POSTED',
]);

export async function readNativeMovement(
  m: EntityManager,
  company: string,
  timezone: string,
  source: OperatingSource,
) {
  const reversal = reversalSources[source.sourceType];
  const kind = reversal?.[0] ?? (source.sourceType as keyof typeof specs);
  const spec = specs[kind];
  if (!spec)
    throw new ConflictException(
      'Configure a native accounting source adapter for ' + kind + '.',
    );
  const sql = reversal?.[1] ?? spec[2];
  const params = [company, source.sourceId, timezone];
  if (kind === 'CLAIM_RECOVERY_RECEIPT') params.push(source.sourceEventId);
  const [doc] = await m.query(
    'SELECT s.*,(s.at_time AT TIME ZONE $3)::date::text date FROM (' +
      sql +
      ') s',
    params,
  );
  if (!doc?.date)
    throw new ConflictException(
      'The financial movement has no matching effective source record.',
    );
  return { doc, kind, event: spec[0], effect: spec[1], reversal: !!reversal };
}
