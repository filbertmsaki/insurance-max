import Decimal from 'decimal.js';
import {
  closeLease,
  exemptLease,
  commenceLease,
  serviceLease,
  restoreLeaseLife,
  setUsefulLifeEnd,
} from './fixed-asset-leases';
import type { EntityManager } from 'typeorm';
import {
  bookChart,
  ownedEvidence,
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import { voucherLines } from '../../accounting/general-ledger/finance-gl-voucher.service';
import { invalid } from '../../accounting/general-ledger/finance-gl-program';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import {
  depreciation,
  entry,
  impair,
  monthEnd,
  policyTerms,
  revalue,
  catchUp,
  shiftDay,
  shiftMonth,
  terminal,
} from './fixed-asset-measurement';
import {
  dimensions,
  funding,
  head,
  master,
  masterPlan,
  newAsset,
  opening,
  record,
  startUse,
} from './fixed-asset-register';
import {
  code,
  conflict,
  day,
  isMaster,
  kinds,
  months,
  str,
  uuid,
  value,
  type Asset,
  type Input,
  type Plan,
  type Roles,
} from './fixed-asset.types';

export async function prepareAsset(
  m: EntityManager,
  b: ActivePostingBook,
  input: Input,
) {
  if (!input || !kinds.includes(input.kind))
    invalid('Select a fixed asset operation.');
  const v = { ...input, code: code(input.code), date: day(input.date) },
    k = v.kind;
  str(v.reference, 'reference');
  str(v.requestKey, 'request key', 180);
  await ownedEvidence(m, b, v.evidence);
  const scale = b.context.currencyScales[b.context.functionalCurrency];
  const plan: Plan = { asset: null, lines: [], amount: '0' };
  if (isMaster(k)) {
    plan.master = await masterPlan(m, b, v);
    return { plan, prior: null };
  }
  const prev = await head(m, b.book_id, v.code);
  const prior = prev?.id ?? null;
  if (prev && prev.effective_date > v.date)
    conflict('Use a date on or after the last register event.');
  if (k === 'REVERSE') {
    const origin = await record(m, b.book_id, uuid(v.original));
    const [latest] = await m.query(
      `SELECT d.id FROM finance_fa_documents d WHERE d.book_id=$1 AND d.code=$2 AND d.state='POSTED' AND d.kind NOT IN ('CATEGORY','GROUP','LOCATION','REVERSE') AND NOT EXISTS(SELECT 1 FROM finance_fa_documents r WHERE r.reversal_of=d.id AND r.state='POSTED') ORDER BY d.sequence DESC LIMIT 1`,
      [b.book_id, v.code],
    );
    if (origin.id !== latest?.id)
      conflict('Reverse later asset events before this transaction.');
    plan.asset = origin.prior_id
      ? (await record(m, b.book_id, origin.prior_id)).plan.asset
      : null;
    plan.lines = origin.plan.lines.map((l) => ({
      ...l,
      debit: l.credit,
      credit: l.debit,
    }));
    plan.amount = origin.plan.amount;
    return { plan, prior };
  }
  let a: Asset;
  const money = (s: unknown, positive = false) => value(s, scale, positive);
  const creates = [
    'ACQUIRE',
    'OPENING',
    'LEASE_START',
    'LEASE_EXEMPT',
  ].includes(k);
  if (creates) {
    if (prev?.plan.asset) conflict('This asset code is already registered.');
    a = await newAsset(m, b, v);
  } else {
    if (
      !prev?.plan.asset ||
      ['DISPOSED', 'WRITTEN_OFF'].includes(prev.plan.asset.status)
    )
      conflict('Choose an existing asset still on the register.');
    a = prev.plan.asset;
    await restoreLeaseLife(m, b.book_id, [a], v.date);
  }
  const chart = await bookChart(m, b);
  for (const [key, role] of Object.entries(a.policy.roles)) {
    const account = chart.roles.find((r) => r.code === role)?.accountCode;
    if (account === a.policy.accounts[key as keyof Roles]) continue;
    if (k === 'RECLASSIFY') {
      const alias = chart.roles.find(
        (x) => x.accountCode === a.policy.accounts[key as keyof Roles],
      );
      if (alias) a.policy.roles[key as keyof Roles] = alias.code;
      else delete a.policy.roles[key as keyof Roles];
      continue;
    }
    conflict(
      'The asset account mapping has changed. Restore the pinned account or complete a reviewed reclassification.',
    );
  }
  plan.asset = a;
  const lines = plan.lines,
    r = a.policy.roles,
    dim = a.dimensions;
  if (k === 'ACQUIRE') {
    const cost = money(v.amount, true);
    const source = await funding(
      m,
      b,
      v,
      plan,
      [r.clearing, r.asset],
      cost,
      'debit',
    );
    a.sourceRole = source.role;
    a.sourceDimensions = source.dimensions;
    a.sourceCost = cost.toFixed();
    plan.amount = a.sourceCost;
  } else if (k === 'OPENING') {
    await opening(m, b, v, a, plan, scale);
  } else if (k === 'CAPITALIZE') {
    if (a.status !== 'ACQUIRED')
      conflict('Only an acquired asset can be capitalized.');
    if (a.sourceRole !== r.asset || hash(dim) !== hash(a.sourceDimensions)) {
      entry(lines, r.asset, a.sourceCost, 0, dim);
      entry(lines, a.sourceRole, 0, a.sourceCost, a.sourceDimensions);
    }
    a.cost = a.sourceCost;
    plan.amount = a.cost;
    startUse(a, v.date, money(v.residual ?? '0'));
  } else if (k === 'LEASE_EXEMPT') {
    exemptLease(a, v, shiftMonth(v.date, months(v.leaseMonths)));
  } else if (k === 'LEASE_EXPENSE') {
    if (!a.exemption || a.status !== 'EXEMPT' || v.date > a.exemption.end)
      conflict('Choose a current exempt lease.');
    const n = money(v.amount, true),
      expenses = chart.roles
        .filter((x) => x.accountType === 'EXPENSE')
        .map((x) => x.code);
    await funding(m, b, v, plan, expenses, n, 'debit');
    a.exemption.expense = new Decimal(a.exemption.expense).plus(n).toFixed();
    plan.amount = n.toFixed();
  } else if (k === 'LEASE_END' && a.status === 'EXEMPT') {
    str(v.note, 'lease termination reason', 1000);
    a.status = 'DISPOSED';
  } else if (k === 'LEASE_START') {
    await commenceLease(m, b, a, v, plan, scale);
  } else if (k === 'ASSIGN') {
    const user = uuid(v.custodian);
    const [member] = await m.query(
      "SELECT 1 FROM company_users m JOIN users u ON u.id::text=m.user_id::text WHERE m.company_id::text=$1 AND m.user_id::text=$2 AND m.status='active' AND u.status='active' AND u.deleted_at IS NULL",
      [b.company_id, user],
    );
    if (!member) invalid('Select an active company custodian.');
    a.custodian = user;
  } else if (k === 'VERIFY') {
    if (!['FOUND', 'DAMAGED', 'MISSING'].includes(v.result!))
      invalid('Choose a verification outcome.');
    a.verified = {
      date: v.date,
      result: v.result!,
      note: str(v.note, 'inspection findings', 1000),
    };
  } else if (k === 'MAINTENANCE_PLAN') {
    if (a.maintenance)
      conflict('Complete or reverse the current maintenance plan first.');
    const due = day(v.due);
    if (due < v.date) invalid('Maintenance due date precedes planning.');
    a.maintenance = { due, note: str(v.note, 'planned work', 1000) };
  } else if (k === 'MAINTENANCE_COMPLETE') {
    str(v.note, 'completed work', 1000);
    const cost = money(v.amount ?? '0');
    if (cost.gt(0)) {
      const expenses = (await bookChart(m, b)).roles
        .filter((x) => x.accountType === 'EXPENSE')
        .map((x) => x.code);
      await funding(m, b, v, plan, expenses, cost, 'debit');
      plan.amount = cost.toFixed();
    }
    a.maintenance = null;
  } else {
    if (a.status !== 'ACTIVE')
      conflict('Capitalize this asset before posting lifecycle transactions.');
    if (k === 'DEPRECIATE') {
      if (
        a.policy.method === 'NONE' ||
        !a.end ||
        !a.through ||
        v.date <= a.through ||
        a.through >= shiftDay(a.end, -1)
      )
        conflict('There is no unprocessed depreciation for this date.');
      if (v.date > monthEnd(shiftDay(a.through, 1)))
        conflict('Process each outstanding month in order.');
      depreciation(a, v.date, scale, lines);
    } else if (
      k === 'LEASE_INTEREST' ||
      k === 'LEASE_PAYMENT' ||
      k === 'LEASE_REMEASURE'
    ) {
      await serviceLease(m, b, a, v, plan, scale);
    } else {
      catchUp(a, v.date, scale, plan);
      if (k === 'CAPITAL_ADDITION') {
        const cost = money(v.amount, true);
        str(v.note, 'description of improvement', 1000);
        if (
          a.policy.method !== 'NONE' &&
          (!a.end || a.end <= v.date) &&
          !v.life
        )
          invalid(
            'Approve a remaining useful life for an improvement to a fully depreciated asset.',
          );
        const source = await funding(
          m,
          b,
          v,
          plan,
          [r.asset, r.clearing],
          cost,
          'debit',
        );
        if (source.role !== r.asset || hash(source.dimensions) !== hash(dim)) {
          entry(lines, r.asset, cost, 0, dim);
          entry(lines, source.role, 0, cost, source.dimensions);
          if (source.dimensions.BRANCH !== dim.BRANCH) {
            entry(lines, r.branchDueFrom, cost, 0, source.dimensions);
            entry(lines, r.branchDueTo, 0, cost, dim);
          }
        }
        a.cost = money(a.cost).plus(cost).toFixed();
        a.shadow = money(a.shadow).plus(cost).toFixed();
        if (v.life && a.policy.method !== 'NONE') {
          if (a.lease)
            invalid(
              'Revise the lease useful life through its approved estimate.',
            );
          a.policy.life = months(v.life);
          setUsefulLifeEnd(a, shiftMonth(v.date, a.policy.life));
          a.through = a.through === v.date ? v.date : shiftDay(v.date, -1);
        }
        plan.amount = cost.toFixed();
      } else if (k === 'RECLASSIFY') {
        str(v.note, 'reason for reclassification', 1000);
        const dest = await master(m, b, 'CATEGORY', v.category, v.date);
        const next = dest.policy!;
        if (next.model !== a.policy.model)
          conflict(
            'Use a category with the same measurement model for an account reclassification.',
          );
        if (
          (a.policy.method !== 'NONE' &&
            (!next.roles.accumulated || !next.roles.depreciation)) ||
          (a.lease && (!next.roles.liability || !next.roles.interest))
        )
          invalid(
            'The destination needs compatible depreciation and lease accounts.',
          );
        for (const [key, role] of Object.entries(next.roles))
          if (
            chart.roles.find((x) => x.code === role)?.accountCode !==
            next.accounts[key as keyof Roles]
          )
            conflict('Approve the current destination account mapping first.');
        if (
          code(v.category) === a.category &&
          hash(a.policy.accounts) === hash(next.accounts) &&
          hash(r) === hash(next.roles)
        )
          conflict('Select a different category or approved account mapping.');
        for (const [role, n, debit] of [
          ['asset', a.cost, true],
          ['accumulated', a.accumulated, false],
          ['impairment', a.impairment, false],
          ['surplus', a.surplus, false],
          ['liability', a.lease?.liability ?? '0', false],
        ] as const) {
          if (a.policy.accounts[role] === next.accounts[role]) continue;
          entry(lines, r[role], debit ? 0 : n, debit ? n : 0, dim);
          entry(lines, next.roles[role], debit ? n : 0, debit ? 0 : n, dim);
        }
        a.category = code(v.category);
        a.group = dest.group!;
        a.policy = { ...a.policy, roles: next.roles, accounts: next.accounts };
        plan.amount = a.cost;
      } else if (k === 'TRANSFER') {
        const loc = await master(m, b, 'LOCATION', v.location, v.date),
          newDim = await dimensions(m, b, v, loc);
        if (a.location === code(v.location) && hash(newDim) === hash(dim))
          conflict('Choose a different location or financial dimension.');
        if (hash(newDim) !== hash(dim)) {
          const balances: [keyof Roles, string, boolean][] = [
            ['asset', a.cost, true],
            ['accumulated', a.accumulated, false],
            ['impairment', a.impairment, false],
            ['surplus', a.surplus, false],
            ['liability', a.lease?.liability ?? '0', false],
          ];
          if (dim.BRANCH !== newDim.BRANCH) {
            const position = balances.reduce(
              (sum, [, n, debit]) => (debit ? sum.plus(n) : sum.minus(n)),
              new Decimal(0),
            );
            const from = position.isNegative() ? newDim : dim,
              to = position.isNegative() ? dim : newDim;
            entry(lines, r.branchDueFrom, position.abs(), 0, from);
            entry(
              lines,
              r.branchDueTo ?? r.branchDueFrom,
              0,
              position.abs(),
              to,
            );
          }
          for (const [role, n, dr] of balances) {
            entry(lines, r[role], dr ? n : 0, dr ? 0 : n, newDim);
            entry(lines, r[role], dr ? 0 : n, dr ? n : 0, dim);
          }
        }
        a.location = code(v.location);
        a.dimensions = newDim;
      } else if (k === 'ESTIMATE') {
        const terms = policyTerms(v);
        if (terms.method !== 'NONE' && (!r.accumulated || !r.depreciation))
          invalid('The category needs depreciation accounts.');
        const residual = money(v.residual ?? a.residual);
        a.policy = { ...a.policy, ...terms };
        a.residual = residual.toFixed();
        setUsefulLifeEnd(a, terms.life ? shiftMonth(v.date, terms.life) : null);
        a.through = a.through === v.date ? v.date : shiftDay(v.date, -1);
      } else if (k === 'REVALUE') {
        const approved = await master(m, b, 'CATEGORY', a.category, v.date);
        if (approved.policy?.model !== 'REVALUATION')
          conflict('Approve the revaluation model for this category.');
        for (const key of ['surplus', 'retained'] as const)
          if (!a.policy.roles[key]) {
            a.policy.roles[key] = approved.policy.roles[key];
            a.policy.accounts[key] = approved.policy.accounts[key];
          }
        a.policy.model = 'REVALUATION';
        revalue(a, money(v.amount), lines);
      } else if (k === 'IMPAIR' || k === 'RESTORE')
        impair(a, money(v.amount), k === 'RESTORE', lines);
      else if (k === 'LEASE_END') await closeLease(m, b, a, v, plan, scale);
      else if (k === 'DISPOSE' || k === 'WRITE_OFF') {
        const proceeds =
          k === 'WRITE_OFF' ? money('0') : money(v.amount ?? '0');
        str(v.note, 'reason for retirement', 1000);
        if (proceeds.gt(0)) {
          const src = await funding(
            m,
            b,
            v,
            plan,
            [r.clearing],
            proceeds,
            'credit',
          );
          entry(lines, r.clearing, proceeds, 0, src.dimensions);
        }
        terminal(a, proceeds, k === 'WRITE_OFF', lines);
      }
    }
  }
  if (lines.length) {
    const p = await voucherLines(
      m,
      b,
      'MANUAL',
      { date: v.date, currency: b.context.functionalCurrency, lines },
      chart,
    );
    plan.amount = Decimal.max(plan.amount, p.amount).toFixed();
  }
  return { plan, prior };
}
