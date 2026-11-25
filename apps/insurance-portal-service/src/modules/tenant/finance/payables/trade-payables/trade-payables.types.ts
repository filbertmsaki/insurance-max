import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  FINANCE_UUID,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  fromMinor,
  moneyMinor,
  type Evidence,
  type VoucherLine,
} from '../../accounting/general-ledger/finance-gl-program';
import type { ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import type { FinanceChartProposal } from '../../foundation/chart-of-accounts/finance-chart.types';

export const kinds = [
  'SETTINGS',
  'CATEGORY',
  'SUPPLIER',
  'BANK',
  'ORDER',
  'RECEIPT',
  'BILL',
  'CREDIT',
  'CREDIT_APPLICATION',
  'SUPPLIER_REFUND',
  'OPENING_IMPORT',
  'DEBIT',
  'ADVANCE',
  'APPLICATION',
  'EXPENSE',
  'IMPREST',
  'RETIREMENT',
  'PAYMENT',
  'BATCH',
  'RECONCILIATION',
  'REVERSAL',
] as const;
export type Kind = (typeof kinds)[number];
export const masters: Kind[] = ['SETTINGS', 'CATEGORY', 'SUPPLIER', 'BANK'];
export const cashKinds: Kind[] = ['PAYMENT', 'ADVANCE', 'IMPREST'];
export type Fields = Record<string, any>;
export interface Input {
  kind: Kind;
  reference: string;
  requestKey: string;
  date: string;
  currency?: string;
  supplierId?: string;
  employeeId?: string;
  replacesId?: string;
  evidence?: Evidence;
  dimensions?: Record<string, string>;
  details: Fields;
}
export interface ApRecord {
  id: string;
  book_id: string;
  kind: Kind;
  reference: string;
  sequence: string;
  party: string;
  revision: number;
  doc_date: string;
  due_date: string | null;
  state: string;
  status: string;
  journal_id?: string;
  candidate_id?: string;
  posted_date?: string;
  reviewed_at?: Date;
  settlement?: Fields;
  maker_person: string;
  maker_id: string;
  reviewer_person?: string;
  request_hash: string;
  request_key: string;
  amount: string;
  currency: string;
  data: Prepared;
}
export interface Movement {
  itemId: string;
  amount: string;
  withholding: string;
}
export interface Prepared {
  details: Fields;
  evidence?: Evidence;
  dimensions: Record<string, string>;
  amount: string;
  due?: string;
  lines: VoucherLine[];
  movements: Movement[];
  quantities?: { item: string; quantity: string }[];
  orderId?: string;
  batchItems?: string[];
  bankId?: string;
  bankAccount?: string;
  accounts?: Record<string, string>;
}
export interface Context {
  m: EntityManager;
  b: ActivePostingBook;
  chart: FinanceChartProposal;
  scale: number;
  id: string;
  party: string;
  input: Input;
}
export function fail(message: string): never {
  throw new BadRequestException(message);
}
export function conflict(message: string): never {
  throw new ConflictException(message);
}
export function text(v: unknown, label: string, max = 120): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    fail('Enter a valid ' + label + '.');
  return v.trim();
}
export function uuid(v: unknown, label: string): string {
  if (typeof v !== 'string' || !FINANCE_UUID.test(v))
    fail('Select a valid ' + label + '.');
  return v;
}
export function date(v: unknown): string {
  if (typeof v !== 'string' || !isFinanceDate(v))
    fail('Enter a valid calendar date.');
  return v;
}
export function day(value: Date | string) {
  return typeof value === 'string'
    ? value.slice(0, 10)
    : [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
      ].join('-');
}
export function plusDays(value: string, n: number) {
  return new Date(Date.parse(value + 'T00:00:00Z') + 86400000 * n)
    .toISOString()
    .slice(0, 10);
}
export function int(v: unknown, label: string, max: number) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max)
    fail('Enter a valid ' + label + '.');
  return v;
}
export function list<T = Fields>(
  v: unknown,
  label: string,
  max = 200,
  strings = false,
): T[] {
  if (!Array.isArray(v) || !v.length || v.length > max)
    fail('Provide between 1 and ' + max + ' ' + label + '.');
  if (
    v.some((row) =>
      strings
        ? typeof row !== 'string'
        : !row || typeof row !== 'object' || Array.isArray(row),
    )
  )
    fail('Invalid entry in ' + label + '.');
  return v;
}
export function distinct(values: string[], label: string) {
  if (new Set(values).size !== values.length) fail('Duplicate ' + label + '.');
}
export function rounded(n: bigint, d: bigint) {
  return (n + d / 2n) / d;
}
export function positive(v: unknown, scale: number, label = 'amount') {
  if (typeof v !== 'string')
    fail('Enter the ' + label + ' as a decimal amount.');
  const units = moneyMinor(v, scale);
  if (units <= 0n) fail('The ' + label + ' must be positive.');
  return units;
}
export function role(c: Context, value: unknown, types: string[]) {
  const code = text(value, 'account role', 64);
  const r = c.chart.roles.find((x) => x.code === code);
  if (
    !r ||
    !types.includes(r.accountType) ||
    !c.chart.accounts.some((a) => a.posting && a.code === r.accountCode)
  )
    fail(
      'Select a reviewed ' +
        types.join(' or ').toLowerCase() +
        ' posting role for ' +
        code +
        '.',
    );
  return r;
}
export function basePlan(c: Context, details: Fields): Prepared {
  return {
    details,
    evidence: c.input.evidence,
    dimensions: c.input.dimensions ?? {},
    amount: '0',
    lines: [],
    movements: [],
  };
}
export function line(
  p: Prepared,
  c: Context,
  roleCode: string,
  side: 'debit' | 'credit',
  amount: bigint,
) {
  if (amount > 0n)
    p.lines.push({
      role: roleCode,
      dimensions: p.dimensions,
      debit: side === 'debit' ? fromMinor(amount, c.scale) : '0',
      credit: side === 'credit' ? fromMinor(amount, c.scale) : '0',
    });
}
export function move(
  p: Prepared,
  c: Context,
  id: string,
  amount: bigint,
  withholding = 0n,
) {
  const signed = (n: bigint) =>
    (n < 0n ? '-' : '') + fromMinor(n < 0n ? -n : n, c.scale);
  p.movements.push({
    itemId: id,
    amount: signed(amount),
    withholding: signed(withholding),
  });
}
export async function record(
  m: EntityManager,
  book: string,
  id: unknown,
): Promise<ApRecord> {
  const [r] = await m.query(
    'SELECT *,doc_date::text,due_date::text,posted_date::text FROM finance_ap_status WHERE book_id=$1 AND id=$2',
    [book, uuid(id, 'record')],
  );
  if (!r) conflict('The selected record is unavailable in this book.');
  return r;
}
export async function current(
  m: EntityManager,
  book: string,
  kind: Kind,
  ref: string,
  party = '',
): Promise<ApRecord | undefined> {
  const [r] = await m.query(
    "SELECT *,doc_date::text,due_date::text FROM finance_ap_records WHERE book_id=$1 AND kind=$2 AND upper(reference)=upper($3) AND party=$4 AND state='APPROVED' ORDER BY revision DESC LIMIT 1",
    [book, kind, ref, party],
  );
  return r;
}
export async function activeMaster(c: Context, id: unknown, kind: Kind) {
  const r = await record(c.m, c.b.book_id, id),
    latest = await current(c.m, c.b.book_id, kind, r.reference, r.party);
  if (r.kind !== kind || !latest || latest.data.details.disabled)
    conflict('Select an active approved ' + kind.toLowerCase() + '.');
  return latest;
}
export function rootId(r: ApRecord) {
  return r.data.details.rootId ?? r.id;
}
export function terms(b: ActivePostingBook) {
  return (
    b.controls as unknown as {
      paymentTerms: {
        code: string;
        party: string;
        days: number;
        isDefault: boolean;
      }[];
    }
  ).paymentTerms.filter((v) => v.party === 'SUPPLIER');
}
export async function outstanding(c: Context, id: unknown, kinds: Kind[]) {
  const item = await record(c.m, c.b.book_id, id);
  if (
    !kinds.includes(item.kind) ||
    item.status !== 'POSTED' ||
    item.party !== c.party ||
    item.currency !== c.input.currency ||
    item.posted_date! > c.input.date
  )
    conflict(
      'Select a posted open item for the same party and currency on or before this date.',
    );
  const [reversed] = await c.m.query(
    "SELECT 1 FROM finance_ap_records WHERE book_id=$1 AND kind='REVERSAL' AND data->'details'->>'originalId'=$2 AND state IN ('PENDING','APPROVED')",
    [c.b.book_id, item.id],
  );
  if (reversed) conflict('This open item has a pending or posted reversal.');
  const control = item.data.details.controlRole ?? item.data.details.assetRole;
  if (
    control &&
    item.data.accounts?.[control] !==
      c.chart.roles.find((r) => r.code === control)?.accountCode
  )
    conflict(
      'Restore the original open item control account before settlement.',
    );
  // Future reservations also consume capacity. Future additions cannot fund a backdated allocation.
  const [s] = await c.m.query(
    `SELECT coalesce(sum(v.amount),0)::text balance,coalesce(sum(v.withholding),0)::text withholding
    FROM finance_ap_movements v JOIN finance_ap_status d ON d.id=v.document_id
    WHERE v.book_id=$1 AND v.item_id=$2 AND d.state NOT IN ('CANCELLED','REJECTED')
      AND ((d.posted_date<=$3 AND d.status='POSTED') OR CASE WHEN $4 THEN v.amount>0 ELSE v.amount<0 END)`,
    [c.b.book_id, item.id, c.input.date, item.kind === 'CREDIT'],
  );
  const units = (v: string) =>
    v.startsWith('-')
      ? -moneyMinor(v.slice(1), c.scale)
      : moneyMinor(v, c.scale);
  return {
    item,
    balance: (item.kind === 'CREDIT' ? -1n : 1n) * units(s.balance),
    withholding: units(s.withholding),
  };
}
