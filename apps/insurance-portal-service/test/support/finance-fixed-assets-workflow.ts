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
  ) => {
    const c = await post(maker, 'foundation/gl/vouchers', {
      input: {
        date,
        reference: 'FUND-' + randomUUID(),
        currency: 'TZS',
        description: 'Verified fixed asset source',
        evidence,
        lines: [
          { role: debit, debit: amount, credit: '0', dimensions: dim },
          { role: credit, debit: '0', credit: amount, dimensions: dim },
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
    const opening = await finish('OPENING', 'OLD-PC', {
      name: 'Opening asset',
      category: 'OPEN-PC',
      location: 'HQ',
      dimensions: dim,
      amount: '1000',
      accumulated: '200',
      inService: start,
    });
    expect(opening.journal_id).toBeNull();
    expect(
      Number(opening.plan.asset.cost) - Number(opening.plan.asset.accumulated),
    ).toBe(800);
    await post(
      maker,
      root,
      {
        input: input('OPENING', 'EXCESS', {
          name: 'Excess opening',
          category: 'OPEN-PC',
          location: 'HQ',
          dimensions: dim,
          amount: '1',
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
    for (const [index, v] of valuations.entries()) {
      const approved = await post(checker, root + '/' + v.id + '/approve', {
        reason: 'Verified class valuation',
      });
      if (approved.state !== 'POSTED') {
        const queued = await post(maker, root + '/' + v.id + '/post', {});
        await ledger(queued.candidate_id);
      }
      if (index === 0) {
        expect(
          (await call(checker, root + '?' + q)).valuations[0],
        ).toMatchObject({ state: 'PARTIAL', posted: 1, total: 2 });
        await close(period.revision, 'CLOSED', 409);
      }
    }
    expect((await call(checker, root + '?' + q)).valuations[0].state).toBe(
      'COMPLETE',
    );
    const closed = await close(period.revision, 'CLOSED');
    await close(closed.revision, 'OPEN');
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
    const lease = await finish('LEASE_START', 'ROU-1', {
      ...base,
      name: 'Office lease',
      leaseMonths: 2,
      payment: '10000',
      annualRate: '12',
    });
    const legacy = structuredClone(lease.plan.asset);
    delete legacy.lease.usefulLifeEnd;
    delete legacy.lease.ownershipTransfer;
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
    const modification = [shiftDay(due, 3), f.today].sort()[0];
    const amended = await finish('LEASE_REMEASURE', 'ROU-1', {
      date: modification,
      leaseMonths: 2,
      payment: '5500',
      annualRate: '9',
      firstDue: shiftMonth(due, 1),
    });
    expect(amended.plan.asset.lease.schedule[0].start).toBe(modification);
    const terminated = await finish('LEASE_END', 'ROU-1', {
      date: modification,
      note: 'Lease terminated by agreement',
    });
    expect(terminated.plan.asset.lease.liability).toBe('0');
    const proceeds = await journal(due, 'FA_OFFSET', 'FA_CLEAR', '300000');
    const disposed = await finish('DISPOSE', 'AST-000002', {
      date: shiftMonth(start, 1),
      amount: '300000',
      sourceJournal: proceeds,
      sourceLine: 'L2',
      note: 'Approved sale',
    });
    expect(disposed.plan.asset.status).toBe('DISPOSED');
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
