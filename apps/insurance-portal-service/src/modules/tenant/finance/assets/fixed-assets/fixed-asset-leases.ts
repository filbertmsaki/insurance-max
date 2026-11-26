import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';
import type { ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import { invalid } from '../../accounting/general-ledger/finance-gl-program';
import {
  entry,
  impair,
  hasExpiredLeaseBalance,
  terminal,
  catchUp,
  scheduleFrom,
  shiftMonth,
  shiftDay,
} from './fixed-asset-measurement';
import { funding, startUse } from './fixed-asset-register';
import {
  conflict,
  leaseBasis,
  needsLeaseBasis,
  months,
  net,
  str,
  value,
  type Asset,
  type Input,
  type Plan,
} from './fixed-asset.types';

function accrueThrough(a: Asset, date: string, plan: Plan, scale: number) {
  const lease = a.lease!;
  let earned = new Decimal(0);
  let progressed = false;
  for (let i = lease.index; i < lease.schedule.length; i++) {
    const row = lease.schedule[i];
    if (row.accrued) continue;
    const start = row.start ?? (i ? lease.schedule[i - 1].date : lease.anchor);
    const through = date < row.date ? date : row.date;
    if (through <= (row.accruedThrough ?? start)) break;
    const full = through === row.date;
    const elapsed = new Decimal(Date.parse(through) - Date.parse(start))
      .div(Date.parse(row.date) - Date.parse(start))
      .mul(row.periods ?? 1);
    const target = full
      ? new Decimal(row.interest)
      : Decimal.min(
          row.interest,
          new Decimal(row.opening)
            .mul(
              new Decimal(lease.annualRate)
                .div(1200)
                .plus(1)
                .pow(elapsed)
                .minus(1),
            )
            .toDecimalPlaces(scale),
        );
    // Calculate cumulative interest at book precision so the final instalment absorbs rounding.
    earned = earned.plus(target.minus(row.accruedInterest ?? 0));
    row.accruedThrough = through;
    row.accruedInterest = target.toFixed();
    row.accrued = full;
    progressed = true;
    if (!full) break;
  }
  entry(plan.lines, a.policy.roles.interest, earned, 0, a.dimensions);
  entry(plan.lines, a.policy.roles.liability, 0, earned, a.dimensions);
  lease.liability = new Decimal(lease.liability).plus(earned).toFixed();
  return progressed;
}

export function setUsefulLifeEnd(a: Asset, end: string | null) {
  a.end = end;
  if (!a.lease) return;
  if (!end) invalid('Right-of-use assets require a remaining useful life.');
  a.lease.usefulLifeEnd = end;
  if (leaseBasis(undefined, a.lease) === 'LEASE_TERM') {
    const rentals = a.lease.schedule;
    a.end =
      end < rentals[rentals.length - 1].date
        ? end
        : rentals[rentals.length - 1].date;
  }
}

export function confirmLeaseBasis(a: Asset, input: Input['ownershipBasis']) {
  if (!a.lease)
    invalid('Select a right-of-use asset for the ownership decision.');
  const ambiguous = needsLeaseBasis(a.lease);
  const basis = leaseBasis(input, a.lease);
  a.lease.ownershipBasis = basis;
  a.lease.ownershipTransfer = basis !== 'LEASE_TERM';
  // An old inferred election needs a real decision before pricing unposted depreciation.
  if (ambiguous && a.lease.usefulLifeEnd)
    setUsefulLifeEnd(a, a.lease.usefulLifeEnd);
}

// Older register snapshots kept only the shorter of the category life and the rental term.
export async function restoreLeaseLife(
  m: EntityManager,
  bookId: string,
  assets: Asset[],
  asOf: string,
) {
  for (const a of assets) {
    if (a.lease?.usefulLifeEnd && !a.lease.ownershipBasis)
      a.lease.ownershipBasis = a.lease.ownershipTransfer
        ? 'UNCONFIRMED'
        : 'LEASE_TERM';
  }
  const legacy = new Map(
    assets
      .filter((a) => a.lease && !a.lease.usefulLifeEnd)
      .map((a) => [a.code, a]),
  );
  if (!legacy.size) return;
  const decisions: {
    code: string;
    kind: string;
    effective: string;
    in_service: string;
    explicit_life: string | null;
    basis: Input['ownershipBasis'] | null;
    policy_life: number;
  }[] = await m.query(
    `SELECT d.code,d.kind,d.effective_date::text AS effective,d.plan->'asset'->>'inService' AS in_service,d.input->>'life' AS explicit_life,d.input->>'ownershipBasis' AS basis,
      coalesce((SELECT (c.plan->'master'->'policy'->>'life')::int FROM finance_fa_documents c
        WHERE d.kind='LEASE_START' AND c.book_id=d.book_id AND c.kind='CATEGORY' AND c.code=d.plan->'asset'->>'category'
        AND c.state='POSTED' AND c.effective_date<=d.effective_date AND c.sequence<d.sequence
        ORDER BY c.effective_date DESC,c.sequence DESC LIMIT 1),(d.plan->'asset'->'policy'->>'life')::int) AS policy_life
      FROM finance_fa_documents d WHERE d.book_id=$1 AND d.code=ANY($2::text[]) AND d.state='POSTED' AND d.effective_date<=$3
      AND (d.kind IN ('LEASE_START','OPENING') OR (d.kind IN ('ESTIMATE','LEASE_REMEASURE') AND d.input->>'life' IS NOT NULL))
      AND NOT EXISTS(SELECT 1 FROM finance_fa_documents r WHERE r.reversal_of=d.id AND r.state='POSTED' AND r.effective_date<=$3) ORDER BY d.sequence`,
    [bookId, [...legacy.keys()], asOf],
  );
  for (const d of decisions) {
    const a = legacy.get(d.code)!;
    const lease = a.lease!;
    let ceiling: string;
    if (d.kind === 'LEASE_START' || d.kind === 'OPENING') {
      const hasLife =
        !!d.explicit_life && (d.kind === 'LEASE_START' || !!d.basis);
      lease.ownershipBasis =
        d.basis ?? (hasLife ? 'UNCONFIRMED' : 'LEASE_TERM');
      ceiling = shiftMonth(
        d.in_service,
        hasLife ? months(Number(d.explicit_life)) : d.policy_life,
      );
    } else {
      ceiling = shiftMonth(d.effective, months(Number(d.explicit_life)));
      if (d.basis) lease.ownershipBasis = d.basis;
      else if (d.kind === 'LEASE_REMEASURE')
        lease.ownershipBasis = 'UNCONFIRMED';
    }
    if (lease.ownershipBasis === 'UNCONFIRMED') {
      lease.usefulLifeEnd = ceiling;
      if (!a.end || a.end > ceiling) a.end = ceiling;
    } else {
      lease.ownershipTransfer = lease.ownershipBasis !== 'LEASE_TERM';
      setUsefulLifeEnd(a, ceiling);
    }
  }
  if ([...legacy.values()].some((a) => !a.lease?.usefulLifeEnd))
    conflict(
      'Verify the approved useful life in the opening or commencement document.',
    );
}

export async function closeLease(
  m: EntityManager,
  b: ActivePostingBook,
  a: Asset,
  v: Input,
  p: Plan,
  scale: number,
) {
  const l = a.lease;
  if (!l) conflict('Choose a lease to terminate.');
  str(v.note, 'lease termination agreement', 1000);
  const roles = a.policy.roles,
    dim = a.dimensions;
  accrueThrough(a, v.date, p, scale);
  const waived = new Decimal(l.liability),
    fee = value(v.amount ?? '0', scale);
  entry(p.lines, roles.liability, waived, 0, dim);
  if (fee.gt(0)) {
    const src = await funding(m, b, v, p, [roles.clearing], fee, 'debit');
    entry(p.lines, roles.clearing, 0, fee, src.dimensions);
  }
  l.liability = '0';
  terminal(a, waived.minus(fee), false, p.lines);
}
export function exemptLease(a: Asset, v: Input, expiry: string) {
  if (
    !v.exemption ||
    !['SHORT_TERM', 'LOW_VALUE'].includes(v.exemption) ||
    (v.exemption === 'SHORT_TERM' && v.leaseMonths! > 12)
  )
    invalid('Document the approved short-term or low-value exemption.');
  str(v.note, 'exemption assessment', 1000);
  a.status = 'EXEMPT';
  a.inService = v.date;
  a.exemption = { basis: v.exemption, end: expiry, expense: '0' };
}

export async function commenceLease(
  m: EntityManager,
  b: ActivePostingBook,
  a: Asset,
  v: Input,
  plan: Plan,
  scale: number,
) {
  const r = a.policy.roles,
    dim = a.dimensions,
    lines = plan.lines;
  const money = (s: unknown, positive = false) => value(s, scale, positive);
  if (!r.liability || !r.interest || a.policy.method === 'NONE')
    invalid(
      'Select a depreciable category with lease liability and interest roles.',
    );
  const schedule = scheduleFrom(v, scale),
    pv = new Decimal(schedule[0].opening);
  const raw = v.initialAdjustment ?? '0';
  if (typeof raw !== 'string') invalid('Enter an initial lease adjustment.');
  const adj = money(raw.replace(/^-/, '')).mul(raw.startsWith('-') ? -1 : 1);
  if (!adj.isZero()) {
    const source = await funding(
      m,
      b,
      v,
      plan,
      [r.clearing],
      adj.abs(),
      adj.gt(0) ? 'debit' : 'credit',
    );
    entry(
      lines,
      r.clearing,
      Decimal.max(0, adj.neg()),
      Decimal.max(0, adj),
      source.dimensions,
    );
  }
  a.cost = pv.plus(adj).toFixed();
  if (new Decimal(a.cost).lte(0))
    invalid('Check the initial right-of-use cost.');
  a.sourceCost = a.cost;
  const basis = leaseBasis(v.ownershipBasis);
  if (v.life !== undefined) a.policy.life = months(v.life);
  startUse(a, v.date, money(v.residual ?? '0'));
  a.lease = {
    schedule,
    index: 0,
    accrued: false,
    paid: '0',
    liability: pv.toFixed(),
    annualRate: v.annualRate ?? '0',
    anchor: v.date,
    ownershipBasis: basis,
    ownershipTransfer: basis !== 'LEASE_TERM',
  };
  setUsefulLifeEnd(a, a.end);
  entry(lines, r.asset, a.cost, 0, dim);
  entry(lines, r.liability, 0, pv, dim);
  plan.amount = a.cost;
}

export async function serviceLease(
  m: EntityManager,
  b: ActivePostingBook,
  a: Asset,
  v: Input,
  plan: Plan,
  scale: number,
) {
  const r = a.policy.roles,
    dim = a.dimensions,
    lines = plan.lines;
  const money = (s: unknown, positive = false) => value(s, scale, positive);
  const k = v.kind;
  const l = a.lease;
  if (!l) conflict('Choose a right-of-use asset.');
  const due =
    k === 'LEASE_INTEREST'
      ? l.schedule.find((p, i) => i >= l.index && !p.accrued)
      : l.schedule[l.index];
  if (k === 'LEASE_REMEASURE') {
    const basis = leaseBasis(v.ownershipBasis, l);
    if (needsLeaseBasis(l)) confirmLeaseBasis(a, basis);
    accrueThrough(a, v.date, plan, scale);
    if (
      v.rescheduleArrears !== undefined &&
      typeof v.rescheduleArrears !== 'boolean'
    )
      invalid('Confirm how the agreement treats unpaid rent.');
    const arrears = v.rescheduleArrears
      ? []
      : l.schedule
          .slice(l.index)
          .filter(
            (row) =>
              row.date <= v.date && new Decimal(row.payment).gt(row.paid ?? 0),
          );
    const unpaid = arrears.reduce(
      (n, row) => n.plus(row.payment).minus(row.paid ?? 0),
      new Decimal(0),
    );
    const nextDate = l.schedule.find((row) => row.date > v.date)?.date;
    const schedule = scheduleFrom(
      { ...v, firstDue: v.firstDue ?? nextDate },
      scale,
    );
    const balance = new Decimal(schedule[0].opening).plus(unpaid),
      delta = balance.minus(l.liability);
    // Keep the carrying amount current before resetting the remaining term.
    catchUp(a, v.date, scale, plan);
    if (delta.gte(0)) {
      entry(lines, r.asset, delta, 0, dim);
      entry(lines, r.liability, 0, delta, dim);
    } else {
      const decrease = delta.neg(),
        asset = Decimal.min(decrease, net(a));
      entry(lines, r.liability, decrease, 0, dim);
      entry(lines, r.asset, 0, asset, dim);
      entry(lines, r.gain, 0, decrease.minus(asset), dim);
    }
    a.cost = Decimal.max(
      new Decimal(a.accumulated).plus(a.impairment),
      new Decimal(a.cost).plus(delta),
    ).toFixed();
    a.shadow = Decimal.max(
      net(a),
      new Decimal(a.shadow).plus(delta),
      0,
    ).toFixed();
    const finalRental = l.schedule[l.schedule.length - 1].date;
    const lifeEnd =
      v.life !== undefined
        ? shiftMonth(v.date, months(v.life))
        : (l.usefulLifeEnd ??
          (a.end && a.end !== finalRental
            ? a.end
            : shiftMonth(a.inService!, a.policy.life)));
    a.through = a.through === v.date ? v.date : shiftDay(v.date, -1);
    a.lease = {
      schedule: [...arrears, ...schedule],
      index: 0,
      accrued: arrears.length > 0,
      paid: arrears[0]?.paid ?? '0',
      liability: balance.toFixed(),
      annualRate: v.annualRate ?? '0',
      anchor: v.date,
      ownershipBasis: basis,
      ownershipTransfer: basis !== 'LEASE_TERM',
    };
    setUsefulLifeEnd(a, lifeEnd);
    const expired = hasExpiredLeaseBalance(a);
    if (expired && v.expiryRecoverableAmount === undefined)
      conflict(
        'Approve a remaining useful life or an evidenced recoverable amount for the balance after depreciation ends.',
      );
    if (v.expiryRecoverableAmount !== undefined) {
      const recoverable = money(v.expiryRecoverableAmount);
      if (!expired || recoverable.gt(a.residual))
        invalid(
          'An expiry assessment must leave at most the approved residual value. Review the remaining useful life for continuing use.',
        );
      impair(a, recoverable, false, lines);
    }
    plan.amount = balance.toFixed();
  } else {
    if (k === 'LEASE_INTEREST') {
      if (!accrueThrough(a, v.date, plan, scale))
        conflict(
          'Interest is already accrued through this date or the lease has ended.',
        );
    } else {
      if (!due || v.date < due.date)
        conflict('Choose the next due lease instalment.');
      if (!due.accrued)
        conflict('Accrue the instalment interest before payment.');
      const n = money(v.amount, true),
        remaining = new Decimal(due.payment).minus(l.paid);
      if (n.gt(remaining))
        conflict('Payment exceeds the unsettled instalment.');
      const source = await funding(
        m,
        b,
        v,
        plan,
        [r.clearing, r.liability],
        n,
        'debit',
      );
      if (
        source.role !== r.liability ||
        hash(source.dimensions) !== hash(dim)
      ) {
        entry(lines, r.liability, n, 0, dim);
        entry(lines, source.role, 0, n, source.dimensions);
      }
      l.liability = new Decimal(l.liability).minus(n).toFixed();
      due.paid = new Decimal(l.paid).plus(n).toFixed();
      plan.amount = n.toFixed();
    }
    while (l.index < l.schedule.length) {
      const next = l.schedule[l.index];
      if (!next.accrued || !new Decimal(next.paid ?? 0).eq(next.payment)) break;
      l.index++;
    }
    l.accrued = !!l.schedule[l.index]?.accrued;
    l.paid = l.schedule[l.index]?.paid ?? '0';
  }
}
