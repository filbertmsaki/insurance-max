import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';
import { type ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import { certifiedOpening } from '../../accounting/general-ledger/finance-gl-balances';
import { invalid } from '../../accounting/general-ledger/finance-gl-program';
import {
  ambiguousLeaseSchedule,
  needsLeaseBasis,
  day,
  net,
  type Asset,
  type Roles,
} from './fixed-asset.types';
import {
  depreciation,
  hasExpiredLeaseBalance,
  monthEnd,
  shiftDay,
} from './fixed-asset-measurement';
import { restoreLeaseLife } from './fixed-asset-leases';

export function classValuations(
  m: EntityManager,
  book: string,
  cutoff: string,
) {
  return m.query(
    'SELECT v.*,v.effective_date::text FROM finance_fa_valuation_coverage($1,$2) v ORDER BY v.effective_date DESC,v.reference,v.run_id',
    [book, cutoff],
  );
}
export async function assetRegister(
  m: EntityManager,
  book: string,
  to: string,
): Promise<Asset[]> {
  const assets = (
    await m.query(
      `SELECT latest.asset FROM (SELECT DISTINCT ON (code) code,plan->'asset' asset FROM finance_fa_documents WHERE book_id=$1 AND state='POSTED' AND effective_date<=$2 AND kind NOT IN ('CATEGORY','GROUP','LOCATION') ORDER BY code,effective_date DESC,sequence DESC) latest WHERE jsonb_typeof(asset)='object' ORDER BY code`,
      [book, to],
    )
  ).map((r: { asset: Asset }) => r.asset);
  await restoreLeaseLife(m, book, assets, to);
  return assets;
}
export function leaseReview(assets: Asset[]) {
  return assets.flatMap((a) => {
    if (!a.lease || a.status !== 'ACTIVE') return [];
    const reasons: string[] = [];
    if (needsLeaseBasis(a.lease))
      reasons.push(
        'Confirm the ownership or purchase-option terms from the lease agreement.',
      );
    if (hasExpiredLeaseBalance(a))
      reasons.push(
        'Carrying amount exceeds residual value after depreciation ended. Review remaining life or impairment.',
      );
    return reasons.length ? [{ code: a.code, reasons }] : [];
  });
}
export function nextDepreciation(a: Asset, scale: number) {
  if (
    a.status !== 'ACTIVE' ||
    ambiguousLeaseSchedule(a) ||
    !a.through ||
    !a.end ||
    a.policy.method === 'NONE' ||
    shiftDay(a.through, 1) >= a.end
  )
    return null;
  const date = [
    monthEnd(shiftDay(a.through, 1)),
    shiftDay(a.end, -1),
  ].sort()[0];
  return {
    code: a.code,
    date,
    amount: depreciation({ ...a }, date, scale, []).toFixed(),
  };
}
export async function assetReport(
  m: EntityManager,
  b: ActivePostingBook,
  from: string,
  to: string,
) {
  if (day(from) > day(to)) invalid('Choose a valid reporting period.');
  const opening = await assetRegister(m, b.book_id, shiftDay(from, -1)),
    closing = await assetRegister(m, b.book_id, to);
  const activity = await m.query(
    `SELECT d.code,d.kind,d.reference,d.effective_date::text,d.journal_id,d.plan->>'amount' amount,d.plan->'asset'->>'status' status,
 d.plan->'asset'->>'category' category,d.plan->'asset'->>'location' location,
 ((coalesce((d.plan->'asset'->>'cost')::numeric,0)-coalesce((d.plan->'asset'->>'accumulated')::numeric,0)-coalesce((d.plan->'asset'->>'impairment')::numeric,0))-
 (coalesce((p.plan->'asset'->>'cost')::numeric,0)-coalesce((p.plan->'asset'->>'accumulated')::numeric,0)-coalesce((p.plan->'asset'->>'impairment')::numeric,0)))::text carrying_change
 FROM finance_fa_documents d LEFT JOIN finance_fa_documents p ON p.id=d.prior_id WHERE d.book_id=$1 AND d.state='POSTED' AND d.kind NOT IN ('GROUP','CATEGORY','LOCATION') AND d.effective_date BETWEEN $2 AND $3 ORDER BY d.effective_date,d.sequence`,
    [b.book_id, from, to],
  );
  const sum = (assets: Asset[], fn: (a: Asset) => Decimal.Value) =>
    assets.reduce((n, a) => n.plus(fn(a)), new Decimal(0)).toFixed();
  const certificate = await certifiedOpening(m, b.book_id, to);
  const controls = new Map<string, Decimal>();
  const add = (account: string | undefined, n: Decimal.Value) => {
    if (account)
      controls.set(account, (controls.get(account) ?? new Decimal(0)).plus(n));
  };
  const categories = await m.query(
    "SELECT DISTINCT plan->'master'->'policy'->'accounts' accounts FROM finance_fa_documents WHERE book_id=$1 AND kind='CATEGORY' AND state='POSTED' AND effective_date<=$2",
    [b.book_id, to],
  );
  for (const { accounts } of categories)
    for (const role of [
      'asset',
      'accumulated',
      'impairment',
      'surplus',
      'liability',
    ])
      add(accounts[role], 0);
  for (const a of closing) {
    const r = a.policy.accounts;
    add(
      r.asset,
      a.status === 'ACQUIRED' && a.sourceRole === a.policy.roles.asset
        ? a.sourceCost
        : a.cost,
    );
    for (const [role, n] of [
      ['accumulated', a.accumulated],
      ['impairment', a.impairment],
      ['surplus', a.surplus],
      ['liability', a.lease?.liability ?? '0'],
    ] as const)
      add(r[role as keyof Roles], new Decimal(n).neg());
  }
  const movements = await m.query(
    `SELECT l.account_code,sum(l.functional_debit-l.functional_credit)::text net FROM finance_foundation_journals j JOIN finance_foundation_lines l ON l.journal_id=j.id WHERE j.book_id=$1 AND j.mode='LIVE' AND j.accounting_date BETWEEN $2 AND $3 AND l.account_code=ANY($4::text[]) GROUP BY l.account_code`,
    [b.book_id, certificate.payload.date, to, [...controls.keys()]],
  );
  const reconciliation = Array.from(controls, ([account, n]) => {
    const balance = new Decimal(
      certificate.payload.balances.find(
        (r: { accountCode: string }) => r.accountCode === account,
      )?.signedBalance ?? 0,
    ).plus(
      movements.find(
        (r: { account_code: string }) => r.account_code === account,
      )?.net ?? 0,
    );
    return {
      account,
      register: n.toFixed(),
      ledger: balance.toFixed(),
      difference: balance.minus(n).toFixed(),
    };
  });
  return {
    currency: b.context.functionalCurrency,
    from,
    to,
    opening: sum(opening, net),
    change: activity
      .reduce(
        (n: Decimal, r: { carrying_change: string }) =>
          n.plus(r.carrying_change),
        new Decimal(0),
      )
      .toFixed(),
    closing: sum(closing, net),
    cost: sum(closing, (a) => a.cost),
    depreciation: sum(closing, (a) => a.accumulated),
    impairment: sum(closing, (a) => a.impairment),
    leaseLiability: sum(closing, (a) => a.lease?.liability ?? 0),
    assets: closing,
    valuations: await classValuations(m, b.book_id, to),
    activity,
    reconciliation,
  };
}
