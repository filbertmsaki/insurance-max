import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';
import type { ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import { invalid } from '../../accounting/general-ledger/finance-gl-program';
import {
  entry,
  terminal,
  catchUp,
  scheduleFrom,
  shiftMonth,
  shiftDay,
} from './fixed-asset-measurement';
import { funding, startUse } from './fixed-asset-register';
import {
  conflict,
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
  for (let i = lease.index; i < lease.schedule.length; i++) {
    const row = lease.schedule[i];
    if (row.accrued) continue;
    if (row.date <= date) {
      earned = earned.plus(row.interest);
      row.accrued = true;
      continue;
    }
    const start = row.start ?? (i ? lease.schedule[i - 1].date : lease.anchor);
    if (date > start) {
      const elapsed = new Decimal(Date.parse(date) - Date.parse(start))
        .div(Date.parse(row.date) - Date.parse(start))
        .mul(row.periods ?? 1);
      const interest = new Decimal(row.opening)
        .mul(
          new Decimal(lease.annualRate).div(1200).plus(1).pow(elapsed).minus(1),
        )
        .toDecimalPlaces(scale);
      earned = earned.plus(Decimal.min(interest, row.interest));
    }
    break;
  }
  entry(plan.lines, a.policy.roles.interest, earned, 0, a.dimensions);
  entry(plan.lines, a.policy.roles.liability, 0, earned, a.dimensions);
  lease.liability = new Decimal(lease.liability).plus(earned).toFixed();
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
  // An explicitly evidenced ownership transfer/purchase option can support a useful life beyond the lease term.
  const usefulLifeEnd = shiftMonth(v.date, a.policy.life);
  a.policy.life = v.life
    ? months(v.life)
    : Math.min(a.policy.life, schedule.length);
  startUse(a, v.date, money(v.residual ?? '0'));
  if (!v.life)
    a.end = [usefulLifeEnd, schedule[schedule.length - 1].date].sort()[0];
  a.lease = {
    schedule,
    index: 0,
    accrued: false,
    paid: '0',
    liability: pv.toFixed(),
    annualRate: v.annualRate ?? '0',
    anchor: v.date,
  };
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
    a.end = v.life
      ? shiftMonth(v.date, months(v.life))
      : schedule[schedule.length - 1].date;
    a.through = a.through === v.date ? v.date : shiftDay(v.date, -1);
    a.lease = {
      schedule: [...arrears, ...schedule],
      index: 0,
      accrued: arrears.length > 0,
      paid: arrears[0]?.paid ?? '0',
      liability: balance.toFixed(),
      annualRate: v.annualRate ?? '0',
      anchor: v.date,
    };
    plan.amount = balance.toFixed();
  } else {
    if (!due || v.date < due.date)
      conflict('Choose the next due lease instalment.');
    if (k === 'LEASE_INTEREST') {
      if (due.accrued)
        conflict('Interest is already recorded for this instalment.');
      entry(lines, r.interest, due.interest, 0, dim);
      entry(lines, r.liability, 0, due.interest, dim);
      l.liability = new Decimal(l.liability).plus(due.interest).toFixed();
      due.accrued = true;
    } else {
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
