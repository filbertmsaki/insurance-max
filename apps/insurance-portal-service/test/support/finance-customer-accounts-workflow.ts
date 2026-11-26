import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { fixtureBank } from './finance-bank-observation-fixture';
import type { Evidence } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-gl-program';

type Http = (
  u: string,
  path: string,
  body?: Record<string, any>,
  status?: number,
) => Promise<any>;
export async function exerciseCustomerAccounts(f: {
  call: Http;
  post: Http;
  maker: string;
  checker: string;
  deputy: string;
  company: string;
  scope: { bookId: string; legalEntityId: string };
  today: string;
  document: Evidence;
  db: DataSource;
  branch: string;
  department: string;
  insurer: boolean;
}) {
  const { call, post, maker, checker, deputy, db, scope, today, company } = f;
  const dim = { BRANCH: f.branch, COST_CENTRE: 'HQ', DEPARTMENT: f.department };
  const customer = randomUUID(),
    payer = randomUUID(),
    q = new URLSearchParams(scope).toString();
  for (const id of [customer, payer])
    await db.query(
      "INSERT INTO customers(id,company_id,customer_no,display_name,customer_type,phone,country_code,region,district) VALUES($1,$2,$3,'Fleet customer','CORPORATE','000000000','TZ','Dar es Salaam','Ilala')",
      [id, company, 'AR-' + id.slice(0, 8)],
    );
  const make = (kind: string, x: Record<string, any> = {}) => ({
    kind,
    reference: kind + '-' + randomUUID(),
    currency: 'TZS',
    date: today,
    evidence: f.document,
    dimensions: dim,
    requestKey: randomUUID(),
    ...x,
  });
  const submit = (input: Record<string, any>, status?: number) =>
    post(
      maker,
      input.kind === 'OPENING_IMPORT'
        ? 'customer-accounts/opening-imports'
        : 'customer-accounts',
      { input },
      status,
    );
  const decide = (r: any, actor = checker, status?: number) =>
    post(
      actor,
      'customer-accounts/' + r.id + '/approve',
      { reason: 'Verified supporting record' },
      status,
    );
  const send = (r: any, body: Record<string, any> = {}) =>
    post(maker, 'customer-accounts/' + r.id + '/post', body);
  const ledger = async (candidate: string) => {
    const [c] = await db.query(
      'SELECT subject_hash FROM finance_journal_candidates WHERE id=$1',
      [candidate],
    );
    const path = 'foundation/operating-postings/' + candidate + '/approve',
      body = { subjectHash: c.subject_hash };
    await post(deputy, path, body);
    await post(checker, path, body);
    await post(checker, path, body);
  };
  const finish = async (kind: string, x: Record<string, any>) => {
    const r = await submit(make(kind, x));
    await decide(r);
    const doc = await send(r);
    if (doc.candidate_id) await ledger(doc.candidate_id);
    return send(r);
  };
  const category = await submit(make('CATEGORY'));
  await decide(category, maker, 403);
  await decide(category);
  const setup = await submit(
    make('POLICY', {
      requireProfile: false,
      roles: {
        ar: 'AR',
        income: 'FEES',
        advance: 'ACCRUED',
        tax: 'TRADE_AP',
        bank: 'CRDB',
        allowance: 'PREPAID',
        expense: 'INTERNET',
        premiumCash: 'LRC',
      },
      lossRates: ['2', '5', '10', '25', '50'],
      reminderDays: [0, 7, 30],
    }),
  );
  await decide(setup);
  await decide(
    await submit(
      make('PROFILE', {
        customerId: customer,
        categoryId: category.id,
        termCode: 'CUSTOMER',
        amount: '20000000',
      }),
    ),
  );
  const bill = async (n: number, debtor = customer) => {
    return call(maker, 'invoices', {
      insurer_company_id: company,
      customer_id: debtor,
      invoice_type: 'FEE',
      currency: 'TZS',
      items: [
        {
          item_type: 'FEE',
          item_name: 'Fleet administration',
          quantity: 1,
          unit_amount: n,
          total_amount: n,
        },
      ],
    });
  };
  const issue = (i: any, status?: number, term?: string) =>
    call(
      maker,
      'invoices/' + i.id + '/issue',
      {
        expected_state_version: i.state_version,
        payment_term_code: term,
        idempotency_key: 'issue-' + i.id,
        finance_dimensions: dim,
      },
      status,
    );
  const receipt = async (
    c: string,
    n: number,
    i?: string,
    currency = 'TZS',
  ) => {
    const tx = await call(maker, 'payment-transactions/manual', {
      customer_id: c,
      invoice_id: i,
      provider_code: 'MANUAL',
      payer_name: 'Fleet customer',
      payment_reference: randomUUID(),
      payment_method: 'CASH',
      currency_code: currency,
      amount: n,
      idempotency_key: randomUUID(),
    });
    return call(maker, 'receipts/post', {
      payment_transaction_id: tx.id,
      invoice_id: i,
      allocation_amount: i ? n : undefined,
      finance_dimensions: dim,
      idempotency_key: randomUUID(),
    });
  };
  const a = await bill(15000000),
    issued = await issue(a);
  await ledger(issued.journal_candidate_id);
  await issue(await bill(6000000), 409);
  const r = await receipt(customer, 10000000, a.id);
  await ledger(r.journal_candidate_id);
  const native = async (id: string) =>
    (
      await db.query(
        'SELECT status,balance_amount,paid_amount,written_off_amount FROM invoices WHERE id=$1',
        [id],
      )
    )[0];
  expect(await native(a.id)).toMatchObject({ status: 'PARTIALLY_PAID' });
  expect(Number((await native(a.id)).balance_amount)).toBe(5000000);
  const report = () =>
    call(
      checker,
      'customer-accounts/reports?' +
        q +
        '&currency=TZS&customer=' +
        customer +
        '&from=' +
        today +
        '&to=' +
        today,
    );
  const first = await report();
  expect(Number(first.aging[0].current)).toBe(5000000);
  expect(Number(first.totals[0].closing)).toBe(5000000);
  const e = await post(maker, 'customer-accounts/collections', {
    input: {
      invoiceId: a.id,
      kind: 'PROMISE',
      ownerId: maker,
      followUp: today,
      promiseAmount: '1000000',
      note: 'Payment confirmed for follow-up',
      requestKey: randomUUID(),
    },
  });
  expect(e.kind).toBe('PROMISE');
  const external = make('RECONCILIATION', {
    customerId: customer,
    from: today,
    opening: '0',
    amount: '5000000',
    statementLines: first.lines
      .filter((x: any) => Number(x.net))
      .map((x: any) => ({
        date: x.day,
        reference: x.reference,
        amount: x.net,
      })),
  });
  await decide(await submit(external));
  await submit(
    { ...external, requestKey: randomUUID(), amount: '4999999' },
    409,
  );
  const allowance = await finish('IMPAIRMENT', {
    customerId: customer,
    invoiceId: a.id,
  });
  expect(Number(allowance.amount)).toBe(100000);
  const write = await finish('WRITE_OFF', {
    customerId: customer,
    invoiceId: a.id,
    amount: '150000',
  });
  expect(Number((await native(a.id)).written_off_amount)).toBe(150000);
  await finish('REVERSAL', { customerId: customer, relatedId: write.id });
  expect(Number((await native(a.id)).written_off_amount)).toBe(0);
  const credit = await finish('CREDIT_NOTE', {
    customerId: customer,
    invoiceId: a.id,
    amount: '6000000',
    tax: '0',
  });
  expect(Number((await native(a.id)).balance_amount)).toBe(0);
  const b = await bill(2000000);
  await ledger((await issue(b)).journal_candidate_id);
  const application = await finish('CREDIT_APPLICATION', {
    customerId: customer,
    relatedId: credit.id,
    invoiceId: b.id,
    amount: '500000',
  });
  expect(Number((await native(b.id)).balance_amount)).toBe(1500000);
  await finish('REVERSAL', { customerId: customer, relatedId: application.id });
  const remnant = await submit(
    make('CREDIT_REFUND', {
      customerId: customer,
      relatedId: credit.id,
      amount: '500000',
    }),
  );
  await decide(remnant);
  await post(maker, 'customer-accounts/' + remnant.id + '/post', {}, 503);
  const bank = fixtureBank(db, company, scope.bookId, '112001');
  try {
    const voucher = await send(remnant, {
      observation: await bank.observe('AR_CREDIT_REFUND', remnant.id),
    });
    await ledger(voucher.candidate_id);
  } finally {
    bank.restore();
  }
  const unlinked = await receipt(payer, 1000000);
  await ledger(unlinked.journal_candidate_id);
  const refundInput = {
    receipt_id: unlinked.id,
    amount: 800000,
    reason: 'Return unapplied cash',
    idempotency_key: randomUUID(),
  };
  const raced = await Promise.allSettled([
    call(maker, 'refunds', refundInput),
    call(maker, 'refunds', { ...refundInput, idempotency_key: randomUUID() }),
  ]);
  expect(raced.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const [reservation] = await db.query(
    'SELECT id FROM finance_refunds WHERE receipt_id=$1',
    [unlinked.id],
  );
  await call(maker, 'refunds/' + reservation.id + '/cancel', {
    reason: 'Apply instead',
    idempotency_key: randomUUID(),
  });
  const alloc = (key: string, status?: number) =>
    call(
      maker,
      'receipts/' + unlinked.id + '/allocate',
      { invoice_id: b.id, amount: 100000, idempotency_key: key },
      status,
    );
  await alloc(randomUUID(), 409);
  await decide(
    await submit(
      make('PAYER_MANDATE', {
        customerId: customer,
        payerId: payer,
        enabled: true,
      }),
    ),
  );
  const key = randomUUID();
  expect((await alloc(key)).id).toBe((await alloc(key)).id);
  await call(
    maker,
    'receipts/' + unlinked.id + '/allocate',
    { invoice_id: b.id, amount: 100001, idempotency_key: key },
    409,
  );
  const cash = await receipt(customer, 500000);
  await ledger(cash.journal_candidate_id);
  const advance = await finish('ADVANCE', {
    customerId: customer,
    receiptId: cash.id,
    amount: '400000',
  });
  const applied = await finish('ADVANCE_APPLICATION', {
    customerId: customer,
    relatedId: advance.id,
    invoiceId: b.id,
    amount: '250000',
  });
  await finish('ADVANCE_RELEASE', {
    customerId: customer,
    relatedId: advance.id,
    amount: '150000',
  });
  expect(Number((await native(b.id)).balance_amount)).toBe(1650000);
  const w = await call(checker, 'customer-accounts?' + q);
  expect(w.documents.length).toBeGreaterThan(10);
  expect(w.cases[0].id).toBe(e.id);
  expect((await report()).balanceExceptions).toEqual([]);
  await finish('REVERSAL', { customerId: customer, relatedId: applied.id });
  expect(Number((await native(b.id)).balance_amount)).toBe(1900000);
  const debit = await finish('DEBIT_NOTE', {
    customerId: customer,
    invoiceId: b.id,
    amount: '12000',
    tax: '2000',
  });
  expect(debit.state).toBe('POSTED');
  expect(Number((await native(b.id)).balance_amount)).toBe(1912000);
  await submit(
    make('DEBIT_NOTE', {
      customerId: customer,
      invoiceId: b.id,
      reference: debit.reference,
      amount: '12000',
      tax: '2000',
    }),
    409,
  );
  await finish('REVERSAL', { customerId: customer, relatedId: debit.id });
  const paidOut = await call(maker, 'refunds', {
    receipt_id: unlinked.id,
    amount: 3000,
    reason: 'Refund part of confirmed cash',
    idempotency_key: randomUUID(),
  });
  await call(checker, 'refunds/' + paidOut.id + '/approve', {
    idempotency_key: randomUUID(),
    notes: 'Verified',
  });
  const nativeBank = fixtureBank(db, company, scope.bookId);
  try {
    const settlement = await nativeBank.observe('REFUND', paidOut.id),
      body = {
        settlement_observation: settlement,
        idempotency_key: randomUUID(),
      };
    const result = await call(maker, 'refunds/' + paidOut.id + '/pay', body);
    expect(result.status).toBe('PAID');
    expect((await call(maker, 'refunds/' + paidOut.id + '/pay', body)).id).toBe(
      result.id,
    );
  } finally {
    nativeBank.restore();
  }
  expect(
    Number(
      (
        await db.query('SELECT unallocated_amount FROM receipts WHERE id=$1', [
          unlinked.id,
        ])
      )[0].unallocated_amount,
    ),
  ).toBe(897000);
  await decide(
    await submit(
      make('PROFILE', {
        customerId: payer,
        categoryId: category.id,
        termCode: 'DUE_NOW',
        amount: '0',
      }),
    ),
  );
  const portalUser = randomUUID();
  await db.query(
    "INSERT INTO users(id,first_name,last_name,email,phone,user_type) VALUES($1,'Customer','Fleet',$2,'0700000111','CUSTOMER')",
    [portalUser, portalUser + '@example.invalid'],
  );
  await db.query('UPDATE customers SET user_id=$2 WHERE id=$1', [
    payer,
    portalUser,
  ]);
  const due = await bill(1000, payer);
  await issue(due);
  // Zero credit permits immediate collection. An explicit extension remains subject to the cap.
  await issue(await bill(1000, payer), 409, 'NET30');
  const collection = (kind: string) =>
    post(maker, 'customer-accounts/collections', {
      input: {
        invoiceId: due.id,
        kind,
        ownerId: maker,
        note: 'Customer contact',
        requestKey: randomUUID(),
      },
    });
  await collection('DISPUTE');
  await post(maker, 'customer-accounts/reminders');
  const alerts = () =>
    db.query(
      'SELECT n.user_id FROM finance_ar_reminders r JOIN portal_notifications n ON n.id=r.notification_id WHERE r.invoice_id=$1',
      [due.id],
    );
  expect(await alerts()).toHaveLength(0);
  await collection('RESOLVE');
  await Promise.all([
    post(maker, 'customer-accounts/reminders'),
    post(maker, 'customer-accounts/reminders'),
  ]);
  expect(await alerts()).toEqual([{ user_id: portalUser }]);
  await receipt(payer, 1000, due.id);
  await post(maker, 'customer-accounts/reminders');
  expect(await alerts()).toHaveLength(1);
  if (f.insurer) {
    const premium = await call(maker, 'invoices', {
      insurer_company_id: company,
      customer_id: customer,
      invoice_type: 'PREMIUM',
      currency: 'TZS',
      items: [
        {
          item_type: 'PREMIUM',
          item_name: 'Advance-reversal test',
          quantity: 1,
          unit_amount: 100000,
          total_amount: 100000,
        },
      ],
    });
    expect((await issue(premium)).accounting_status).toBe(
      'MEMORANDUM_RECORDED',
    );
    const premiumCash = await receipt(customer, 25000);
    await ledger(premiumCash.journal_candidate_id);
    const deposit = await finish('ADVANCE', {
      customerId: customer,
      receiptId: premiumCash.id,
      amount: '25000',
    });
    const baseline = (await report()).control;
    const use = await finish('ADVANCE_APPLICATION', {
      customerId: customer,
      invoiceId: premium.id,
      relatedId: deposit.id,
      amount: '25000',
    });
    expect(Number((await report()).control.difference)).toBe(
      Number(baseline.difference),
    );
    await finish('REVERSAL', { customerId: customer, relatedId: use.id });
    const restored = (await report()).control;
    expect(Number(restored.difference)).toBe(Number(baseline.difference));
    expect(Number(restored.advance_liability)).toBe(
      Number(baseline.advance_liability),
    );
    const [opening] = await db.query(
      "SELECT payload->>'date' AS cutoff FROM finance_foundation_documents WHERE id=(SELECT opening_id FROM finance_gl_fx_opening_sets WHERE account_code='1200' AND book_id=$1 LIMIT 1)",
      [scope.bookId],
    );
    const cutoff = opening.cutoff;
    await decide(
      await submit(
        make('POLICY', {
          date: cutoff,
          currency: 'USD',
          roles: setup.data.roles,
          lossRates: setup.data.lossRates,
          reminderDays: [],
          requireProfile: true,
        }),
      ),
    );
    const usd = (to = cutoff) =>
      call(
        checker,
        'customer-accounts/reports?' +
          q +
          '&currency=USD&customer=' +
          payer +
          '&from=' +
          cutoff +
          '&to=' +
          to,
      );
    const before = await usd();
    const outstanding = Number(before.control.difference).toFixed(2);
    expect(Number(outstanding)).toBe(60);
    const older = new Date(Date.parse(cutoff + 'T12:00:00Z') - 100 * 86400000)
      .toISOString()
      .slice(0, 10);
    const item = {
      customerCode: 'AR-' + payer.slice(0, 8),
      reference: 'EXTERNAL-001',
      invoiceDate: older,
      dueDate: older,
      amount: outstanding,
    };
    const batch = () =>
      make('OPENING_IMPORT', {
        date: cutoff,
        currency: 'USD',
        openingItems: [item],
      });
    await submit(
      { ...batch(), openingItems: [{ ...item, amount: '59' }] },
      409,
    );
    const original = await submit(batch());
    await decide(original, maker, 403);
    expect((await decide(original)).state).toBe('POSTED');
    expect((await decide(original)).state).toBe('POSTED');
    const imported = await usd();
    expect(Number(imported.totals[0].opening)).toBe(60);
    expect(Number(imported.agingTotals.over_90)).toBe(60);
    expect(Number(imported.control.difference)).toBe(0);
    const clear = await submit(
      make('OPENING_VOID', {
        currency: 'USD',
        date: cutoff,
        relatedId: original.id,
      }),
    );
    await decide(clear);
    expect(Number((await usd()).control.difference)).toBe(60);
    const firstPart = await submit({
      ...batch(),
      openingItems: [{ ...item, reference: 'EXTERNAL-FIRST', amount: '20' }],
      remainingAfterImport: '40',
    });
    await decide(firstPart);
    expect(Number((await usd()).control.difference)).toBe(40);
    const replacement = await submit({
      ...batch(),
      openingItems: [{ ...item, amount: '40' }],
    });
    await decide(replacement);
    expect(Number((await usd()).control.difference)).toBe(0);
    const ids = await db.query(
      'SELECT o.invoice_id,i.due_date::text due FROM finance_ar_opening_items o JOIN invoices i ON i.id=o.invoice_id WHERE o.import_id=$1',
      [replacement.id],
    );
    expect(ids).toHaveLength(1);
    expect(ids[0].due).toBe(older);
    const openingInvoice = await call(checker, 'invoices/' + ids[0].invoice_id);
    expect(openingInvoice.accounting_status).toBe('CERTIFIED_OPENING');
    expect(openingInvoice.opening_invoice.reference).toBe(item.reference);
    const beforeCollection = await usd(today);
    const collectionReceipt = await receipt(
      payer,
      10,
      ids[0].invoice_id,
      'USD',
    );
    await ledger(collectionReceipt.journal_candidate_id);
    expect(Number((await native(ids[0].invoice_id)).balance_amount)).toBe(30);
    const collected = await usd(today);
    expect(Number(collected.control.difference)).toBe(
      Number(beforeCollection.control.difference),
    );
    expect(Number(collected.agingTotals.over_90)).toBe(50);
    expect(Number((await usd()).agingTotals.over_90)).toBe(60);
    await submit(
      make('OPENING_VOID', {
        currency: 'USD',
        date: cutoff,
        relatedId: replacement.id,
      }),
      409,
    );
    expect(
      await db.query(
        'SELECT candidate_id FROM finance_operating_postings WHERE source_id=$1',
        [ids[0].invoice_id],
      ),
    ).toHaveLength(0);
  }
  if (!f.insurer) {
    const asOf = new Date(Date.parse(today + 'T12:00:00Z') + 91 * 86400000)
      .toISOString()
      .slice(0, 10);
    const buckets = [0, 0, 0, 0, 0];
    for (const [index, amounts] of [
      [5, 0, 0, 0, 0],
      [20, 10, 5, 0, 0],
      [15, 5, 0, 0, 0],
      [0, 0, 3, 2, 1],
    ].entries()) {
      const debtor = randomUUID();
      await db.query(
        "INSERT INTO customers(id,company_id,customer_no,display_name,customer_type,phone,country_code,region,district) VALUES($1,$2,$3,'Aged account','CORPORATE','000000003','TZ','Dar es Salaam','Ilala')",
        [debtor, company, 'AGE-' + index],
      );
      for (const [n, value] of amounts.entries())
        if (value)
          await issue(
            await bill(value * 1000000, debtor),
            undefined,
            ['NET120', 'NET90', 'NET60', 'NET30', 'DUE_NOW'][n],
          );
      const aging = await call(
        checker,
        'customer-accounts/reports?' +
          q +
          '&currency=TZS&customer=' +
          debtor +
          '&from=' +
          today +
          '&to=' +
          asOf,
      );
      ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'over_90'].forEach(
        (key, n) => {
          buckets[n] += Number(aging.agingTotals[key]);
        },
      );
    }
    expect(buckets).toEqual([40000000, 15000000, 8000000, 2000000, 1000000]);
    const strict = await submit(
      make('POLICY', {
        roles: setup.data.roles,
        lossRates: setup.data.lossRates,
        reminderDays: [],
        requireProfile: true,
      }),
    );
    await decide(strict);
    const [unprofiled] = await db.query(
      "SELECT id FROM customers WHERE company_id=$1 AND customer_no='AGE-0'",
      [company],
    );
    await issue(await bill(10000, unprofiled.id), 409);
    const left = await bill(10000000),
      right = await bill(10000000);
    const race = await Promise.allSettled([issue(left), issue(right)]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      String(
        (race.find((r) => r.status === 'rejected') as PromiseRejectedResult)
          .reason,
      ),
    ).toContain('credit limit');
  }
}
