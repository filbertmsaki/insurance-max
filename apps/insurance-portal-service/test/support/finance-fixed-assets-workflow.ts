import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { restoreLeaseLife } from '../../src/modules/tenant/finance/assets/fixed-assets/fixed-asset-leases';
import type { Evidence } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-gl-program';
import {
  monthEnd,
  shiftDay,
  shiftMonth,
} from '../../src/modules/tenant/finance/assets/fixed-assets/fixed-asset-measurement';
type Http = (
  u: string,
  path: string,
  body?: Record<string, any>,
  status?: number,
) => Promise<any>;
export async function exerciseFixedAssets(f: {
  call: Http;
  post: Http;
  maker: string;
  checker: string;
  deputy: string;
  scope: { bookId: string; legalEntityId: string };
  company: string;
  today: string;
  since: string;
  document: Evidence;
  db: DataSource;
  branch: string;
  otherBranch: string;
  department: string;
  insurer: boolean;
}) {
  const { call, post, maker, checker, deputy, scope, db } = f,
    q = new URLSearchParams(scope).toString();
  const dim = { BRANCH: f.branch, COST_CENTRE: 'HQ', DEPARTMENT: f.department };
  const start = f.since,
    root = 'fixed-assets',
    evidence = f.document;
  if (f.insurer) {
    const [p] = await db.query(
      "SELECT id,state,revision FROM finance_foundation_periods WHERE book_id=$1 AND period_code='PREVIOUS' AND mode='LIVE'",
      [scope.bookId],
    );
    if (p.state === 'CLOSED')
      await post(checker, 'foundation/periods/' + p.id + '/fences', {
        state: 'OPEN',
        revision: p.revision,
        evidenceHash: evidence.hash,
      });
  }
  const ledger = async (id: string) => {
    const [c] = await db.query(
      'SELECT subject_hash FROM finance_journal_candidates WHERE id=$1',
      [id],
    );
    const path = 'foundation/operating-postings/' + id + '/approve',
      body = { subjectHash: c.subject_hash };
    await post(deputy, path, body);
    const done = await post(checker, path, body);
    expect((await post(checker, path, body)).journalId).toBe(done.journalId);
    return done.journalId;
  };
  const input = (
    kind: string,
    code: string,
    other: Record<string, unknown> = {},
  ) => ({
    kind,
    code,
    date: start,
    reference: kind + '-' + randomUUID(),
    requestKey: randomUUID(),
    evidence,
    ...other,
  });
  const finish = async (
    kind: string,
    code: string,
    other: Record<string, unknown> = {},
  ) => {
    const data = input(kind, code, other),
      doc = await post(maker, root, { input: data });
    expect((await post(maker, root, { input: data })).id).toBe(doc.id);
    await post(
      maker,
      root + '/' + doc.id + '/approve',
      { reason: 'checked' },
      403,
    );
    const approved = await post(checker, root + '/' + doc.id + '/approve', {
      reason: 'Checked against evidence',
    });
    if (approved.state === 'POSTED') return approved;
    const queued = await post(maker, root + '/' + doc.id + '/post', {});
    await ledger(queued.candidate_id);
    return post(maker, root + '/' + doc.id + '/post', {});
  };
  const journal = async (
    date: string,
    debit: string,
    credit: string,
    amount: string,
    dimensions = dim,
  ) => {
    const c = await post(maker, 'foundation/gl/vouchers', {
      input: {
        date,
        reference: 'FUND-' + randomUUID(),
        currency: 'TZS',
        description: 'Verified fixed asset source',
        evidence,
        lines: [
          { role: debit, debit: amount, credit: '0', dimensions },
          { role: credit, debit: '0', credit: amount, dimensions },
        ],
      },
    });
    return ledger(c.id);
  };
  const roles = {
    asset: 'FA_COST',
    clearing: 'FA_CLEAR',
    accumulated: 'FA_ACC',
    depreciation: 'FA_EXP',
    impairment: 'FA_IMPAIR',
    loss: 'FA_LOSS',
    gain: 'FA_GAIN',
    surplus: 'FA_SURPLUS',
    retained: 'FA_RETAINED',
    branchDueFrom: 'CLEARING',
    branchDueTo: 'ACCRUED',
    liability: 'FA_LEASE',
    interest: 'FA_INTEREST',
  };
  await finish('GROUP', 'IT', { name: 'IT equipment' });
  await finish('LOCATION', 'HQ', { name: 'Head office', branch: f.branch });
  await finish('LOCATION', 'COAST', { name: 'Coast', branch: f.otherBranch });
  await finish('CATEGORY', 'PC', {
    name: 'Computers and laptops',
    group: 'IT',
    method: 'STRAIGHT_LINE',
    life: 48,
    model: 'REVALUATION',
    roles,
  });
  await finish('CATEGORY', 'OPEN-PC', {
    name: 'Existing office equipment',
    group: 'IT',
    method: 'STRAIGHT_LINE',
    life: 48,
    model: 'COST',
    roles,
  });
  if (f.insurer) {
    const inService = shiftMonth(start, -60);
    const expired = input('OPENING', 'EXPIRED', {
      name: 'Existing equipment',
      category: 'OPEN-PC',
      location: 'HQ',
      dimensions: dim,
      amount: '800',
      accumulated: '160',
      inService,
    });
    await post(maker, root, { input: expired }, 409);
    const opening = await finish('OPENING', 'OLD-PC', {
      name: 'Opening asset',
      category: 'OPEN-PC',
      location: 'HQ',
      dimensions: dim,
      amount: '800',
      accumulated: '160',
      inService,
      life: 120,
    });
    expect(opening.journal_id).toBeNull();
    expect(opening.plan.asset.policy.life).toBe(120);
    expect(opening.plan.asset.end).toBe(shiftMonth(inService, 120));
    const register = await call(checker, root + '?' + q);
    const next = register.depreciation.find(
      (x: { code: string }) => x.code === 'OLD-PC',
    );
    expect(Number(next.amount)).toBeGreaterThan(0);
    const charge = await finish('DEPRECIATE', 'OLD-PC', { date: next.date });
    expect(Number(charge.plan.asset.accumulated)).toBeCloseTo(
      160 + Number(next.amount),
    );
    expect(
      Number(opening.plan.asset.cost) - Number(opening.plan.asset.accumulated),
    ).toBe(640);
    await post(
      maker,
      root,
      {
        input: input('OPENING', 'EXCESS', {
          name: 'Excess opening',
          category: 'OPEN-PC',
          location: 'HQ',
          dimensions: dim,
          amount: '201',
          inService: start,
        }),
      },
      409,
    );
  }
  const base = {
    name: 'Lenovo Laptop',
    category: 'PC',
    location: 'HQ',
    dimensions: dim,
  };
  const fund = await journal(start, 'FA_CLEAR', 'FA_OFFSET', '1200000');
  const available = await call(
    checker,
    root + '/sources?' + q + '&to=' + start + '&q=' + fund,
  );
  expect(available.find((r: { line: string }) => r.line === 'L1').journal).toBe(
    fund,
  );
  await finish('ACQUIRE', 'AST-000001', {
    ...base,
    amount: '1200000',
    sourceJournal: fund,
    sourceLine: 'L1',
  });
  await post(
    maker,
    root,
    {
      input: input('ACQUIRE', 'AST-DUP', {
        ...base,
        amount: '1',
        sourceJournal: fund,
        sourceLine: 'L1',
      }),
    },
    409,
  );
  const cap = await finish('CAPITALIZE', 'AST-000001', { residual: '0' });
  expect(Number(cap.plan.asset.cost)).toBe(1200000);
  const payables = async (
    kind: string,
    reference: string,
    details: Record<string, unknown>,
    supplierId?: string,
  ) => {
    const bill = await post(maker, 'payables', {
      input: {
        kind,
        reference,
        details,
        supplierId,
        date: start,
        currency: 'TZS',
        dimensions: dim,
        evidence,
        requestKey: randomUUID(),
      },
    });
    return post(checker, 'payables/' + bill.id + '/review', {
      decision: 'APPROVE',
      reason: 'Verified upgrade purchase evidence',
    });
  };
  await payables('SETTINGS', 'AP', {
    payableRole: 'TRADE_AP',
    employeePayableRole: 'TRADE_AP',
    advanceRole: 'PREPAID',
    imprestRole: 'CLEARING',
    vatRole: 'AR',
    withholdingRole: 'ACCRUED',
    discountRole: 'FEES',
    bankRole: 'CASH',
    taxRules: [
      {
        supplierClass: 'STANDARD',
        transactionClass: 'EQUIPMENT',
        vatBps: 0,
        withholdingBps: 0,
      },
    ],
  });
  const vendors = await payables('CATEGORY', 'IT-UPGRADES', {
    name: 'Equipment upgrades',
  });
  const supplier = await payables('SUPPLIER', 'SUP-UPGRADE', {
    name: 'IT supplier',
    categoryId: vendors.id,
    tin: 'TEST-UPGRADE',
    address: 'Dar es Salaam',
    email: 'upgrades@example.invalid',
    taxClass: 'STANDARD',
  });
  const upgradeInvoice = await payables(
    'BILL',
    'UPGRADE-001',
    {
      description: 'Laptop memory upgrade',
      lines: [
        {
          item: 'MEMORY',
          description: 'Installed memory',
          quantity: '1',
          unitPrice: '300000',
          role: 'FA_CLEAR',
          transactionClass: 'EQUIPMENT',
        },
      ],
    },
    supplier.id,
  );
  const postedBill = await post(
    maker,
    'payables/' + upgradeInvoice.id + '/post',
    {},
  );
  const upgradeSource = await ledger(postedBill.candidate_id);
  const [upgradeLine] = await db.query(
    'SELECT line_key FROM finance_foundation_lines WHERE journal_id=$1 AND role_code=$2 AND functional_debit>0',
    [upgradeSource, 'FA_CLEAR'],
  );
  const improvement = await finish('CAPITAL_ADDITION', 'AST-000001', {
    sourceJournal: upgradeSource,
    sourceLine: upgradeLine.line_key,
    amount: '300000',
    note: 'Memory upgrade',
  });
  expect(Number(improvement.plan.asset.cost)).toBe(1500000);
  await post(
    maker,
    root,
    {
      input: input('CAPITAL_ADDITION', 'AST-000001', {
        sourceJournal: upgradeSource,
        sourceLine: upgradeLine.line_key,
        amount: '1',
        note: 'Same source',
      }),
    },
    409,
  );
  await finish('CATEGORY', 'IMPROVED', {
    name: 'Improved computers',
    group: 'IT',
    method: 'STRAIGHT_LINE',
    life: 48,
    model: 'REVALUATION',
    roles: { ...roles, asset: 'FA_IMPROVED' },
  });
  const swap = await finish('RECLASSIFY', 'AST-000001', {
    category: 'IMPROVED',
    note: 'Transfer carrying accounts',
  });
  expect(swap.plan.asset.category).toBe('IMPROVED');
  expect(swap.plan.asset.cost).toBe(improvement.plan.asset.cost);
  await finish('REVERSE', 'AST-000001', { original: swap.id });
  await finish('REVERSE', 'AST-000001', { original: improvement.id });
  await finish('ASSIGN', 'AST-000001', { custodian: maker });
  await finish('VERIFY', 'AST-000001', {
    result: 'FOUND',
    note: 'Serial inspected',
  });
  await finish('MAINTENANCE_PLAN', 'AST-000001', {
    due: f.today,
    note: 'Service inspection',
  });
  await finish('MAINTENANCE_COMPLETE', 'AST-000001', { note: 'Serviced' });
  const transferred = await finish('TRANSFER', 'AST-000001', {
    location: 'COAST',
    dimensions: { ...dim, BRANCH: f.otherBranch },
  });
  expect(transferred.plan.asset.location).toBe('COAST');
  const transfers = await db.query(
    "SELECT dimensions->>'BRANCH' branch,sum(functional_debit-functional_credit) amount FROM finance_foundation_lines WHERE journal_id=$1 GROUP BY 1",
    [transferred.journal_id],
  );
  expect(transfers).toHaveLength(2);
  expect(
    transfers.every((row: { amount: string }) => Number(row.amount) === 0),
  ).toBe(true);
  await finish('ESTIMATE', 'AST-000001', {
    method: 'STRAIGHT_LINE',
    life: 48,
    residual: '0',
  });
  const uplift = await finish('REVALUE', 'AST-000001', { amount: '1300000' });
  expect(Number(uplift.plan.asset.surplus)).toBe(100000);
  await finish('IMPAIR', 'AST-000001', { amount: '1100000' });
  await finish('RESTORE', 'AST-000001', { amount: '1300000' });
  const app = await call(checker, root + '?' + q);
  expect(app.assets.find((a: any) => a.code === 'AST-000001').name).toBe(
    'Lenovo Laptop',
  );
  const exempt = await finish('LEASE_EXEMPT', 'EXEMPT-1', {
    ...base,
    leaseMonths: 6,
    exemption: 'SHORT_TERM',
    note: 'Six-month rental without a purchase option',
  });
  expect(exempt.journal_id).toBeNull();
  const expense = await journal(start, 'FA_EXP', 'FA_OFFSET', '500');
  await finish('LEASE_EXPENSE', 'EXEMPT-1', {
    amount: '500',
    sourceJournal: expense,
    sourceLine: 'L1',
  });
  await finish('LEASE_END', 'EXEMPT-1', { note: 'Returned equipment' });
  const reversal = await finish('REVERSE', 'AST-000001', {
    original: (
      await finish('WRITE_OFF', 'AST-000001', {
        note: 'Equipment irreparably damaged',
      })
    ).id,
  });
  expect(reversal.plan.asset.status).toBe('ACTIVE');
  if (f.insurer) {
    const bill = await journal(start, 'FA_CLEAR', 'FA_OFFSET', '1200000');
    await finish('ACQUIRE', 'AST-000002', {
      ...base,
      amount: '1200000',
      sourceJournal: bill,
      sourceLine: 'L1',
    });
    await finish('CAPITALIZE', 'AST-000002', { residual: '0' });
    const incomplete = {
      date: start,
      reference: 'Whole class',
      requestKey: randomUUID(),
      evidence,
      category: 'PC',
      values: [{ code: 'AST-000001', amount: '1300000' }],
    };
    await post(maker, root + '/revaluation-run', { input: incomplete }, 409);
    const valuations = await post(maker, root + '/revaluation-run', {
      input: {
        ...incomplete,
        values: [
          ...incomplete.values,
          { code: 'AST-000002', amount: '1200000' },
        ],
      },
    });
    expect(valuations).toHaveLength(2);
    const period = (
      await db.query(
        "SELECT id,revision FROM finance_foundation_periods WHERE book_id=$1 AND period_code='PREVIOUS' AND mode='LIVE'",
        [scope.bookId],
      )
    )[0];
    const close = (revision: number, state: string, status?: number) =>
      post(
        checker,
        'foundation/periods/' + period.id + '/fences',
        { revision, state, evidenceHash: evidence.hash },
        status,
      );
    const coverage = async () =>
      (await call(checker, root + '?' + q)).valuations.find(
        (v: { request_key: string }) => v.request_key === incomplete.requestKey,
      );
    for (const [index, v] of valuations.entries()) {
      const approved = await post(checker, root + '/' + v.id + '/approve', {
        reason: 'Verified class valuation',
      });
      if (approved.state !== 'POSTED') {
        const queued = await post(maker, root + '/' + v.id + '/post', {});
        await ledger(queued.candidate_id);
      }
      if (index === 0) {
        expect(await coverage()).toMatchObject({
          state: 'PARTIAL',
          posted: 1,
          total: 2,
        });
        await close(period.revision, 'CLOSED', 409);
      }
    }
    expect(await coverage()).toMatchObject({
      state: 'COMPLETE',
      posted: 2,
      total: 2,
      missing: [],
    });
    const lateFunding = await journal(start, 'FA_CLEAR', 'FA_OFFSET', '100000');
    await finish('ACQUIRE', 'AST-LATE', {
      ...base,
      amount: '100000',
      sourceJournal: lateFunding,
      sourceLine: 'L1',
    });
    await finish('CAPITALIZE', 'AST-LATE', { residual: '0' });
    const partial = await coverage();
    expect(partial).toMatchObject({
      state: 'PARTIAL',
      posted: 2,
      total: 3,
      outstanding: ['AST-LATE'],
      missing: ['AST-LATE'],
    });
    await close(period.revision, 'CLOSED', 409);
    const supplement = {
      valuationRunId: partial.run_id,
      reference: partial.reference,
      amount: '110000',
    };
    await post(
      maker,
      root,
      { input: input('REVALUE', 'AST-000002', supplement) },
      409,
    );
    const supplemental = await finish('REVALUE', 'AST-LATE', supplement);
    expect(supplemental.journal_id).toBeTruthy();
    await post(
      maker,
      root,
      { input: input('REVALUE', 'AST-LATE', supplement) },
      409,
    );
    expect(await coverage()).toMatchObject({
      state: 'COMPLETE',
      posted: 3,
      total: 3,
      missing: [],
    });
    await finish('REVERSE', 'AST-LATE', { original: supplemental.id });
    expect(await coverage()).toMatchObject({
      state: 'PARTIAL',
      posted: 2,
      total: 3,
      missing: ['AST-LATE'],
    });
    await close(period.revision, 'CLOSED', 409);
    await finish('REVALUE', 'AST-LATE', { ...supplement, amount: '105000' });
    const retired = await finish('WRITE_OFF', 'AST-LATE', {
      note: 'Verified retirement on the valuation date',
    });
    expect(await coverage()).toMatchObject({
      state: 'COMPLETE',
      posted: 2,
      total: 2,
    });
    await finish('REVERSE', 'AST-LATE', { original: retired.id });
    expect(await coverage()).toMatchObject({
      state: 'COMPLETE',
      posted: 3,
      total: 3,
    });
    const later = shiftDay(start, 1);
    const laterFunding = await journal(later, 'FA_CLEAR', 'FA_OFFSET', '10000');
    await finish('ACQUIRE', 'AST-AFTER', {
      ...base,
      date: later,
      amount: '10000',
      sourceJournal: laterFunding,
      sourceLine: 'L1',
    });
    await finish('CAPITALIZE', 'AST-AFTER', { date: later, residual: '0' });
    expect(await coverage()).toMatchObject({
      state: 'COMPLETE',
      posted: 3,
      total: 3,
    });
    const closed = await close(period.revision, 'CLOSED');
    const unopened = await post(maker, root, {
      input: input('OPENING', 'BACKDATED-OPEN', {
        ...base,
        amount: '200',
        accumulated: '40',
        inService: start,
      }),
    });
    const approvalPath = root + '/' + unopened.id + '/approve';
    const approval = { reason: 'Matched the remaining certified opening.' };
    await post(checker, approvalPath, approval, 409);
    expect(await coverage()).toMatchObject({ state: 'COMPLETE', total: 3 });
    const reopened = await close(closed.revision, 'OPEN');
    expect((await post(checker, approvalPath, approval)).state).toBe('POSTED');
    expect(await coverage()).toMatchObject({
      state: 'PARTIAL',
      total: 4,
      missing: ['BACKDATED-OPEN'],
    });
    await finish('REVALUE', 'BACKDATED-OPEN', { ...supplement, amount: '160' });
    expect(await coverage()).toMatchObject({
      state: 'COMPLETE',
      posted: 4,
      total: 4,
    });
    const verified = await close(reopened.revision, 'CLOSED');
    await close(verified.revision, 'OPEN');
    const run = {
      date: monthEnd(start),
      reference: 'Monthly laptop depreciation',
      requestKey: randomUUID(),
      evidence,
      codes: ['AST-000002'],
    };
    const [dep] = await post(maker, root + '/depreciation-run', { input: run });
    expect(
      (await post(maker, root + '/depreciation-run', { input: run }))[0].id,
    ).toBe(dep.id);
    await post(checker, root + '/' + dep.id + '/approve', {
      reason: 'Reviewed monthly depreciation',
    });
    const cand = await post(maker, root + '/' + dep.id + '/post', {});
    const jid = await ledger(cand.candidate_id);
    const lines = await db.query(
      'SELECT role_code,functional_debit,functional_credit FROM finance_foundation_lines WHERE journal_id=$1 ORDER BY line_key',
      [jid],
    );
    expect(
      lines.map((l: any) => [
        l.role_code,
        Number(l.functional_debit),
        Number(l.functional_credit),
      ]),
    ).toEqual([
      ['FA_EXP', 25000, 0],
      ['FA_ACC', 0, 25000],
    ]);
    await post(
      maker,
      root,
      { input: input('DEPRECIATE', 'AST-000002', { date: run.date }) },
      409,
    );
    const shortLease = await finish('LEASE_START', 'ROU-SHORT', {
      ...base,
      category: 'OPEN-PC',
      life: 1,
      payments: ['0', '10000', '10000'],
      annualRate: '0',
    });
    expect(shortLease.plan.asset.lease.ownershipBasis).toBe('LEASE_TERM');
    const expiredOn = shiftMonth(start, 1);
    const lastCharge = shiftDay(expiredOn, -1);
    if (monthEnd(start) < lastCharge)
      await finish('DEPRECIATE', 'ROU-SHORT', { date: monthEnd(start) });
    await finish('DEPRECIATE', 'ROU-SHORT', { date: lastCharge });
    const rise = {
      date: expiredOn,
      firstDue: shiftMonth(expiredOn, 1),
      payments: ['11000', '11000'],
      annualRate: '0',
    };
    await post(
      maker,
      root,
      { input: input('LEASE_REMEASURE', 'ROU-SHORT', rise) },
      409,
    );
    const assessed = await finish('LEASE_REMEASURE', 'ROU-SHORT', {
      ...rise,
      expiryRecoverableAmount: '0',
    });
    expect(Number(assessed.plan.asset.impairment)).toBe(2000);
    expect(Number(assessed.plan.asset.lease.liability)).toBe(22000);
    const lease = await finish('LEASE_START', 'ROU-1', {
      ...base,
      name: 'Office lease',
      category: 'OPEN-PC',
      leaseMonths: 2,
      payment: '10000',
      annualRate: '12',
    });
    const legacy = structuredClone(lease.plan.asset);
    delete legacy.lease.usefulLifeEnd;
    delete legacy.lease.ownershipTransfer;
    delete legacy.lease.ownershipBasis;
    legacy.policy.life = 2;
    await restoreLeaseLife(db.manager, scope.bookId, [legacy], start);
    expect(legacy.lease.usefulLifeEnd).toBe(shiftMonth(start, 48));
    expect(legacy.end).toBe(lease.plan.asset.end);
    const first = lease.plan.asset.lease.schedule[0],
      due = first.date;
    const part = await finish('LEASE_INTEREST', 'ROU-1', {
      date: monthEnd(start),
    });
    expect(
      Number(part.plan.asset.lease.schedule[0].accruedInterest),
    ).toBeLessThan(Number(first.interest));
    const accrued = await finish('LEASE_INTEREST', 'ROU-1', { date: due });
    expect(
      Number(accrued.plan.asset.lease.liability) -
        Number(lease.plan.asset.lease.liability),
    ).toBeCloseTo(Number(first.interest), 2);
    expect(accrued.plan.asset.lease.accrued).toBe(true);
    const cash = await journal(due, 'FA_CLEAR', 'FA_OFFSET', '10000');
    const payment = await finish('LEASE_PAYMENT', 'ROU-1', {
      date: due,
      sourceJournal: cash,
      sourceLine: 'L1',
      amount: '10000',
    });
    expect(payment.plan.asset.lease.liability).toBe(first.closing);
    await finish('LEASE_REMEASURE', 'ROU-1', {
      date: due,
      leaseMonths: 2,
      payment: '6000',
      annualRate: '12',
    });
    // Revising the economic life does not grant title when the amended rental term is shorter.
    const modification = [shiftDay(due, 3), f.today].sort()[0];
    const amended = await finish('LEASE_REMEASURE', 'ROU-1', {
      date: modification,
      leaseMonths: 2,
      payment: '5500',
      life: 6,
      annualRate: '9',
      firstDue: shiftMonth(due, 1),
    });
    expect(amended.plan.asset.lease.schedule[0].start).toBe(modification);
    expect(amended.plan.asset.lease.ownershipBasis).toBe('LEASE_TERM');
    expect(amended.plan.asset.lease.usefulLifeEnd).toBe(
      shiftMonth(modification, 6),
    );
    expect(amended.plan.asset.end).toBe(
      amended.plan.asset.lease.schedule.at(-1).date,
    );
    const terminated = await finish('LEASE_END', 'ROU-1', {
      date: modification,
      note: 'Lease terminated by agreement',
    });
    expect(terminated.plan.asset.lease.liability).toBe('0');
    const branchFunding = await journal(
      f.today,
      'FA_CLEAR',
      'FA_OFFSET',
      '120000',
    );
    await finish('ACQUIRE', 'BRANCH-CAP', {
      ...base,
      date: f.today,
      location: 'COAST',
      dimensions: { ...dim, BRANCH: f.otherBranch },
      amount: '120000',
      sourceJournal: branchFunding,
      sourceLine: 'L1',
    });
    const cross = await finish('CAPITALIZE', 'BRANCH-CAP', {
      date: f.today,
      residual: '0',
    });
    const branchBalances = async (id: string) =>
      db.query(
        "SELECT dimensions->>'BRANCH' branch,sum(functional_debit-functional_credit)::float8 net FROM finance_foundation_lines WHERE journal_id=$1 GROUP BY 1 ORDER BY 1",
        [id],
      );
    const balanced = [f.branch, f.otherBranch]
      .sort()
      .map((branch) => ({ branch, net: 0 }));
    const coast = { ...dim, BRANCH: f.otherBranch };
    expect(await branchBalances(cross.journal_id)).toEqual(balanced);
    expect(cross.plan.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: roles.branchDueFrom,
          debit: '120000',
          dimensions: dim,
        }),
        expect.objectContaining({
          role: roles.branchDueTo,
          credit: '120000',
          dimensions: { ...dim, BRANCH: f.otherBranch },
        }),
      ]),
    );
    const undoCross = await finish('REVERSE', 'BRANCH-CAP', {
      date: f.today,
      original: cross.id,
    });
    expect(await branchBalances(undoCross.journal_id)).toEqual(
      await branchBalances(cross.journal_id),
    );
    await finish('CAPITALIZE', 'BRANCH-CAP', { date: f.today, residual: '0' });
    const singleRoles = { ...roles, branchDueTo: undefined };
    const category = {
      name: 'Equipment with one clearing account',
      group: 'IT',
      method: 'STRAIGHT_LINE',
      life: 48,
      model: 'REVALUATION',
      roles: singleRoles,
      date: f.today,
    };
    await post(
      maker,
      root,
      { input: input('CATEGORY', 'BRANCH-SINGLE', category) },
      400,
    );
    await finish('CATEGORY', 'BRANCH-SINGLE', {
      ...category,
      branchClearing: 'SINGLE',
    });
    await finish('RECLASSIFY', 'BRANCH-CAP', {
      date: f.today,
      category: 'BRANCH-SINGLE',
      note: 'Approved single clearing account',
    });
    const moved = await finish('TRANSFER', 'BRANCH-CAP', {
      date: f.today,
      location: 'HQ',
      dimensions: dim,
    });
    expect(await branchBalances(moved.journal_id)).toEqual(balanced);
    const clearing = await db.query(
      "SELECT dimensions->>'BRANCH' branch,functional_debit::float8 debit,functional_credit::float8 credit FROM finance_foundation_lines WHERE journal_id=$1 AND role_code=$2 ORDER BY debit DESC",
      [moved.journal_id, roles.branchDueFrom],
    );
    expect(clearing).toEqual([
      { branch: f.otherBranch, debit: 120000, credit: 0 },
      { branch: f.branch, debit: 0, credit: 120000 },
    ]);

    for (const [adjustment, sourceLine] of [
      ['1000', 'L1'],
      ['-1000', 'L2'],
    ] as const) {
      const code = 'LEASE-BRANCH-' + sourceLine;
      const funds = await journal(
        start,
        sourceLine === 'L1' ? 'FA_CLEAR' : 'FA_OFFSET',
        sourceLine === 'L1' ? 'FA_OFFSET' : 'FA_CLEAR',
        '1000',
        coast,
      );
      const opened = await finish('LEASE_START', code, {
        ...base,
        category: 'OPEN-PC',
        payments: ['10000'],
        initialAdjustment: adjustment,
        sourceJournal: funds,
        sourceLine,
      });
      expect(await branchBalances(opened.journal_id)).toEqual(balanced);
      const fee = await journal(start, 'FA_CLEAR', 'FA_OFFSET', '500', coast);
      const ended = await finish('LEASE_END', code, {
        date: start,
        note: 'Signed early return',
        amount: '500',
        sourceJournal: fee,
        sourceLine: 'L1',
      });
      expect(await branchBalances(ended.journal_id)).toEqual(balanced);
    }
    await finish('CATEGORY', 'ONE-MONTH', {
      name: 'Short-lived equipment',
      group: 'IT',
      method: 'STRAIGHT_LINE',
      life: 1,
      model: 'REVALUATION',
      roles,
    });
    const valuationFund = await journal(
      start,
      'FA_CLEAR',
      'FA_OFFSET',
      '120000',
    );
    await finish('ACQUIRE', 'REVAL-EXPIRED', {
      ...base,
      category: 'ONE-MONTH',
      amount: '120000',
      sourceJournal: valuationFund,
      sourceLine: 'L1',
    });
    await finish('CAPITALIZE', 'REVAL-EXPIRED', { residual: '0' });
    await finish('DEPRECIATE', 'REVAL-EXPIRED', { date: lastCharge });
    const fairValue = { date: expiredOn, amount: '25000' };
    await post(
      maker,
      root,
      {
        input: input('REVALUE', 'REVAL-EXPIRED', {
          ...fairValue,
          residual: '0',
        }),
      },
      409,
    );
    const residualOnly = await finish('REVALUE', 'REVAL-EXPIRED', {
      ...fairValue,
      residual: '25000',
    });
    expect(residualOnly.plan.asset.residual).toBe('25000');
    await finish('REVERSE', 'REVAL-EXPIRED', {
      date: expiredOn,
      original: residualOnly.id,
    });
    const priceRun = {
      date: expiredOn,
      category: 'ONE-MONTH',
      reference: 'Updated equipment valuation',
      evidence,
      requestKey: randomUUID(),
      values: [
        { code: 'REVAL-EXPIRED', amount: '25000', life: 5, residual: '0' },
      ],
    };
    const [valuation] = await post(maker, root + '/revaluation-run', {
      input: priceRun,
    });
    expect(
      (await post(maker, root + '/revaluation-run', { input: priceRun }))[0].id,
    ).toBe(valuation.id);
    await post(checker, root + '/' + valuation.id + '/approve', {
      reason: 'Reviewed remaining life and valuation',
    });
    await ledger(
      (await post(maker, root + '/' + valuation.id + '/post', {})).candidate_id,
    );
    const preview = async (code: string) =>
      (await call(checker, root + '?' + q)).depreciation.find(
        (x: { code: string }) => x.code === code,
      );
    expect(await preview('REVAL-EXPIRED')).toMatchObject({ amount: '5000' });
    const charged = await finish('DEPRECIATE', 'REVAL-EXPIRED', {
      date: f.today,
    });
    expect(Number(charged.plan.asset.accumulated)).toBeGreaterThan(0);
    expect(charged.plan.asset.end).toBe(shiftMonth(expiredOn, 5));

    await finish('CATEGORY', 'OWNED-COST', {
      name: 'Owned equipment',
      group: 'IT',
      method: 'STRAIGHT_LINE',
      life: 48,
      model: 'COST',
      roles: { ...roles, asset: 'FA_IMPROVED' },
    });
    for (const basis of ['TITLE_TRANSFER', 'PURCHASE_OPTION'] as const) {
      const code = 'RETAIN-' + basis,
        agreement = { date: due, note: 'Registered title and signed handover' };
      const commenced = await finish('LEASE_START', code, {
        ...base,
        category: 'OPEN-PC',
        leaseMonths: 1,
        payment: '120000',
        annualRate: '0',
        life: 12,
        ownershipBasis: basis,
      });
      await post(
        maker,
        root,
        { input: input('LEASE_TAKE_OWNERSHIP', code, agreement) },
        409,
      );
      await finish('DEPRECIATE', code, { date: lastCharge });
      await finish('LEASE_INTEREST', code, { date: due });
      const leaseFunds = await journal(
        due,
        'FA_CLEAR',
        'FA_OFFSET',
        '120000',
        coast,
      );
      const paid = await finish('LEASE_PAYMENT', code, {
        date: due,
        amount: '120000',
        sourceJournal: leaseFunds,
        sourceLine: 'L1',
      });
      expect(Number(paid.plan.asset.lease.liability)).toBe(0);
      expect(await branchBalances(paid.journal_id)).toEqual(balanced);
      await post(
        maker,
        root,
        { input: input('LEASE_END', code, agreement) },
        409,
      );
      const acquired = await finish('LEASE_TAKE_OWNERSHIP', code, {
        ...agreement,
        ...(basis === 'PURCHASE_OPTION' && { category: 'OWNED-COST' }),
      });
      const owned = acquired.plan.asset;
      expect(owned).toMatchObject({
        status: 'ACTIVE',
        lease: null,
        ownership: { date: due, basis },
        end: commenced.plan.asset.end,
        inService: start,
      });
      expect(
        Number(owned.cost) -
          Number(owned.accumulated) -
          Number(owned.impairment),
      ).toBe(110000);
      expect(
        acquired.plan.lines.some(
          (l: { role: string }) =>
            l.role === 'FA_LOSS' || l.role === 'FA_LEASE',
        ),
      ).toBe(false);
      if (basis === 'TITLE_TRANSFER') expect(acquired.journal_id).toBeNull();
      else {
        expect(owned.category).toBe('OWNED-COST');
        expect(acquired.plan.lines).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ role: 'FA_IMPROVED', debit: '120000' }),
            expect.objectContaining({ role: 'FA_COST', credit: '120000' }),
          ]),
        );
      }
      expect(await preview(code)).toMatchObject({ amount: '10000' });
      const undone = await finish('REVERSE', code, {
        date: due,
        original: acquired.id,
      });
      expect(undone.plan.asset.lease).toEqual(paid.plan.asset.lease);
      if (basis === 'PURCHASE_OPTION') {
        const returned = await finish('LEASE_END', code, {
          date: due,
          note: 'Option waived; signed return to lessor',
          returnedToLessor: true,
        });
        expect(returned.plan.asset.status).toBe('DISPOSED');
      } else {
        await finish('LEASE_TAKE_OWNERSHIP', code, agreement);
        const ownedCharge = await finish('DEPRECIATE', code, { date: f.today });
        expect(Number(ownedCharge.plan.asset.accumulated)).toBeGreaterThan(
          Number(owned.accumulated),
        );
      }
    }
    const proceeds = await journal(
      due,
      'FA_OFFSET',
      'FA_CLEAR',
      '300000',
      coast,
    );
    const disposed = await finish('DISPOSE', 'AST-000002', {
      date: shiftMonth(start, 1),
      amount: '300000',
      sourceJournal: proceeds,
      sourceLine: 'L2',
      note: 'Approved sale',
    });
    expect(disposed.plan.asset.status).toBe('DISPOSED');
    expect(await branchBalances(disposed.journal_id)).toEqual(balanced);
  }
  const report = await call(
    checker,
    root + '/reports?' + q + '&from=' + start + '&to=' + f.today,
  );
  expect(Number(report.opening) + Number(report.change)).toBeCloseTo(
    Number(report.closing),
    2,
  );
  expect(
    report.reconciliation.every((r: any) => Number(r.difference) === 0),
  ).toBe(true);
  const [n] = await db.query(
    "SELECT count(*) n FROM finance_foundation_journals WHERE candidate_id=$1 AND mode='LIVE'",
    [cap.candidate_id],
  );
  expect(Number(n.n)).toBe(1);
}
