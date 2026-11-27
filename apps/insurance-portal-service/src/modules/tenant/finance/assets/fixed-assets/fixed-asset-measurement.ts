import Decimal from 'decimal.js';
import {
  invalid,
  type VoucherLine,
} from '../../accounting/general-ledger/finance-gl-program';
import {
  conflict,
  ambiguousLeaseSchedule,
  day,
  money,
  months,
  net,
  pct,
  value,
  type Asset,
  type Dimensions,
  type Input,
  type Instalment,
  type Policy,
  type Plan,
} from './fixed-asset.types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function shiftDay(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function shiftMonth(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z'),
    first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  first.setUTCDate(Math.min(last, d.getUTCDate()));
  return iso(first);
}
export const monthEnd = (date: string) =>
  shiftDay(shiftMonth(date.slice(0, 7) + '-01', 1), -1);
function monthWeight(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  return new Decimal(d.getUTCFullYear() * 12 + d.getUTCMonth()).plus(
    new Decimal(d.getUTCDate() - 1).div(Number(monthEnd(date).slice(-2))),
  );
}
export function policyTerms(
  v: Input,
): Pick<Policy, 'method' | 'life' | 'rate'> {
  if (!['NONE', 'STRAIGHT_LINE', 'DECLINING'].includes(v.method!))
    invalid('Select a depreciation method.');
  const method = v.method!,
    life = method === 'NONE' ? 0 : months(v.life),
    rate = method === 'DECLINING' ? pct(v.rate).toFixed() : '0';
  if (method === 'DECLINING' && rate === '0')
    invalid('Enter a positive declining-balance rate.');
  return { method, life, rate };
}
export function entry(
  lines: VoucherLine[],
  role: string | undefined,
  debit: Decimal.Value,
  credit: Decimal.Value,
  dimensions: Dimensions,
) {
  const dr = new Decimal(debit),
    cr = new Decimal(credit);
  if (dr.isZero() && cr.isZero()) return;
  if (!role)
    conflict('Configure the accounting role for this asset operation.');
  if (dr.isNegative() || cr.isNegative())
    invalid('Journal amounts must be nonnegative.');
  lines.push({ role, debit: dr.toFixed(), credit: cr.toFixed(), dimensions });
}
// A positive amount is funded by the source branch. Proceeds flow in the opposite direction.
export function clearBranches(
  policy: Policy,
  source: Dimensions,
  destination: Dimensions,
  amount: Decimal.Value,
  lines: VoucherLine[],
) {
  if (source.BRANCH === destination.BRANCH) return;
  const n = new Decimal(amount);
  if (n.isZero()) return;
  const { branchDueFrom, branchDueTo } = policy.roles;
  const credit =
    policy.branchClearing === 'SINGLE' ? branchDueFrom : branchDueTo;
  if (policy.branchClearing === 'NONE' || !branchDueFrom || !credit)
    conflict(
      'Approve the inter-branch clearing accounts and reclassify the asset before posting between branches.',
    );
  entry(
    lines,
    branchDueFrom,
    n.abs(),
    0,
    n.isNegative() ? destination : source,
  );
  entry(lines, credit, 0, n.abs(), n.isNegative() ? source : destination);
}

function charge(
  a: Asset,
  base: Decimal,
  start: string,
  until: string,
  scale: number,
) {
  const depreciable = Decimal.max(0, base.minus(a.residual));
  if (until >= a.end!) return depreciable;
  const elapsed = monthWeight(until).minus(monthWeight(start));
  const fraction =
    a.policy.method === 'DECLINING'
      ? new Decimal(1).minus(
          new Decimal(1)
            .minus(new Decimal(a.policy.rate).div(1200))
            .pow(elapsed),
        )
      : elapsed.div(monthWeight(a.end!).minus(monthWeight(start)));
  return Decimal.min(
    depreciable,
    new Decimal(
      money(
        (a.policy.method === 'DECLINING' ? base : depreciable).mul(fraction),
        scale,
      ),
    ),
  );
}
export function hasExpiredLeaseBalance(a: Asset) {
  return !!a.lease && hasExpiredDepreciableBalance(a);
}

