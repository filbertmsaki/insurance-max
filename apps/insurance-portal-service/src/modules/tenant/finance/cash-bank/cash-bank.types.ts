import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CASH_BANK_GROUPS,
  type CashBankInput,
  type CashBankKind,
} from '@insurance-max/contracts';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import type { EntityManager } from 'typeorm';
import type { ActivePostingBook } from '../accounting/general-ledger/finance-book-request';
import type { FoundationActor } from '../accounting/general-ledger/finance-ledger-foundation.service';
import {
  isFinanceDate,
  FINANCE_UUID,
} from '../foundation/finance-configuration/finance-configuration.types';
export type Input = CashBankInput;
export type Kind = CashBankKind;
export interface Document {
  id: string;
  sequence: string;
  book_id: string;
  company_id: string;
  maker_id: string;
  maker_person: string;
  state: string;
  day: string;
  kind: Kind;
  reference: string;
  input: Input;
  candidate_id: string | null;
  journal_id: string | null;
}
export interface Account {
  id: string;
  code: string;
  kind: 'BANK' | 'TILL' | 'WALLET';
  currency: string;
  role: string;
  account_code: string;
  branch: string;
  manager_id: string | null;
  starts: string;
  balance: string;
  maximum_float: string | null;
  payment_limit: string | null;
  active: boolean;
  account_number: string | null;
  institution: string | null;
  name: string;
}
export interface Context {
  m: EntityManager;
  b: ActivePostingBook;
  a: FoundationActor;
}
export const bad = (s: string): never => {
  throw new BadRequestException(s);
};
export const conflict = (s: string): never => {
  throw new ConflictException(s);
};
export const denied = (s: string): never => {
  throw new ForbiddenException(s);
};
export function field(value: unknown, label: string, max = 160) {
  return typeof value === 'string' && value.trim() && value.trim().length <= max
    ? value.trim()
    : bad('Enter a valid ' + label + '.');
}
export function uuid(v: unknown) {
  return typeof v === 'string' && FINANCE_UUID.test(v)
    ? v.toLowerCase()
    : bad('Select a valid record.');
}
export function date(v: unknown) {
  return typeof v === 'string' && isFinanceDate(v)
    ? v
    : bad('Enter a valid date.');
}
export function money(v: unknown, scale: number, signed = false) {
  if (
    typeof v !== 'string' ||
    !/^-?\d{1,24}(\.\d{1,12})?$/.test(v) ||
    !Number.isInteger(scale)
  )
    bad('Enter a valid amount in the account currency.');
  const n = DecimalUtil.value(v as string);
  if (n.decimalPlaces() > scale || (!signed && n.isNegative()))
    bad('Check the sign and decimal places of the amount.');
  return n;
}
export function positive(v: unknown, scale: number) {
  const n = money(v, scale);
  return n.isPositive() && !n.isZero() ? n : bad('Enter an amount above zero.');
}
export function currency(b: ActivePostingBook, v: unknown) {
  return typeof v === 'string' && Object.hasOwn(b.context.currencyScales, v)
    ? v
    : bad('Select an approved book currency.');
}
export async function account(
  c: Context,
  id: unknown,
  active = true,
): Promise<Account> {
  const [r] = await c.m.query(
    'SELECT a.*,a.starts::text FROM finance_cb_balances a WHERE book_id=$1 AND id=$2',
    [c.b.book_id, uuid(id)],
  );
  if (!r || (active && !r.active))
    conflict('Select an active account in this book.');
  return r;
}
export async function doc(
  c: Context,
  id: unknown,
  kind?: Kind,
): Promise<Document> {
  const [r] = await c.m.query(
    'SELECT d.*,d.day::text FROM finance_cb_documents d WHERE book_id=$1 AND id=$2',
    [c.b.book_id, uuid(id)],
  );
  if (!r || (kind && (r.kind !== kind || r.state !== 'POSTED')))
    conflict('Select a matching approved document in this book.');
  return r;
}
export async function staff(c: Context, id: unknown) {
  const [u] = await c.m.query(
    "SELECT u.id FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=$1 AND u.id=$2 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL",
    [c.b.company_id, uuid(id)],
  );
  return u?.id ?? bad('Choose an active staff member of this company.');
}
export function validateInput(v: Input) {
  if (
    !v ||
    !Object.values(CASH_BANK_GROUPS).some((g) => Object.hasOwn(g, v.kind)) ||
    !v.fields ||
    typeof v.fields !== 'object' ||
    Array.isArray(v.fields) ||
    Object.values(v.fields).some((x) => typeof x !== 'string')
  )
    bad('Choose a cash and bank operation and its fields.');
  field(v.requestKey, 'request key', 180);
  field(v.reference, 'reference', 110);
  date(v.date);
}
export const transfers: Kind[] = [
  'DEPOSIT',
  'WITHDRAW',
  'REPLENISH',
  'TRANSFER',
  'WALLET_SETTLE',
];
export const corrections: Kind[] = ['REVERSE', 'STOP', 'VOID', 'DISHONOUR'];
export const journalKinds: Kind[] = [
  'RECEIPT',
  'PAYMENT',
  'OVERAGE',
  'SHORTAGE',
  ...transfers,
  'RECEIVE',
  'FX_SETTLE',
  'CHEQUE',
  'EFT_SETTLE',
  'FEE',
  'INTEREST',
  ...corrections,
];
