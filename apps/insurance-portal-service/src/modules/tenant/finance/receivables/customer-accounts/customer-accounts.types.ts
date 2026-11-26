import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  FINANCE_UUID,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import type {
  Evidence,
  VoucherLine,
} from '../../accounting/general-ledger/finance-gl-program';

export const kinds = [
  'CATEGORY',
  'PROFILE',
  'PAYER_MANDATE',
  'POLICY',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'CREDIT_APPLICATION',
  'CREDIT_REFUND',
  'ADVANCE',
  'ADVANCE_APPLICATION',
  'ADVANCE_RELEASE',
  'IMPAIRMENT',
  'WRITE_OFF',
  'RECONCILIATION',
  'REVERSAL',
] as const;
export type Kind = (typeof kinds)[number];
export interface ArInput {
  kind: Kind;
  reference: string;
  requestKey: string;
  date: string;
  currency: string;
  customerId?: string;
  invoiceId?: string;
  receiptId?: string;
  relatedId?: string;
  amount?: string;
  evidence?: Evidence;
  billingSourceId?: string;
  categoryId?: string;
  termCode?: string;
  payerId?: string;
  enabled?: boolean;
  roles?: Record<string, string>;
  dimensions?: Record<string, string>;
  tax?: string;
  requireProfile?: boolean;
  reminderDays?: number[];
  lossRates?: string[];
  from?: string;
  opening?: string;
  statementLines?: { date: string; reference: string; amount: string }[];
}
export interface ArDocument {
  id: string;
  sequence: string;
  book_id: string;
  company_id: string;
  kind: Kind;
  reference: string;
  currency: string;
  effective_date: string;
  customer_id: string;
  invoice_id: string;
  receipt_id: string;
  related_id: string;
  amount: string;
  maker_id: string;
  maker_person: string;
  state: string;
  reviewer_id: string;
  reviewed_at: Date;
  candidate_id: string;
  journal_id: string;
  data: ArInput & {
    lines: VoucherLine[];
    memo?: boolean;
    policyId?: string;
    target?: string;
    originalId?: string;
    bankAccount?: string;
    signature?: string;
  };
}
export function invalid(message: string): never {
  throw new BadRequestException(message);
}
export function conflict(message: string): never {
  throw new ConflictException(message);
}
export function text(value: unknown, label: string, length = 120) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > length
  )
    invalid('Enter a valid ' + label + '.');
  return value.trim();
}
export function uuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !FINANCE_UUID.test(value))
    invalid('Select a valid ' + label + '.');
  return value;
}
export function day(value: unknown) {
  if (typeof value !== 'string' || !isFinanceDate(value))
    invalid('Enter a valid accounting date.');
  return value;
}
export async function document(
  m: EntityManager,
  book: string,
  id: string,
): Promise<ArDocument> {
  const [r] = await m.query(
    'SELECT d.*,d.effective_date::text FROM finance_ar_documents d WHERE book_id=$1 AND id=$2 FOR UPDATE',
    [book, uuid(id, 'document')],
  );
  if (!r) conflict('The selected document does not belong to this book.');
  return r;
}
export async function policy(
  m: EntityManager,
  book: string,
  ccy: string,
  date: string,
): Promise<ArDocument> {
  const [p] = await m.query(
    "SELECT * FROM finance_ar_documents WHERE book_id=$1 AND currency=$2 AND kind='POLICY' AND state='APPROVED' AND effective_date<=$3 ORDER BY effective_date DESC,sequence DESC LIMIT 1",
    [book, ccy, date],
  );
  if (!p)
    conflict(
      'Approve the customer accounting policy for this currency and date.',
    );
  return p;
}
