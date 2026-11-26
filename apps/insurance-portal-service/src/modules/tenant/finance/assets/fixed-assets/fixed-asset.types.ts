import { ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import {
  FINANCE_UUID,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  invalid,
  type VoucherLine,
  type Evidence,
} from '../../accounting/general-ledger/finance-gl-program';

export const masterKinds = ['GROUP', 'CATEGORY', 'LOCATION'] as const;
export const kinds = [
  ...masterKinds,
  'ACQUIRE',
  'OPENING',
  'CAPITALIZE',
  'CAPITAL_ADDITION',
  'RECLASSIFY',
  'ASSIGN',
  'TRANSFER',
  'MAINTENANCE_PLAN',
  'MAINTENANCE_COMPLETE',
  'VERIFY',
  'DEPRECIATE',
  'ESTIMATE',
  'REVALUE',
  'IMPAIR',
  'RESTORE',
  'DISPOSE',
  'WRITE_OFF',
  'LEASE_START',
  'LEASE_EXEMPT',
  'LEASE_EXPENSE',
  'LEASE_END',
  'LEASE_INTEREST',
  'LEASE_PAYMENT',
  'LEASE_REMEASURE',
  'REVERSE',
] as const;
export type Kind = (typeof kinds)[number];
export function isMaster(kind: Kind) {
  return (masterKinds as readonly string[]).includes(kind);
}
export const roleTypes = {
  asset: ['ASSET'],
  clearing: ['ASSET'],
  accumulated: ['ASSET', 'CONTRA_ASSET'],
  depreciation: ['EXPENSE'],
  impairment: ['ASSET', 'CONTRA_ASSET'],
  loss: ['EXPENSE'],
  gain: ['INCOME'],
  surplus: ['EQUITY'],
  retained: ['EQUITY'],
  branchDueFrom: ['ASSET'],
  branchDueTo: ['LIABILITY'],
  liability: ['LIABILITY'],
  interest: ['EXPENSE'],
};
export type Roles = Partial<Record<keyof typeof roleTypes, string>>;
export type Dimensions = Record<string, string>;
export interface Policy {
  method: 'STRAIGHT_LINE' | 'DECLINING' | 'NONE';
  life: number;
  rate: string;
  model: 'COST' | 'REVALUATION';
  roles: Roles;
  accounts: Roles;
}
export interface Instalment {
  date: string;
  start?: string;
  periods?: string;
  opening: string;
  interest: string;
  payment: string;
  closing: string;
  accrued?: boolean;
  accruedInterest?: string;
  accruedThrough?: string;
  paid?: string;
}
export const leaseOwnershipBases = [
  'LEASE_TERM',
  'TITLE_TRANSFER',
  'PURCHASE_OPTION',
] as const;
export type LeaseOwnershipBasis = (typeof leaseOwnershipBases)[number];
export interface Lease {
  schedule: Instalment[];
  index: number;
  accrued: boolean;
  paid: string;
  liability: string;
  annualRate: string;
  anchor: string;
  usefulLifeEnd?: string;
  ownershipBasis?: LeaseOwnershipBasis | 'UNCONFIRMED';
  ownershipTransfer?: boolean;
}
export function leaseBasis(
  input: unknown,
  previous?: Lease | null,
): LeaseOwnershipBasis {
  if (input === undefined) {
    const existing =
      previous?.ownershipBasis ??
      (previous?.ownershipTransfer ? 'UNCONFIRMED' : 'LEASE_TERM');
    if (existing === 'UNCONFIRMED')
      conflict(
        'Confirm the ownership or purchase-option decision against the lease agreement.',
      );
    return existing;
  }
  const basis = leaseOwnershipBases.find((option) => option === input);
  if (!basis)
    invalid('Choose the contractual ownership or purchase-option basis.');
  return basis;
}
export function needsLeaseBasis(lease?: Lease | null) {
  return (
    lease?.ownershipBasis === 'UNCONFIRMED' ||
    (!lease?.ownershipBasis && lease?.ownershipTransfer === true)
  );
}
export function ambiguousLeaseSchedule(a: Asset) {
  const l = a.lease;
  return (
    !!l &&
    needsLeaseBasis(l) &&
    !!a.end &&
    a.end > l.schedule[l.schedule.length - 1].date
  );
}
export interface Asset {
  code: string;
  name: string;
  category: string;
  group: string;
  location: string;
  serial: string;
  custodian: string | null;
  status: 'ACQUIRED' | 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF' | 'EXEMPT';
  dimensions: Dimensions;
  policy: Policy;
  acquired: string;
  inService: string | null;
  end: string | null;
  through: string | null;
  cost: string;
  accumulated: string;
  impairment: string;
  lossInProfit: string;
  deficit: string;
  surplus: string;
  shadow: string;
  residual: string;
  sourceRole: string;
  sourceDimensions: Dimensions;
  sourceCost: string;
  lease: Lease | null;
  exemption?: {
    basis: 'SHORT_TERM' | 'LOW_VALUE';
    end: string;
    expense: string;
  };
  maintenance: { due: string; note: string } | null;
  verified: { date: string; result: string; note: string } | null;
}
export interface Master {
  name: string;
  group?: string;
  branch?: string;
  policy?: Policy;
}
export interface Input {
  kind: Kind;
  code: string;
  reference: string;
  date: string;
  requestKey: string;
  evidence: Evidence;
  name?: string;
  category?: string;
  group?: string;
  location?: string;
  branch?: string;
  custodian?: string;
  serial?: string;
  dimensions?: Dimensions;
  method?: Policy['method'];
  model?: Policy['model'];
  life?: number;
  rate?: string;
  roles?: Roles;
  amount?: string;
  residual?: string;
  note?: string;
  due?: string;
  result?: string;
  sourceJournal?: string;
  sourceLine?: string;
  original?: string;
  leaseMonths?: number;
  firstDue?: string;
  rescheduleArrears?: boolean;
  ownershipBasis?: LeaseOwnershipBasis;
  expiryRecoverableAmount?: string;
  valuationRunId?: string;
  payment?: string;
  annualRate?: string;
  exemption?: 'SHORT_TERM' | 'LOW_VALUE';
  payments?: string[];
  initialAdjustment?: string;
  inService?: string;
  accumulated?: string;
  openingImpairment?: string;
  openingReserve?: string;
  openingLoss?: string;
  unimpairedValue?: string;
}
export interface Source {
  journal: string;
  line: string;
  amount: string;
}
export interface Plan {
  asset: Asset | null;
  master?: Master;
  lines: VoucherLine[];
  amount: string;
  source?: Source;
  opening?: { id: string; balances: Record<string, string> };
}
export interface Doc {
  id: string;
  book_id: string;
  company_id: string;
  kind: Kind;
  code: string;
  reference: string;
  effective_date: string;
  currency: string;
  request_key: string;
  request_hash: string;
  input: Input;
  plan: Plan;
  prior_id: string | null;
  reversal_of: string | null;
  state: string;
  maker_id: string;
  maker_person: string;
  candidate_id: string | null;
  journal_id: string | null;
  sequence: string;
}
export function conflict(s: string): never {
  throw new ConflictException(s);
}
export function str(v: unknown, label: string, max = 140): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    invalid('Enter a valid ' + label + '.');
  return v.trim();
}
export function code(v: unknown) {
  const c = str(v, 'code', 60).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(c))
    invalid('Enter an alphanumeric code.');
  return c;
}
export function day(v: unknown): string {
  if (typeof v !== 'string' || !isFinanceDate(v))
    invalid('Enter a valid accounting date.');
  return v;
}
export function uuid(v: unknown): string {
  if (typeof v !== 'string' || !FINANCE_UUID.test(v))
    invalid('Select a valid record.');
  return v;
}
export function months(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 1200)
    invalid('Enter a useful life or term of 1 to 1,200 months.');
  return v;
}
export function value(v: unknown, scale: number, positive = false) {
  if (typeof v !== 'string' || !/^\d{1,18}(\.\d{1,12})?$/.test(v))
    invalid('Enter a nonnegative decimal amount.');
  const n = DecimalUtil.value(v);
  if (n.dp() > scale || (positive && n.isZero()))
    invalid('Check the amount and currency precision.');
  return n;
}
export function pct(v: unknown) {
  const n = value(v, 8);
  if (n.gt(100)) invalid('Enter a rate from 0 to 100 percent.');
  return n;
}
export const net = (a: Asset) =>
  new Decimal(a.cost).minus(a.accumulated).minus(a.impairment);
export const money = (n: Decimal.Value, scale: number) =>
  new Decimal(n).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toFixed();
