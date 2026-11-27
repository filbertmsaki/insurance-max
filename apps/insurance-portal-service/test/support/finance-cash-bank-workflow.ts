import { randomUUID } from 'node:crypto';
import { fixtureBank } from './finance-bank-observation-fixture';
import type { DataSource } from 'typeorm';
import type { CashBankKind } from '@insurance-max/contracts';
type Request = (
  user: string,
  path: string,
  body?: any,
  status?: number,
) => Promise<any>;
export async function exerciseCashBank(f: {
  call: Request;
  post: Request;
  maker: string;
  checker: string;
  deputy: string;
  query: string;
  today: string;
  document: { id: string; hash: string; documentId: string };
  branch: string;
  db: DataSource;
  bookId: string;
  company: string;
  feeInput: Record<string, unknown>;
  customer: string;
  contextPin: { contextId: string; contextHash: string };
  until: string;
}) {
  const { maker, checker, deputy, today, post, call } = f;
  const workspace = () => call(checker, 'cash-bank?' + f.query);
  let seq = 0;
  const input = (
    kind: CashBankKind,
    fields: Record<string, string>,
    reference?: string,
    date = today,
  ) => ({
    requestKey: randomUUID(),
    kind,
    fields,
    reference: reference || 'CB-TEST-' + ++seq,
    date,
    evidence: f.document,
    dimensions: { BRANCH: f.branch, COST_CENTRE: 'HQ' },
  });
  async function run(
    kind: CashBankKind,
    fields: Record<string, string>,
    reference?: string,
    date = today,
  ) {
    const v = input(kind, fields, reference, date),
      r = await post(maker, 'cash-bank', { input: v });
    expect((await post(maker, 'cash-bank', { input: v })).id).toBe(r.id);
    const review = 'cash-bank/' + r.id + '/review';
    await post(maker, review, { decision: 'approve' }, 403);
    const checked = await post(checker, review, { decision: 'approve' });
    if (checked.state === 'APPROVED') {
      const sent = await post(maker, 'cash-bank/' + r.id + '/post');
      const w = await workspace(),
        req = w.documents.find((x: any) => x.id === sent.id);
      const path =
          'foundation/operating-postings/' + sent.candidate_id + '/approve',
        body = { subjectHash: req.candidate_hash };
      await post(deputy, path, body);
      const [j, retry] = await Promise.all([
        post(checker, path, body),
        post(checker, path, body),
      ]);
      expect(j.journalId).toBe(retry.journalId);
    }
    return r.id;
  }
  const bank = await run(
      'BANK',
      { name: 'CRDB', branchName: 'Head Office' },
      'CRDB',
    ),
    office = await run(
      'OFFICE',
      { name: 'Head Office', branch: f.branch },
      'HQ',
    );
  const common = {
    name: 'Collections',
    currency: 'TZS',
    branch: f.branch,
    purpose: 'Company cash',
    opening: '0',
  };
  await run('AMEND_BANK', {
    master: bank,
    name: 'CRDB Bank',
    branchName: 'Head Office',
  });
  await run('AMEND_OFFICE', {
    master: office,
    name: 'Head Office Cash Desk',
    branch: f.branch,
  });
  const retired = await run(
    'BANK',
    { name: 'Previous bank', branchName: 'Main' },
    'OLD-BANK',
  );
  await run('CLOSE_MASTER', { master: retired });
  expect(
    (await workspace()).masters.find((x: any) => x.id === retired).active,
  ).toBe(false);
  const bankAccount = await run(
    'ACCOUNT',
    { ...common, type: 'BANK', institution: bank, number: '001', role: 'CRDB' },
    'COLLECTIONS',
  );
  const other = await run(
    'ACCOUNT',
    { ...common, type: 'BANK', institution: bank, number: '002', role: 'NMB' },
    'OPERATIONS',
  );
  const closeActive = await post(maker, 'cash-bank', {
    input: input('CLOSE_MASTER', { master: bank }),
  });
  await post(
    checker,
    'cash-bank/' + closeActive.id + '/review',
    { decision: 'approve' },
    409,
  );
  await post(maker, 'cash-bank/' + closeActive.id + '/cancel');
  const preview = await call(
    checker,
    'cash-bank/cutover?' +
      f.query +
      '&role=CLAIMS_BANK&currency=TZS&date=' +
      today,
  );
  expect(Number(preview.opening)).toBe(155000000);
  expect(preview.pendingReceipts).toBe(0);
  const claims = await run(
    'ACCOUNT',
    {
      ...common,
      type: 'BANK',
      institution: bank,
      number: '004',
      role: 'CLAIMS_BANK',
      opening: '155000000',
      openItems: 'OLD-DEPOSIT|10000000\nOLD-PAYMENT|-5000000',
    },
    'CLAIMS',
  );
  const example = await run('STATEMENT', {
    account: claims,
    from: today,
    to: today,
    opening: '150000000',
    closing: '150000000',
    csv: 'date,reference,amount',
  });
  const comparison = await call(
    checker,
    'cash-bank/statements/' + example + '?' + f.query,
  );
  expect(
    Object.fromEntries(
      [
        'statement',
        'deposits',
        'outstanding',
        'adjusted',
        'ledger',
        'difference',
      ].map((k) => [k, Number(comparison[k])]),
    ),
  ).toEqual({
    statement: 150000000,
    deposits: 10000000,
    outstanding: 5000000,
    adjusted: 155000000,
    ledger: 155000000,
    difference: 0,
  });
  await run('SIGNOFF', { statement: example });
  const usd = await run(
    'ACCOUNT',
    {
      ...common,
      type: 'BANK',
      institution: bank,
      number: '003',
      role: 'USD_BANK',
      currency: 'USD',
    },
    'USD',
  );
  const wallet = await run(
    'ACCOUNT',
    {
      ...common,
      type: 'WALLET',
      institution: bank,
      number: 'WALLET-1',
      role: 'WALLET',
    },
    'MOBILE',
  );
  const till = await run(
    'ACCOUNT',
    {
      ...common,
      type: 'TILL',
      office,
      manager: checker,
      maximum: '2000000',
      minimum: '300000',
      limit: '200000',
      role: 'CASH',
    },
    'TILL',
  );
  await run('CASHIER', { account: till, cashier: maker });
  const cash = async () =>
    Number(
      (await workspace()).accounts.find((x: any) => x.id === till).balance,
    );
  const start = await cash();
  await run('OPEN', { account: till, amount: String(start) });
  await post(
    maker,
    'cash-bank',
    {
      input: input('PAYMENT', {
        account: till,
        role: 'INTERNET',
        amount: String(start + 1),
      }),
    },
    409,
  );
  async function approveJournal(id: string) {
    const [candidate] = await f.db.query(
      'SELECT subject_hash hash FROM finance_journal_candidates WHERE id=$1',
      [id],
    );
    const path = 'foundation/operating-postings/' + id + '/approve',
      body = { subjectHash: candidate.hash };
    await post(deputy, path, body);
    return (await post(checker, path, body)).journalId;
  }
  async function customerReceipt(method: string, accountId: string) {
    const invoice = await call(maker, 'invoices', f.feeInput);
    const issue = await call(maker, 'invoices/' + invoice.id + '/issue', {
      expected_state_version: invoice.state_version,
      idempotency_key: randomUUID(),
      finance_dimensions: { COST_CENTRE: 'HQ', BRANCH: f.branch },
    });
    await approveJournal(issue.journal_candidate_id);
    const payment = await call(maker, 'payment-transactions/manual', {
      invoice_id: invoice.id,
      customer_id: f.customer,
      provider_code: 'MANUAL',
      payment_reference: 'FIN06-' + method,
      payment_method: method,
      currency_code: 'TZS',
      amount: 100,
      payer_name: 'Customer One',
      idempotency_key: randomUUID(),
    });
    const body = {
      payment_transaction_id: payment.id,
      invoice_id: invoice.id,
      allocation_amount: 100,
      idempotency_key: randomUUID(),
    };
    const [receipt, retry] = await Promise.all([
      call(maker, 'receipts/post', body),
      call(maker, 'receipts/post', body),
    ]);
    expect(retry.id).toBe(receipt.id);
    const journal = await approveJournal(receipt.journal_candidate_id);
    const entries = (await workspace()).entries.filter(
      (e: any) => e.journal_id === journal && e.account_id === accountId,
    );
    expect(entries).toHaveLength(1);
    expect(Number(entries[0].amount)).toBe(100);
  }
  await customerReceipt('CASH', till);
  await customerReceipt('MOBILE_MONEY', wallet);
  const walletSettlement = await run('WALLET_SETTLE', {
    account: wallet,
    destination: other,
    role: 'TRANSIT',
    amount: '100',
  });
  await run('RECEIVE', { target: walletSettlement });
  await run(
    'RECEIPT',
    { account: till, role: 'FEES', amount: '1000000' },
    'GENERAL-RECEIPT',
  );
  expect(await cash()).toBe(start + 1000100);
  const apInput = (
    kind: string,
    ref: string,
    details: object,
    party: { supplierId?: string; employeeId?: string } = {},
  ) => ({
    kind,
    reference: ref,
    details,
    date: today,
    currency: 'TZS',
    dimensions: { BRANCH: f.branch, COST_CENTRE: 'HQ' },
    evidence: f.document,
    requestKey: randomUUID(),
    ...party,
  });
  const apReview = async (v: ReturnType<typeof apInput>) => {
    const d = await post(maker, 'payables', { input: v });
    await post(checker, 'payables/' + d.id + '/review', {
      decision: 'APPROVE',
      reason: 'Check source evidence and cash custody',
    });
    return d;
  };
  await apReview(
    apInput('SETTINGS', 'AP', {
      payableRole: 'TRADE_AP',
      employeePayableRole: 'TRADE_AP',
      advanceRole: 'PREPAID',
      imprestRole: 'COMPUTERS',
      vatRole: 'AR',
      withholdingRole: 'ACCRUED',
      discountRole: 'FEES',
      bankRole: 'CASH',
      taxRules: [
        {
          supplierClass: 'STANDARD',
          transactionClass: 'SERVICE',
          vatBps: 0,
          withholdingBps: 0,
        },
      ],
    }),
  );
  const category = await apReview(
    apInput('CATEGORY', 'LOCAL', { name: 'Local suppliers' }),
  );
  const supplier = await apReview(
    apInput('SUPPLIER', 'CASH-SUPPLIER', {
      name: 'Workshop',
      categoryId: category.id,
      tin: 'TEST-100',
      address: 'Dar es Salaam',
      email: 'cash@example.invalid',
      taxClass: 'STANDARD',
    }),
  );
  const advance = await apReview(
    apInput(
      'ADVANCE',
      'Supplier petty cash',
      {
        description: 'Workshop advance',
        amount: '500',
        scheduledDate: today,
        tillId: till,
      },
      { supplierId: supplier.id },
    ),
  );
  await post(maker, 'payables/' + advance.id + '/instructions', {}, 409);
  const native = await post(maker, 'payables/' + advance.id + '/post');
  const nativeJournal = await approveJournal(native.candidate_id);
  expect(
    (await workspace()).entries.filter(
      (e: any) => e.journal_id === nativeJournal && e.account_id === till,
    ),
  ).toHaveLength(1);
  expect(await cash()).toBe(start + 999600);
  await post(
    maker,
    'cash-bank',
    {
      input: input('PAYMENT', {
        account: till,
        role: 'INTERNET',
        amount: '200001',
      }),
    },
    409,
  );
  await run('PAYMENT', { account: till, role: 'INTERNET', amount: '100000' });
  const dispatch = await run('DEPOSIT', {
    account: till,
    destination: bankAccount,
    role: 'TRANSIT',
    amount: '500000',
  });
  expect(
    Number(
      (await workspace()).accounts.find((x: any) => x.id === till).in_transit,
    ),
  ).toBe(500000);
  await run('RECEIVE', { target: dispatch }, 'CRDB-DEPOSIT');
  const transfer = await run(
    'TRANSFER',
    {
      account: bankAccount,
      destination: other,
      role: 'TRANSIT',
      amount: '50000',
    },
    'NMB-TRANSFER',
  );
  await run('RECEIVE', { target: transfer }, 'NMB-ARRIVAL');
  const rate = await post(maker, 'foundation/exchange-rates', {
    version: 1,
    input: {
      ...f.contextPin,
      transactionCurrency: 'USD',
      rate: '2500',
      rateDate: today,
      validTo: f.until,
      source: 'BANK',
      sourceReference: 'Agreed transfer value',
      evidenceHash: f.document.hash,
    },
  });
  await post(checker, 'foundation/documents/' + rate.id + '/reviews', {
    decision: 'REVIEWED',
    subjectHash: rate.subjectHash,
    evidenceHash: f.document.hash,
  });
  const converted = await run('TRANSFER', {
    account: other,
    destination: usd,
    role: 'TRANSIT',
    amount: '2500',
    destinationAmount: '0.99',
  });
  await run('RECEIVE', { target: converted }, 'USD-ARRIVAL');
  expect(
    Number(
      (await workspace()).transfers.find((t: any) => t.id === converted)
        .fx_difference,
    ),
  ).toBe(25);
  await run('FX_SETTLE', { target: converted, role: 'INTERNET' });
  const usdStatement = await run('STATEMENT', {
    account: usd,
    from: today,
    to: today,
    opening: '0',
    closing: '0.99',
    csv: 'date,reference,amount\n' + today + ',USD-ARRIVAL,0.99',
  });
  await run('AUTO_MATCH', { statement: usdStatement });
  expect(
    Number(
      (
        await call(
          checker,
          'cash-bank/statements/' + usdStatement + '?' + f.query,
        )
      ).difference,
    ),
  ).toBe(0);
  await run('SIGNOFF', { statement: usdStatement });
  const withdrawal = await run('REPLENISH', {
    account: other,
    destination: till,
    role: 'TRANSIT',
    amount: '10000',
  });
  await run('RECEIVE', { target: withdrawal });
  const bankWithdrawal = await run('WITHDRAW', {
    account: other,
    destination: till,
    role: 'TRANSIT',
    amount: '500',
  });
  await run('RECEIVE', { target: bankWithdrawal });
  const physical = await cash();
  const count = await run('COUNT', {
    account: till,
    amount: String(physical - 100),
  });
  await run('SHORTAGE', {
    account: till,
    amount: '100',
    target: count,
    role: 'INTERNET',
  });
  await run('CLOSE', { account: till, amount: String(physical - 100) });
  await post(
    maker,
    'cash-bank',
    {
      input: input('PAYMENT', { account: till, role: 'INTERNET', amount: '2' }),
    },
    403,
  );
  const book = await run('CHEQUEBOOK', {
    account: bankAccount,
    first: '100',
    last: '110',
  });
  const cheque = await run(
    'CHEQUE',
    {
      account: bankAccount,
      chequebook: book,
      serial: '100',
      payee: 'Test supplier',
      role: 'INTERNET',
      amount: '5000',
    },
    'CHQ100',
  );
  await run('PRESENT', { target: cheque });
  await run('STOP', { target: cheque });
  const clearedCheque = await run(
    'CHEQUE',
    {
      account: bankAccount,
      chequebook: book,
      serial: '101',
      payee: 'Network supplier',
      role: 'INTERNET',
      amount: '1000',
    },
    'CHQ101',
  );
  const eft = await run(
    'EFT',
    {
      account: bankAccount,
      payee: 'Test supplier',
      bank: 'NMB',
      beneficiary: '12345',
      amount: '5000',
      role: 'INTERNET',
    },
    'EFT-1',
  );
  expect(
    (await call(maker, 'cash-bank/eft/' + eft + '?' + f.query)).instructionId,
  ).toBe(eft);
  const beneficiary = await apReview(
    apInput(
      'BANK',
      'SUP-BANK',
      { bankName: 'NMB', accountName: 'Workshop', accountNumber: '12345001' },
      { supplierId: supplier.id },
    ),
  );
  const payable = await apReview(
    apInput(
      'ADVANCE',
      'Wire advance',
      {
        description: 'Workshop bank advance',
        amount: '750',
        scheduledDate: today,
        bankId: beneficiary.id,
        bankRole: 'CRDB',
      },
      { supplierId: supplier.id },
    ),
  );
  const linkedEft = await run(
    'EFT',
    { account: bankAccount, apVoucher: payable.id },
    'WORKSHOP-WIRE',
  );
  expect(
    await call(maker, 'cash-bank/eft/' + linkedEft + '?' + f.query),
  ).toMatchObject({
    payee: 'Workshop',
    beneficiary: '12345001',
    currency: 'TZS',
  });
  const existingBank = fixtureBank(f.db, f.company, f.bookId, '112001');
  let payableJournal: string;
  let bankRef: string;
  try {
    const observed = await existingBank.observe('AP_PAYMENT', payable.id);
    bankRef = observed.reference;
    const submitted = await post(maker, 'payables/' + payable.id + '/post', {
      observation: observed,
    });
    payableJournal = await approveJournal(submitted.candidate_id);
  } finally {
    existingBank.restore();
  }
  const w = await workspace();
  const accountEntries = w.entries.filter(
    (x: any) => x.account_id === bankAccount,
  );
  const imported = accountEntries.filter(
    (x: any) => x.reference !== 'NMB-TRANSFER' && !x.offset_id,
  );
  expect(accountEntries.filter((x: any) => x.offset_id)).toHaveLength(2);
  const previous = Number(
    w.accounts.find((x: any) => x.id === bankAccount).opening,
  );
  const end =
    imported.reduce((n: number, e: any) => n + Number(e.amount), previous) -
    5000 -
    50 +
    10;
  const csv = [
    'date,reference,amount',
    ...imported.map((e: any) =>
      [
        today,
        e.journal_id === payableJournal ? bankRef : e.reference,
        e.amount,
      ].join(','),
    ),
    today + ',EFT-1,-5000',
    today + ',BANK-FEE,-50',
    today + ',INTEREST-1,10',
  ].join('\n');
  const chargeRule = await run('BANK_RULE', {
    account: bankAccount,
    pattern: 'BANK-FEE',
    classification: 'FEE',
    direction: 'OUTFLOW',
    role: 'INTERNET',
  });
  const st = await run('STATEMENT', {
    account: bankAccount,
    from: today,
    to: today,
    opening: String(previous),
    closing: String(end),
    csv,
  });
  await run('AUTO_MATCH', { statement: st });
  const ls = (await workspace()).lines.filter(
    (x: any) => x.statement_id === st,
  );
  expect(ls.find((x: any) => x.reference === 'BANK-FEE').suggested_role).toBe(
    'INTERNET',
  );
  const apLine = ls.find((x: any) => x.reference === bankRef),
    apEntry = accountEntries.find((x: any) => x.journal_id === payableJournal);
  await post(
    maker,
    'cash-bank',
    { input: input('EFT_SETTLE', { target: linkedEft, line: apLine.id }) },
    409,
  );
  await run('EFT_LINK', {
    target: linkedEft,
    line: apLine.id,
    entry: apEntry.id,
  });
  expect(
    (await workspace()).entries.filter(
      (e: any) => e.journal_id === payableJournal,
    ),
  ).toHaveLength(1);
  await run('EFT_SETTLE', {
    target: eft,
    line: ls.find((x: any) => x.reference === 'EFT-1').id,
  });
  await run('FEE', {
    account: bankAccount,
    amount: '50',
    role: 'INTERNET',
    line: ls.find((x: any) => x.reference === 'BANK-FEE').id,
  });
  await run('INTEREST', {
    account: bankAccount,
    amount: '10',
    role: 'FEES',
    line: ls.find((x: any) => x.reference === 'INTEREST-1').id,
  });
  const feeLine = (await workspace()).lines.find(
    (x: any) => x.reference === 'BANK-FEE',
  );
  await run('UNMATCH', { line: feeLine.id });
  await post(
    maker,
    'cash-bank',
    {
      input: input('FEE', {
        line: feeLine.id,
        account: bankAccount,
        amount: '50',
        role: 'INTERNET',
      }),
    },
    409,
  );
  await run('MATCH', { line: feeLine.id, entry: feeLine.entry_id });
  await run('END_RULE', { rule: chargeRule });
  await run('TIMING', {
    entry: accountEntries.find((x: any) => x.reference === 'NMB-TRANSFER').id,
  });
  const summary = await call(
    checker,
    'cash-bank/statements/' + st + '?' + f.query,
  );
  expect(Number(summary.difference)).toBe(0);
  expect(Number(summary.outstanding)).toBe(50000);
  await run('SIGNOFF', { statement: st });
  const tomorrow = new Date(Date.parse(today) + 86400000)
    .toISOString()
    .slice(0, 10);
  expect(
    (await workspace()).cheques.find((x: any) => x.id === clearedCheque).state,
  ).toBe('CLEARED');
  await run('DISHONOUR', { target: clearedCheque }, 'CHQ101-RETURN', tomorrow);
  const second = await run(
    'STATEMENT',
    {
      account: bankAccount,
      from: tomorrow,
      to: tomorrow,
      opening: String(end),
      closing: String(end - 50000 + 1000),
      csv:
        'date,reference,amount\n' +
        tomorrow +
        ',NMB-TRANSFER,-50000\n' +
        tomorrow +
        ',CHQ101-RETURN,1000',
    },
    undefined,
    tomorrow,
  );
  await run('AUTO_MATCH', { statement: second }, undefined, tomorrow);
  const cleared = await call(
    checker,
    'cash-bank/statements/' + second + '?' + f.query,
  );
  expect(Number(cleared.outstanding)).toBe(0);
  expect(Number(cleared.difference)).toBe(0);
  expect(Number(cleared.unmatched)).toBe(0);
  await run('SIGNOFF', { statement: second }, undefined, tomorrow);
  expect(
    Number(
      (await call(checker, 'cash-bank/statements/' + st + '?' + f.query))
        .outstanding,
    ),
  ).toBe(50000);
  const overlap = await post(maker, 'cash-bank', {
    input: input('STATEMENT', {
      account: bankAccount,
      from: today,
      to: today,
      opening: '0',
      closing: '0',
      csv: 'date,reference,amount',
    }),
  });
  await post(
    checker,
    'cash-bank/' + overlap.id + '/review',
    { decision: 'approve' },
    409,
  );
  await post(maker, 'cash-bank/' + overlap.id + '/cancel');
  await run('PLAN', {
    account: other,
    amount: '380000000',
    direction: 'INFLOW',
    due: tomorrow,
    description: 'Projected funds',
  });
  await run('PLAN', {
    account: wallet,
    amount: '310000000',
    direction: 'OUTFLOW',
    due: tomorrow,
    description: 'Planned disbursement',
  });
  const forecast = await call(
    checker,
    'cash-bank/forecast?' + f.query + '&from=' + tomorrow + '&to=' + tomorrow,
  );
  const own = forecast.items.filter((x: any) => x.source === 'Treasury plan');
  expect(own.reduce((n: number, x: any) => n + Number(x.amount), 0)).toBe(
    70000000,
  );
  expect(Number(forecast.totals[0].closing)).toBeCloseTo(
    Number(forecast.totals[0].opening) + Number(forecast.totals[0].net),
  );
  const nextMonth = new Date(Date.parse(tomorrow));
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthly = (
    await call(
      checker,
      'cash-bank/forecast?' +
        f.query +
        '&from=' +
        tomorrow +
        '&to=' +
        nextMonth.toISOString().slice(0, 10),
    )
  ).periods.filter((x: any) => x.currency === 'TZS');
  expect(monthly.length).toBeGreaterThan(1);
  expect(monthly[1].opening).toBe(monthly[0].closing);
  expect(
    (
      await f.db.query(
        'SELECT count(*)::int n FROM finance_cb_entries e JOIN finance_cb_accounts a ON a.id=e.account_id WHERE a.book_id=$1 AND e.journal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_foundation_lines l WHERE l.journal_id=e.journal_id AND l.line_key=e.line_key)',
        [f.bookId],
      )
    )[0].n,
  ).toBe(0);
}