export function hasExpiredDepreciableBalance(a: Asset) {
  return (
    a.policy.method !== 'NONE' &&
    a.status === 'ACTIVE' &&
    !!a.end &&
    !!a.through &&
    shiftDay(a.through, 1) >= a.end &&
    net(a).gt(a.residual)
  );
}

export function depreciation(
  a: Asset,
  through: string,
  scale: number,
  lines: VoucherLine[],
) {
  if (a.policy.method === 'NONE' || !a.end || !a.through) return new Decimal(0);
  const start = shiftDay(a.through, 1),
    until = shiftDay(through, 1) < a.end ? shiftDay(through, 1) : a.end;
  if (start >= until) return new Decimal(0);
  if (ambiguousLeaseSchedule(a))
    conflict(
      'Confirm the lease ownership basis in a reviewed estimate before depreciating beyond the contractual schedule.',
    );
  const n = charge(a, net(a), start, until, scale),
    shadow = charge(a, new Decimal(a.shadow), start, until, scale);
  a.through = shiftDay(until, -1);
  a.accumulated = new Decimal(a.accumulated).plus(n).toFixed();
  a.shadow = new Decimal(a.shadow).minus(shadow).toFixed();
  entry(lines, a.policy.roles.depreciation, n, 0, a.dimensions);
  entry(lines, a.policy.roles.accumulated, 0, n, a.dimensions);
  return n;
}
export function leaseSchedule(
  start: string,
  payments: string[],
  annual: string,
  scale: number,
  firstDue = shiftMonth(start, 1),
): Instalment[] {
  day(start);
  months(payments.length);
  day(firstDue);
  if (firstDue <= start)
    invalid('Choose a first rental date after the measurement date.');
  const regular = firstDue === shiftMonth(start, 1);
  const due = (i: number) =>
    regular
      ? shiftMonth(start, i + 1)
      : firstDue === monthEnd(firstDue)
        ? monthEnd(shiftMonth(firstDue, i))
        : shiftMonth(firstDue, i);
  const periods = regular
    ? new Decimal(1)
    : monthWeight(firstDue).minus(monthWeight(start));
  const rate = pct(annual).div(1200),
    factor = rate.plus(1);
  const amounts = payments.map((p) => value(p, scale));
  // Round outstanding present values, so each instalment reconciles at book precision.
  let future = new Decimal(0);
  const rows: Instalment[] = Array(payments.length);
  for (let i = amounts.length - 1; i >= 0; i--) {
    const closing = money(future, scale);
    const duration = i === 0 ? periods : new Decimal(1);
    future = future.plus(amounts[i]).div(factor.pow(duration));
    const opening = money(future, scale);
    rows[i] = {
      date: due(i),
      start: i === 0 ? start : due(i - 1),
      periods: duration.toFixed(),
      opening,
      interest: new Decimal(closing).plus(amounts[i]).minus(opening).toFixed(),
      payment: amounts[i].toFixed(),
      closing,
    };
  }
  if (new Decimal(rows[0].opening).lte(0))
    invalid('The lease must have a positive present value.');
  return rows;
}
export function scheduleFrom(v: Input, scale: number) {
  const payments =
    v.payments ?? Array<string>(months(v.leaseMonths)).fill(v.payment ?? '');
  if (!Array.isArray(payments))
    invalid('Supply the contracted monthly payments.');
  return leaseSchedule(
    v.date,
    payments,
    v.annualRate ?? '0',
    scale,
    v.firstDue,
  );
}
export function revalue(a: Asset, target: Decimal, lines: VoucherLine[]) {
  if (a.policy.model !== 'REVALUATION')
    conflict('Approve a revaluation model for this asset class.');
  const change = target.minus(net(a)),
    r = a.policy.roles,
    dim = a.dimensions;
  if (change.isZero()) return;
  entry(lines, r.accumulated, a.accumulated, 0, dim);
  entry(lines, r.impairment, a.impairment, 0, dim);
  const grossChange = target.minus(a.cost);
  entry(
    lines,
    r.asset,
    Decimal.max(0, grossChange),
    Decimal.max(0, grossChange.neg()),
    dim,
  );
  if (change.gt(0)) {
    const recovered = Decimal.min(change, a.deficit),
      reserve = change.minus(recovered);
    entry(lines, r.gain, 0, recovered, dim);
    entry(lines, r.surplus, 0, reserve, dim);
    a.deficit = new Decimal(a.deficit).minus(recovered).toFixed();
    a.surplus = new Decimal(a.surplus).plus(reserve).toFixed();
  } else {
    const down = change.neg(),
      reserve = Decimal.min(a.surplus, down),
      loss = down.minus(reserve);
    entry(lines, r.surplus, reserve, 0, dim);
    entry(lines, r.loss, loss, 0, dim);
    a.surplus = new Decimal(a.surplus).minus(reserve).toFixed();
    a.deficit = new Decimal(a.deficit).plus(loss).toFixed();
  }
  a.cost = target.toFixed();
  a.accumulated = '0';
  a.impairment = '0';
  a.lossInProfit = '0';
  a.shadow = target.toFixed();
}
export function impair(
  a: Asset,
  recoverable: Decimal,
  restore: boolean,
  lines: VoucherLine[],
) {
  const r = a.policy.roles,
    dim = a.dimensions,
    book = net(a);
  if (restore) {
    const n = Decimal.min(recoverable, a.shadow).minus(book);
    if (n.lte(0) || n.gt(a.impairment))
      conflict(
        'There is no recoverable impairment within the depreciated cost ceiling.',
      );
    const profit = Decimal.min(n, a.lossInProfit),
      reserve = n.minus(profit);
    entry(lines, r.impairment, n, 0, dim);
    entry(lines, r.loss, 0, profit, dim);
    entry(lines, r.surplus, 0, reserve, dim);
    a.impairment = new Decimal(a.impairment).minus(n).toFixed();
    a.lossInProfit = new Decimal(a.lossInProfit).minus(profit).toFixed();
    a.surplus = new Decimal(a.surplus).plus(reserve).toFixed();
    a.deficit = Decimal.max(0, new Decimal(a.deficit).minus(profit)).toFixed();
  } else {
    const n = book.minus(recoverable);
    if (n.lte(0))
      conflict('The recoverable amount must be below the carrying amount.');
    const reserve = Decimal.min(n, a.surplus),
      loss = n.minus(reserve);
    entry(lines, r.surplus, reserve, 0, dim);
    entry(lines, r.loss, loss, 0, dim);
    entry(lines, r.impairment, 0, n, dim);
    a.surplus = new Decimal(a.surplus).minus(reserve).toFixed();
    a.impairment = new Decimal(a.impairment).plus(n).toFixed();
    a.lossInProfit = new Decimal(a.lossInProfit).plus(loss).toFixed();
    a.deficit = new Decimal(a.deficit).plus(loss).toFixed();
  }
}
export function terminal(
  a: Asset,
  proceeds: Decimal,
  writtenOff: boolean,
  lines: VoucherLine[],
) {
  if (a.lease && new Decimal(a.lease.liability).gt(0))
    conflict('Settle or remeasure the outstanding lease liability first.');
  const r = a.policy.roles,
    dim = a.dimensions,
    netGain = proceeds.minus(net(a));
  entry(lines, r.accumulated, a.accumulated, 0, dim);
  entry(lines, r.impairment, a.impairment, 0, dim);
  entry(lines, r.asset, 0, a.cost, dim);
  entry(lines, r.loss, Decimal.max(0, netGain.neg()), 0, dim);
  entry(lines, r.gain, 0, Decimal.max(0, netGain), dim);
  entry(lines, r.surplus, a.surplus, 0, dim);
  entry(lines, r.retained, 0, a.surplus, dim);
  a.status = writtenOff ? 'WRITTEN_OFF' : 'DISPOSED';
  a.cost =
    a.accumulated =
    a.impairment =
    a.surplus =
    a.deficit =
    a.shadow =
    a.lossInProfit =
      '0';
}

export function catchUp(a: Asset, date: string, scale: number, p: Plan) {
  if (
    !a.through ||
    a.policy.method === 'NONE' ||
    !a.end ||
    a.through >= shiftDay(a.end, -1)
  )
    return;
  const before = shiftDay(date, -1);
  if (a.through === date) return;
  if (before < a.through)
    conflict(
      'This date has already been depreciated. Reverse the overlapping charge first.',
    );
  if (before > monthEnd(shiftDay(a.through, 1)))
    conflict('Post outstanding monthly depreciation before this event.');
  depreciation(a, before, scale, p.lines);
}
