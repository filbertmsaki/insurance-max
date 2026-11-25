import { BadRequestException } from '@nestjs/common';
import {
  FINANCE_UUID,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  candidateAmount,
  candidateCode,
  candidateText,
} from '../journal-entries/finance-journal-candidate.types';
import { previewBranchAllocation } from '../allocations/finance-branch-allocation';

export interface Evidence {
  id: string;
  documentId: string;
  hash: string;
}
export interface VoucherLine {
  role: string;
  debit: string;
  credit: string;
  dimensions: Record<string, string>;
}
export interface VoucherInput {
  reference: string;
  date: string;
  currency: string;
  description: string;
  lines: VoucherLine[];
  evidence?: Evidence;
  replacementOf?: string;
  adjustmentPeriodId?: string;
}
export type ProgramKind =
  | 'TEMPLATE'
  | 'RECURRING'
  | 'ACCRUAL'
  | 'PREPAYMENT'
  | 'INTERBRANCH'
  | 'ALLOCATION'
  | 'REVALUATION'
  | 'RECONCILIATION';
export const programKinds: ProgramKind[] = [
  'TEMPLATE',
  'RECURRING',
  'ACCRUAL',
  'PREPAYMENT',
  'INTERBRANCH',
  'ALLOCATION',
  'REVALUATION',
  'RECONCILIATION',
];
export interface ProgramDefinition {
  start: string;
  end: string;
  currency: string;
  description: string;
  evidence: Evidence;
  dimensions: Record<string, string>;
  lines?: VoucherLine[];
  templateId?: string;
  templateHash?: string;
  amount?: string;
  debitRole?: string;
  creditRole?: string;
  releaseRole?: string;
  accrualType?: 'EXPENSE' | 'INCOME';
  targetBranch?: string;
  clearingRole?: string;
  receivingClearingRole?: string;
  allocationBasis?: 'BRANCH' | 'COST_CENTRE';
  previewId?: string;
  previewHash?: string;
  targets?: { branch: string; weight: number; costCentre?: string }[];
  firstDue?: string;
  count?: number;
  monetaryRole?: string;
  gainRole?: string;
  lossRole?: string;
  owner?: 'FINANCE_IAS21';
  openingForeign?: string;
  openingFunctional?: string;
  openingCertificateId?: string;
  openingPositions?: {
    branch: string;
    currency: string;
    foreign: string;
    carrying: string;
  }[];
  account?: string;
  statementBalance?: string;
  exceptions?: {
    reference: string;
    description: string;
    amount: string;
    evidence?: Evidence;
    treatment?: 'NOTE' | 'ADD_TO_STATEMENT' | 'SUBTRACT_FROM_STATEMENT';
    resolved: boolean;
  }[];
}
export function invalid(s: string): never {
  throw new BadRequestException(s);
}
export function validEvidence(e: Evidence | undefined): e is Evidence {
  return (
    !!e &&
    FINANCE_UUID.test(e.id) &&
    FINANCE_UUID.test(e.documentId) &&
    /^[a-f0-9]{64}$/.test(e.hash)
  );
}
export function moneyMinor(amount: string, scale: number) {
  return candidateAmount(amount, scale).units / 10n ** BigInt(12 - scale);
}
export function fromMinor(n: bigint, scale: number) {
  if (n < 0n) return '-' + fromMinor(-n, scale);
  const s = n.toString().padStart(scale + 1, '0');
  return scale ? s.slice(0, -scale) + '.' + s.slice(-scale) : s;
}
export function dueDate(first: string, index: number) {
  const d = new Date(first + 'T00:00:00Z'),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + index);
  const end = new Date(d);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  d.setUTCDate(Math.min(day, end.getUTCDate()));
  return d.toISOString().slice(0, 10);
}
export function validateProgram(
  kind: ProgramKind,
  d: ProgramDefinition,
  scale: number,
) {
  if (
    !programKinds.includes(kind) ||
    !d ||
    !isFinanceDate(d.start) ||
    !isFinanceDate(d.end) ||
    d.end < d.start ||
    !candidateText(d.description, 1000) ||
    !validEvidence(d.evidence) ||
    !Number.isInteger(scale)
  )
    invalid(
      'Choose an effective date range, approved currency, description and owned evidence.',
    );
  if (kind === 'TEMPLATE' && (!Array.isArray(d.lines) || d.lines.length < 2))
    invalid('Enter the reusable journal lines.');
  if (
    kind === 'RECURRING' &&
    (!FINANCE_UUID.test(d.templateId ?? '') ||
      !/^[a-f0-9]{64}$/.test(d.templateHash ?? ''))
  )
    invalid('Pin an approved journal template version.');
  if (
    ['RECURRING', 'PREPAYMENT'].includes(kind) &&
    (!isFinanceDate(d.firstDue) ||
      d.firstDue < d.start ||
      !Number.isInteger(d.count) ||
      d.count! < 1 ||
      d.count! > 600 ||
      dueDate(d.firstDue, d.count! - 1) > d.end)
  )
    invalid('Specify one to 600 monthly due dates within the effective range.');
  if (['ACCRUAL', 'PREPAYMENT', 'INTERBRANCH', 'ALLOCATION'].includes(kind)) {
    if (
      moneyMinor(d.amount!, scale) <= 0n ||
      !candidateCode(d.debitRole) ||
      !FINANCE_UUID.test(d.dimensions?.BRANCH)
    )
      invalid('Select the source branch, posting role and positive amount.');
    if (
      kind !== 'ALLOCATION' &&
      (!candidateCode(d.creditRole) ||
        (d.debitRole === d.creditRole && kind !== 'INTERBRANCH'))
    )
      invalid('Select the debit and credit roles.');
    if (
      kind === 'PREPAYMENT' &&
      (!candidateCode(d.releaseRole) ||
        moneyMinor(d.amount!, scale) < BigInt(d.count!))
    )
      invalid(
        'Select an expense role and at least one minor unit per instalment.',
      );
    if (kind === 'ACCRUAL' && !candidateCode(d.releaseRole))
      invalid('Choose the settlement offset role.');
    if (
      kind === 'INTERBRANCH' &&
      (!FINANCE_UUID.test(d.targetBranch ?? '') ||
        d.targetBranch === d.dimensions.BRANCH ||
        !candidateCode(d.clearingRole))
    )
      invalid(
        'Two distinct approved branches and a clearing role are required.',
      );
    if (kind === 'ALLOCATION') allocationLines(d, scale);
  }
  if (kind === 'REVALUATION') {
    if (
      d.owner !== 'FINANCE_IAS21' ||
      ![d.monetaryRole, d.gainRole, d.lossRole].every(candidateCode) ||
      !FINANCE_UUID.test(d.dimensions?.BRANCH)
    )
      invalid(
        'Identify the finance-owned monetary account, branch and gain/loss roles.',
      );
    if (d.openingPositions === undefined) {
      if (typeof (d.openingForeign ?? '0') !== 'string')
        invalid('Enter a signed foreign opening amount.');
      moneyMinor((d.openingForeign ?? '0').replace(/^-/, ''), scale);
    }
  }
  if (kind === 'RECONCILIATION') {
    if (
      !candidateCode(d.account) ||
      typeof d.statementBalance !== 'string' ||
      !Array.isArray(d.exceptions) ||
      d.exceptions.length > 500
    )
      invalid('Supply the control account, statement balance and exceptions.');
    moneyMinor(d.statementBalance.replace(/^-/u, ''), scale);
    for (const e of d.exceptions) {
      if (
        !e ||
        !candidateText(e.reference) ||
        !candidateText(e.description, 1000) ||
        typeof e.resolved !== 'boolean' ||
        (e.treatment !== undefined &&
          !['NOTE', 'ADD_TO_STATEMENT', 'SUBTRACT_FROM_STATEMENT'].includes(
            e.treatment,
          ))
      )
        invalid('Identify each reconciling item and its resolution.');
      const units = moneyMinor(e.amount, scale);
      if (
        e.treatment &&
        e.treatment !== 'NOTE' &&
        (units === 0n || !validEvidence(e.evidence))
      )
        invalid(
          'Provide a positive amount and the supporting document version for each timing difference.',
        );
    }
    if (
      new Set(d.exceptions.map((e) => e.reference)).size !== d.exceptions.length
    )
      invalid('Exception references must be unique.');
  }
}
export const entry = (
  role: string,
  debit: string,
  credit: string,
  dimensions: Record<string, string>,
): VoucherLine => ({ role, debit, credit, dimensions });
function allocationLines(d: ProgramDefinition, scale: number) {
  if (d.allocationBasis === 'COST_CENTRE') {
    const centres = d.targets ?? [];
    if (
      !centres.length ||
      centres.length > 500 ||
      !d.dimensions.COST_CENTRE ||
      centres.some(
        (t) =>
          !t ||
          !candidateCode(t.costCentre) ||
          t.costCentre === d.dimensions.COST_CENTRE ||
          t.branch !== d.dimensions.BRANCH ||
          !Number.isInteger(t.weight) ||
          t.weight <= 0,
      ) ||
      new Set(centres.map((t) => t.costCentre)).size !== centres.length ||
      centres.reduce((n, t) => n + t.weight, 0) !== 1000000
    )
      invalid(
        'Select distinct recipient cost centres in this branch with weights totalling one million.',
      );
    const total = moneyMinor(d.amount!, scale),
      denominator = 1000000n;
    const shares = centres.map((t) => {
      const n = total * BigInt(t.weight);
      return {
        centre: t.costCentre!,
        amount: n / denominator,
        remainder: n % denominator,
      };
    });
    shares.sort((a, b) =>
      a.remainder === b.remainder
        ? a.centre < b.centre
          ? -1
          : 1
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
    const extra = Number(total - shares.reduce((s, t) => s + t.amount, 0n));
    shares.slice(0, extra).forEach((t) => t.amount++);
    return [
      entry(d.debitRole!, '0', d.amount!, d.dimensions),
      ...shares
        .filter((t) => t.amount > 0n)
        .sort((a, b) => (a.centre < b.centre ? -1 : 1))
        .map((t) =>
          entry(d.debitRole!, fromMinor(t.amount, scale), '0', {
            ...d.dimensions,
            COST_CENTRE: t.centre,
          }),
        ),
    ];
  }
  if (
    !Array.isArray(d.targets) ||
    d.targets.some((t) => !t || !FINANCE_UUID.test(t.branch))
  )
    invalid('Choose approved target branches and allocation weights.');
  return previewBranchAllocation({
    sourceBranch: d.dimensions.BRANCH.toUpperCase(),
    expenseRole: d.debitRole!,
    interbranchRole: d.clearingRole!,
    amountMinor: moneyMinor(d.amount!, scale).toString(),
    targets: d.targets.map((t) => ({
      branch: t.branch.toUpperCase(),
      weight: t.weight,
    })),
  }).map((l) =>
    entry(
      l.role,
      fromMinor(BigInt(l.debitMinor), scale),
      fromMinor(BigInt(l.creditMinor), scale),
      { ...d.dimensions, BRANCH: l.branch.toLowerCase() },
    ),
  );
}
export function programLines(
  kind: ProgramKind,
  d: ProgramDefinition,
  stage: string,
  index: number,
  scale: number,
): VoucherLine[] {
  const a = d.amount!,
    v = d.dimensions;
  if (kind === 'ALLOCATION') return allocationLines(d, scale);
  if (kind === 'INTERBRANCH') {
    const dest = { ...v, BRANCH: d.targetBranch! };
    return [
      entry(d.debitRole!, a, '0', dest),
      entry(d.receivingClearingRole ?? d.clearingRole!, '0', a, dest),
      entry(d.clearingRole!, a, '0', v),
      entry(d.creditRole!, '0', a, v),
    ];
  }
  if (stage === 'AMORTIZE') {
    const total = moneyMinor(a, scale),
      count = BigInt(d.count!);
    const n = total / count + (BigInt(index) < total % count ? 1n : 0n),
      amt = fromMinor(n, scale);
    return [
      entry(d.releaseRole!, amt, '0', v),
      entry(d.debitRole!, '0', amt, v),
    ];
  }
  if (stage === 'SETTLE' && d.accrualType === 'INCOME')
    return [entry(d.releaseRole!, a, '0', v), entry(d.debitRole!, '0', a, v)];
  if (stage === 'SETTLE')
    return [entry(d.creditRole!, a, '0', v), entry(d.releaseRole!, '0', a, v)];
  return [entry(d.debitRole!, a, '0', v), entry(d.creditRole!, '0', a, v)];
}
