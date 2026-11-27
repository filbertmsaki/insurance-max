import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { fixtureBank } from './finance-bank-observation-fixture';
import { FinancePayablesCutoverAndCredits1799400000000 } from '../../src/database/migrations/1799400000000-FinancePayablesCutoverAndCredits';
import type { Evidence } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-gl-program';
import { plusDays } from '../../src/modules/tenant/finance/payables/trade-payables/trade-payables.types';

type Http = (
  user: string,
  path: string,
  body?: Record<string, any>,
  status?: number,
) => Promise<any>;
export async function exerciseTradePayables(f: {
  openingOnly?: boolean;
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
}) {
  const { call, post, maker, checker, deputy, db, today, document, scope } = f;
  const bank = fixtureBank(db, f.company, scope.bookId);
  const dimensions = {
    BRANCH: f.branch,
    DEPARTMENT: f.department,
    COST_CENTRE: 'HQ',
  };
  const doc = (
    kind: string,
    reference: string,
    details: Record<string, any>,
    party: Record<string, string> = {},
  ) => ({
    kind,
    reference,
    details,
    date: today,
    currency: 'TZS',
    dimensions,
    evidence: document,
    requestKey: randomUUID(),
    ...party,
  });
  const create = (input: ReturnType<typeof doc>, status?: number) =>
    post(
      maker,
      input.kind === 'OPENING_IMPORT' ? 'payables/opening-imports' : 'payables',
      { input },
      status,
    );
  const review = (r: { id: string }, actor = checker, status?: number) =>
    post(
      actor,
      'payables/' + r.id + '/review',
      { decision: 'APPROVE', reason: 'Reviewed source evidence' },
      status,
    );
  const approve = async (input: ReturnType<typeof doc>) =>
    review(await create(input));
  const queue = () =>
    call(checker, 'payables?' + new URLSearchParams(scope).toString());
  const postRecord = (
    r: { id: string },
    body: Record<string, any> = {},
    status?: number,
  ) => post(maker, 'payables/' + r.id + '/post', body, status);
  const ledger = async (r: { candidate_id: string }) => {
    const [c] = await db.query(
      'SELECT subject_hash FROM finance_journal_candidates WHERE id=$1',
      [r.candidate_id],
    );
    const path = 'foundation/operating-postings/' + r.candidate_id + '/approve',
      body = { subjectHash: c.subject_hash };
    await post(deputy, path, body);
    const [first, again] = await Promise.all([
      post(checker, path, body),
      post(checker, path, body),
    ]);
    expect(first.journalId).toBe(again.journalId);
    return first.journalId;
  };
  const sign = (
    r: { id: string },
    kind:
      | 'AP_PAYMENT'
      | 'AP_IMPREST_RETURN'
      | 'AP_REVERSAL'
      | 'AP_SUPPLIER_REFUND' = 'AP_PAYMENT',
  ) => bank.observe(kind, r.id);
  const cash = async (r: { id: string }) => {
    const observation = await sign(r);
    const [one, two] = await Promise.all([
      postRecord(r, { observation }),
      postRecord(r, { observation }),
    ]);
    expect(one.candidate_id).toBe(two.candidate_id);
    return ledger(one);
  };
  try {
    const configuration = await create(
      doc('SETTINGS', 'AP', {
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
          {
            supplierClass: 'STANDARD',
            transactionClass: 'SERVICE',
            vatBps: 1000,
            withholdingBps: 500,
          },
        ],
      }),
    );
    await review(configuration, maker, 403);
    await review(configuration);
    const cat = await approve(
      doc('CATEGORY', 'IT', { name: 'IT Equipment', matchOrder: true }),
    );
    const svc = await approve(
      doc('CATEGORY', 'SERVICES', { name: 'Services' }),
    );
    const master = (
      reference: string,
      name: string,
      categoryId: string,
      extra: Record<string, any> = {},
    ) =>
      doc('SUPPLIER', reference, {
        name,
        categoryId,
        tin: 'TEST-100',
        address: 'Dar es Salaam',
        email: 'ap@example.invalid',
        taxClass: 'STANDARD',
        ...extra,
      });
    const abc = await approve(master('SUP-0001', 'ABC Technology Ltd', cat.id));
    const other = await approve(
      master('SUP-0002', 'Service provider', svc.id, {
        discountDays: 15,
        discountBps: 200,
      }),
    );
    const abcParty = { supplierId: abc.id },
      serviceParty = { supplierId: other.id },
      employee = { employeeId: maker };
    const vendorBank = (reference: string, p: Record<string, string>) =>
      doc(
        'BANK',
        reference,
        {
          bankName: 'Test bank',
          accountName: 'Approved beneficiary',
          accountNumber: '000012345678',
        },
        p,
      );
    const account = await approve(vendorBank('PRIMARY', abcParty)),
      otherBank = await approve(vendorBank('PRIMARY', serviceParty));
    const exerciseCutover = async (bankId: string) => {
      if (!f.openingOnly) {
        const legacy = await post(maker, 'foundation/gl/vouchers', {
          input: {
            reference: 'LEGACY-AP-CONTROL',
            date: today,
            currency: 'TZS',
            description: 'Payables already recorded in the GL at cutover',
            evidence: document,
            lines: [
              { role: 'COMPUTERS', debit: '6000', credit: '0', dimensions },
              { role: 'TRADE_AP', debit: '0', credit: '6000', dimensions },
            ],
          },
        });
        await ledger({ candidate_id: legacy.id });
      }
      const count = async () =>
        Number(
          (
            await db.query(
              "SELECT count(*) n FROM finance_foundation_journals WHERE book_id=$1 AND mode='LIVE'",
              [scope.bookId],
            )
          )[0].n,
        );
      const before = await count();
      const reportAt = (party: string, currency = 'TZS', date = today) =>
        call(
          checker,
          'payables/reports?' +
            new URLSearchParams({
              ...scope,
              party,
              currency,
              from: date,
              to: date,
            }).toString(),
        );
      const balance = async () =>
        (await reportAt('')).controls.find(
          (x: { account: string }) => x.account === '211001',
        );
      const previous = await balance();
      expect(Number(previous.difference)).toBe(6000);
      const line = {
        supplierCode: abc.reference,
        reference: 'LEGACY-TZS',
        invoiceDate: plusDays(today, -75),
        dueDate: plusDays(today, -45),
        currency: 'TZS',
        amount: '3000',
      };
      const foreign = {
        ...line,
        supplierCode: other.reference,
        reference: 'LEGACY-USD',
        currency: 'USD',
        amount: '1',
        functionalAmount: '3500',
      };
      const input = doc('OPENING_IMPORT', 'CUTOVER-01', {
        description: 'Reviewed supplier breakdown at cutover',
        controlRole: 'TRADE_AP',
        lines: [
          line,
          foreign,
          {
            ...line,
            documentType: 'CREDIT',
            reference: 'LEGACY-CREDIT',
            amount: '500',
          },
        ],
      });
      await create(
        { ...input, details: { ...input.details, lines: [line] } },
        409,
      );
      await create(
        {
          ...input,
          details: {
            ...input.details,
            lines: [line, { ...line, reference: 'legacy-tzs' }],
          },
        },
        400,
      );
      const submitted = await create(input);
      await review(submitted, maker, 403);
      expect(
        (await queue()).records.some(
          (r: { reference: string }) => r.reference === 'LEGACY-TZS',
        ),
      ).toBe(false);
      const [first, again] = await Promise.all([
        review(submitted),
        review(submitted),
      ]);
      expect(first.id).toBe(again.id);
      expect(await count()).toBe(before);
      const cancelOpening = (id: string, status?: number) =>
        post(
          checker,
          'payables/' + id + '/void-opening',
          { reason: 'Correct opening source file', evidence: document },
          status,
        );
      await cancelOpening(first.id);
      expect(Number((await balance()).difference)).toBe(6000);
      const corrected = await approve({ ...input, requestKey: randomUUID() });
      await create(
        { ...input, reference: 'DUPLICATE-CUTOVER', requestKey: randomUUID() },
        409,
      );
      const after = await balance();
      expect(Number(after.generalLedger)).toBe(Number(previous.generalLedger));
      expect(Number(after.difference)).toBe(0);
      expect(await count()).toBe(before);
      const imported = (await queue()).records.filter(
        (r: any) => r.data.details.openingImportId === corrected.id,
      );
      expect(imported).toHaveLength(3);
      const openingCredit = imported.find(
        (r: any) => r.reference === 'LEGACY-CREDIT',
      );
      expect(Number((await queue()).availableCredits[openingCredit.id])).toBe(
        500,
      );
      const tzs = imported.find((r: any) => r.reference === line.reference);
      expect(tzs).toMatchObject({
        status: 'POSTED',
        doc_date: line.invoiceDate,
        due_date: line.dueDate,
        journal_id: null,
        candidate_id: null,
      });
      expect(
        (await reportAt('S:' + abc.id)).aging.find((x: any) => x.id === tzs.id)
          .bucket,
      ).toBe('31-60');
      expect(
        (await reportAt('S:' + other.id, 'USD')).aging.find(
          (x: any) => x.reference === foreign.reference,
        ).balance,
      ).toMatch(/^1(?:\.0+)?$/);
      if (f.openingOnly) {
        const beforeCutover = await reportAt(
          'S:' + abc.id,
          'TZS',
          plusDays(today, -1),
        );
        expect(beforeCutover.aging.some((x: any) => x.id === tzs.id)).toBe(
          false,
        );
      } else {
        // The newly activated broker's certificate starts today.
        const prior = plusDays(today, -1);
        await call(
          checker,
          'payables/reports?' +
            new URLSearchParams({
              ...scope,
              party: 'S:' + abc.id,
              currency: 'TZS',
              from: prior,
              to: prior,
            }).toString(),
          undefined,
          409,
        );
      }
      await postRecord(tzs, {}, 409);
      await create(
        doc(
          'BILL',
          'legacy-tzs',
          { description: 'Duplicate source invoice' },
          abcParty,
        ),
        409,
      );
      const pay = await approve(
        doc(
          'PAYMENT',
          'PAY-IMPORTED',
          {
            description: 'Pay imported invoice',
            bankId,
            bankRole: 'CASH',
            allocations: [{ itemId: tzs.id, amount: '1000' }],
          },
          abcParty,
        ),
      );
      await cash(pay);
      expect(
        Number(
          (await reportAt('S:' + abc.id)).aging.find(
            (x: any) => x.id === tzs.id,
          ).balance,
        ),
      ).toBe(2000);
      expect(Number((await balance()).difference)).toBe(0);
      await cancelOpening(corrected.id, 409);
      await expect(
        db.transaction((m) =>
          new FinancePayablesCutoverAndCredits1799400000000().down(
            m.queryRunner!,
          ),
        ),
      ).rejects.toThrow(
        'Preserve existing supplier credits and opening allocations',
      );
      const adjustment = (kind: string, ref: string, price: string) =>
        doc(
          kind,
          ref,
          {
            description: 'Supplier adjustment to imported invoice',
            itemId: tzs.id,
            lines: [
              {
                item: 'MIGRATED',
                description: 'Equipment adjustment',
                quantity: '1',
                unitPrice: price,
                role: 'COMPUTERS',
                transactionClass: 'EQUIPMENT',
              },
            ],
          },
          abcParty,
        );
      const extra = await approve(adjustment('DEBIT', 'SUP-DEBIT-500', '500'));
      await ledger(await postRecord(extra));
      const reversal = await create(
        doc(
          'REVERSAL',
          'SUP-DEBIT-CORRECTION',
          {
            description: 'Withdraw the additional supplier charge',
            originalId: extra.id,
          },
          abcParty,
        ),
      );
      const excess = await create(
        adjustment('CREDIT', 'SUP-CREDIT-3500', '3500'),
        409,
      );
      expect(excess.error.message).toContain('available debit notes');
      await review(reversal);
      await ledger(await postRecord(reversal));
      expect(Number((await balance()).difference)).toBe(0);
      const mixed = await approve(
        doc(
          'CREDIT',
          'PARTIALLY-PAID-CN',
          {
            description: 'Return on a partly paid opening invoice',
            itemId: tzs.id,
            lines: [
              {
                item: 'MIGRATED',
                description: 'Equipment credit',
                quantity: '1',
                unitPrice: '2500',
                role: 'COMPUTERS',
                transactionClass: 'EQUIPMENT',
              },
            ],
          },
          abcParty,
        ),
      );
      expect(Number(mixed.data.details.appliedToInvoice)).toBe(2000);
      expect(Number(mixed.data.details.availableCredit)).toBe(500);
      await ledger(await postRecord(mixed));
      expect(Number((await balance()).difference)).toBe(0);
      const reverse = await approve(
        doc(
          'REVERSAL',
          'REVERSE-MIXED-CN',
          { description: 'Correct credit reference', originalId: mixed.id },
          abcParty,
        ),
      );
      await ledger(await postRecord(reverse));
      const useOpeningCredit = await approve(
        doc(
          'CREDIT_APPLICATION',
          'APPLY-OPENING-CREDIT',
          {
            description: 'Apply imported credit',
            creditId: openingCredit.id,
            allocations: [{ itemId: tzs.id, amount: '500' }],
          },
          abcParty,
        ),
      );
      await ledger(await postRecord(useOpeningCredit));
      expect(
        Number(
          (await reportAt('S:' + abc.id)).aging.find(
            (x: any) => x.id === tzs.id,
          ).balance,
        ),
      ).toBe(1500);
      expect(Number((await balance()).difference)).toBe(0);
    };
    if (f.openingOnly) {
      await exerciseCutover(account.id);
      return;
    }
    expect(account.data.details.accountNumber).toBeUndefined();
    expect(account.data.details.accountEnding).toBe('5678');
    expect(
      (await post(checker, 'payables/' + account.id + '/bank-review'))
        .accountNumber,
    ).toBe('000012345678');
    const laptop = {
      item: 'LAPTOP',
      description: 'Computer equipment',
      quantity: '10',
      unitPrice: '1200000',
      role: 'COMPUTERS',
      transactionClass: 'EQUIPMENT',
    };
    const order = await approve(
      doc(
        'ORDER',
        'PO-10',
        { description: 'Ten laptops', lines: [laptop] },
        abcParty,
      ),
    );
    const billInput = doc(
      'BILL',
      'ABC-INV-2026-001',
      {
        description: 'Purchase of 10 laptops',
        orderId: order.id,
        lines: [laptop],
      },
      abcParty,
    );
    await create(billInput, 409);
    const voidDelivery = await approve(
      doc(
        'RECEIPT',
        'GRN-CORRECT',
        {
          description: 'Incorrect delivery',
          orderId: order.id,
          lines: [{ item: 'LAPTOP', quantity: '1' }],
        },
        abcParty,
      ),
    );
    await post(checker, 'payables/' + voidDelivery.id + '/void-purchase', {
      evidence: document,
      reason: 'Warehouse corrected the delivery',
    });
    const delivery = await approve(
      doc(
        'RECEIPT',
        'GRN-10',
        {
          description: 'IT accepted laptops',
          orderId: order.id,
          lines: [{ item: 'LAPTOP', quantity: '10' }],
        },
        abcParty,
      ),
    );
    const [bill, retry] = await Promise.all([
      create(billInput),
      create(billInput),
    ]);
    expect(bill.id).toBe(retry.id);
    await post(
      checker,
      'payables/' + delivery.id + '/void-purchase',
      { evidence: document, reason: 'Referenced by a reserved invoice' },
      409,
    );
    expect(bill.due_date).toBe(plusDays(today, 30));
    await create(
      { ...billInput, requestKey: randomUUID(), reference: 'abc-inv-2026-001' },
      409,
    );
    await postRecord(bill, {}, 409);
    await review(bill);
    const registered = await postRecord(bill);
    await expect(
      db.query('UPDATE finance_ap_records SET amount=1 WHERE id=$1', [bill.id]),
    ).rejects.toThrow('immutable');
    const report = (party: string, asOf = today) =>
      call(
        checker,
        'payables/reports?' +
          new URLSearchParams({
            ...scope,
            party,
            currency: 'TZS',
            from: asOf,
            to: asOf,
          }).toString(),
      );
    const abcBalance = async () =>
      Number((await report('S:' + abc.id)).closing);
    expect(await abcBalance()).toBe(0);
    const journal = await ledger(registered);
    expect(await abcBalance()).toBe(12000000);
    expect(
      await db.query(
        'SELECT account_code,transaction_debit::float debit,transaction_credit::float credit FROM finance_foundation_lines WHERE journal_id=$1 ORDER BY account_code',
        [journal],
      ),
    ).toEqual([
      { account_code: '121002', debit: 12000000, credit: 0 },
      { account_code: '211001', debit: 0, credit: 12000000 },
    ]);
    const voucher = (
      ref: string,
      bankId: string,
      itemId: string,
      amount: string,
      p: Record<string, string>,
      extra: Record<string, any> = {},
    ) =>
      doc(
        'PAYMENT',
        ref,
        {
          description: 'Pay approved invoice',
          bankId,
          allocations: [{ itemId, amount }],
          ...extra,
        },
        p,
      );
    const first = await approve(
      voucher('INSTALMENT-1', account.id, bill.id, '5000000', abcParty),
    );
    await postRecord(first, {}, 503);
    await create(
      voucher('OVER', account.id, bill.id, '7000001', abcParty),
      409,
    );
    await cash(first);
    expect(await abcBalance()).toBe(7000000);
    const second = await approve(
      voucher('INSTALMENT-2', account.id, bill.id, '7000000', abcParty),
    );
    await cash(second);
    expect(await abcBalance()).toBe(0);
    const closed = await report('S:' + abc.id);
    expect(closed.aging).toHaveLength(0);
    expect(
      closed.controls.find((x: any) => x.account === '211001').difference,
    ).toEqual(expect.stringMatching(/^0(\.0+)?$/));
    const reconciliation = await approve(
      doc(
        'RECONCILIATION',
        'ABC-STMT',
        {
          from: today,
          opening: '0',
          closing: '0',
          lines: [
            { reference: bill.reference, amount: '12000000' },
            { reference: first.reference, amount: '-5000000' },
            { reference: second.reference, amount: '-7000000' },
          ],
        },
        abcParty,
      ),
    );
    expect(reconciliation.data.details.matches).toBe(true);
    const mismatch = await create(
      doc(
        'RECONCILIATION',
        'ABC-DIFF',
        {
          from: today,
          opening: '0',
          closing: '10',
          lines: [{ reference: 'EXTERNAL', amount: '10' }],
        },
        abcParty,
      ),
    );
    expect(mismatch.data.details.matches).toBe(false);
    await review(mismatch, checker, 409);
    const workLine = {
      item: 'WORK',
      description: 'Service',
      quantity: '1',
      unitPrice: '10000',
      role: 'INTERNET',
      transactionClass: 'SERVICE',
    };
    const service = await approve(
      doc(
        'BILL',
        'SERV-1',
        { description: 'Professional service', lines: [workLine] },
        serviceParty,
      ),
    );
    await ledger(await postRecord(service));
    for (const [kind, ref] of [
      ['CREDIT', 'SUP-CN'],
      ['DEBIT', 'SUP-DN'],
    ]) {
      const adjusted = await approve(
        doc(
          kind,
          ref,
          {
            description: 'Supplier adjustment',
            itemId: service.id,
            lines: [{ ...workLine, unitPrice: '1000' }],
          },
          serviceParty,
        ),
      );
      await ledger(await postRecord(adjusted));
    }
    const advance = await approve(
      doc(
        'ADVANCE',
        'ADV-1',
        {
          description: 'Supplier advance',
          bankId: otherBank.id,
          amount: '2100',
        },
        serviceParty,
      ),
    );
    await cash(advance);
    const applied = await approve(
      doc(
        'APPLICATION',
        'APPLY-1',
        {
          description: 'Allocate advance',
          advanceId: advance.id,
          allocations: [{ itemId: service.id, amount: '2200' }],
        },
        serviceParty,
      ),
    );
    await ledger(await postRecord(applied));
    const eligible = await call(
      maker,
      'payables/schedule?' +
        new URLSearchParams({
          ...scope,
          payOn: today,
          discounts: 'true',
        }).toString(),
    );
    expect(eligible.find((r: any) => r.id === service.id)).toMatchObject({
      reference: 'SERV-1',
    });
    const plan = {
      payOn: today,
      takeDiscount: true,
      selections: [
        { itemId: service.id, bankId: otherBank.id, requestKey: randomUUID() },
      ],
    };
    const scheduled = await post(maker, 'payables/schedule', plan);
    expect((await post(maker, 'payables/schedule', plan))[0].id).toBe(
      scheduled[0].id,
    );
    const discount = await review(scheduled[0]);
    expect(Number(discount.amount)).toBe(8232);
    expect(discount.data.details.allocations[0]).toMatchObject({
      itemId: service.id,
    });
    const empBank = await approve(vendorBank('STAFF', employee));
    await db.query('UPDATE documents SET created_by=$1 WHERE id=$2', [
      maker,
      document.documentId,
    ]);
    const my = await call(maker, 'payables/my-expenses');
    expect(my.records.every((x: any) => x.party === 'E:' + maker)).toBe(true);
    const staffLine = {
      item: 'FARE',
      description: 'Work travel',
      quantity: '1',
      unitPrice: '200',
      role: 'INTERNET',
    };
    const personal = await call(maker, 'payables/my-expenses', {
      input: doc('EXPENSE', 'STAFF-DRAFT', {
        description: 'Withdrawn expense',
        lines: [staffLine],
      }),
    });
    await call(
      checker,
      'payables/my-expenses/' + personal.id + '/withdraw',
      { reason: 'Other employee' },
      403,
    );
    await call(maker, 'payables/my-expenses/' + personal.id + '/withdraw', {
      reason: 'Duplicate receipt',
    });
    const claim = await call(maker, 'payables/my-expenses', {
      input: doc('EXPENSE', 'STAFF-EXP', {
        description: 'Travel reimbursement',
        lines: [staffLine],
      }),
    });
    await review(claim);
    await ledger(await postRecord(claim));
    const reimbursement = await approve(
      voucher('REIMBURSE', empBank.id, claim.id, '200', employee),
    );
    const batch = await approve(
      doc('BATCH', 'PAY-RUN', {
        description: 'Supplier and employee payment run',
        payments: [discount.id, reimbursement.id],
      }),
    );
    const instructions = await post(
      maker,
      'payables/' + batch.id + '/instructions',
    );
    expect(instructions).toHaveLength(2);
    await postRecord(discount, {}, 409);
    const obs1 = await sign(discount),
      obs2 = await sign(reimbursement);
    const execute = (observations: Record<string, unknown>) =>
      post(maker, 'payables/' + batch.id + '/execute', { observations });
    const partial = await execute({ [discount.id]: obs1 });
    expect(partial.map((x: any) => x.status)).toEqual(['AWAITING_GL', 'HELD']);
    expect(
      (await execute({ [discount.id]: obs1, [reimbursement.id]: obs2 })).map(
        (x: any) => x.status,
      ),
    ).toEqual(['AWAITING_GL', 'AWAITING_GL']);
    const pending = await queue();
    for (const id of [discount.id, reimbursement.id])
      await ledger(pending.records.find((r: any) => r.id === id));
    const paid = await report('S:' + other.id);
    expect(Number(paid.closing)).toBe(0);
    expect(Number(paid.advanceClosing)).toBe(0);
    const imp = await approve(
      doc(
        'IMPREST',
        'TRAVEL',
        { bankId: empBank.id, amount: '300', description: 'Travel advance' },
        employee,
      ),
    );
    await cash(imp);
    const retired = await approve(
      doc(
        'RETIREMENT',
        'TRAVEL-RETURN',
        {
          itemId: imp.id,
          description: 'Receipts and returned cash',
          lines: [staffLine],
          cashReturned: '100',
        },
        employee,
      ),
    );
    await ledger(
      await postRecord(retired, {
        observation: await sign(retired, 'AP_IMPREST_RETURN'),
      }),
    );
    expect(Number((await report('E:' + maker)).advanceClosing)).toBe(0);
    const secondImprest = await approve(
      doc(
        'IMPREST',
        'TRAVEL-2',
        {
          bankId: empBank.id,
          amount: '100',
          description: 'Second staff advance',
        },
        employee,
      ),
    );
    await cash(secondImprest);
    const excess = await approve(
      doc(
        'RETIREMENT',
        'TRAVEL-EXCESS',
        {
          itemId: secondImprest.id,
          description: 'Approved excess expenses',
          lines: [staffLine],
        },
        employee,
      ),
    );
    await ledger(await postRecord(excess));
    expect(Number((await report('E:' + maker)).closing)).toBe(100);
    const extraPayment = await approve(
      voucher('STAFF-EXCESS', empBank.id, excess.id, '100', employee),
    );
    await cash(extraPayment);
    const reversed = await approve(
      doc(
        'REVERSAL',
        'RETURN-2',
        { originalId: second.id, description: 'Bank returned instalment' },
        abcParty,
      ),
    );
    await ledger(
      await postRecord(reversed, {
        observation: await sign(reversed, 'AP_REVERSAL'),
      }),
    );
    expect(await abcBalance()).toBe(7000000);
    const final = await report('S:' + abc.id);
    expect(final.aging[0].bucket).toBe('CURRENT');
    expect(
      final.reconciliations.find((r: any) => r.id === reconciliation.id)
        .current,
    ).toBe(false);
    const bankChange = doc(
      'BANK',
      'PRIMARY',
      {
        bankName: 'Other bank',
        accountName: 'ABC Technology',
        accountNumber: '0001234000',
      },
      abcParty,
    );
    const replacement = await create({
      ...bankChange,
      replacesId: account.id,
    } as typeof bankChange);
    await review(replacement, maker, 403);
    await review(replacement);
    await create(
      voucher('OLD-BANK', account.id, bill.id, '100', abcParty),
      409,
    );
    const historical = await report('S:' + abc.id, plusDays(today, 61));
    expect(historical.aging[0].bucket).toBe('31-60');
    const rejectGl = async (r: { id: string }) => {
      const candidate = await postRecord(r);
      const [c] = await db.query(
        'SELECT subject_hash FROM finance_journal_candidates WHERE id=$1',
        [candidate.candidate_id],
      );
      await post(
        checker,
        'foundation/operating-postings/' + candidate.candidate_id + '/reject',
        { subjectHash: c.subject_hash, reason: 'Review supporting evidence' },
      );
      return candidate;
    };
    const reviewBill = await approve(
      doc(
        'BILL',
        'SUP-REVIEW',
        { description: 'Service invoice review', lines: [workLine] },
        serviceParty,
      ),
    );
    const rejected = await rejectGl(reviewBill);
    await post(maker, 'payables/' + reviewBill.id + '/renew', {
      evidence: document,
      reason: 'Additional supporting evidence',
    });
    await ledger(rejected);
    const withdrawn = await approve(
      doc(
        'BILL',
        'SUP-WITHDRAW',
        { description: 'Supplier withdrew the invoice', lines: [workLine] },
        serviceParty,
      ),
    );
    await rejectGl(withdrawn);
    await post(maker, 'payables/' + withdrawn.id + '/cancel', {
      reason: 'Supplier withdrew the invoice',
    });
    await post(
      maker,
      'payables/' + withdrawn.id + '/renew',
      { evidence: document, reason: 'Withdrawn invoice' },
      409,
    );
    await create(
      doc(
        'REVERSAL',
        'CANNOT-REVERSE-BILL',
        { originalId: bill.id, description: 'Dependent payment remains' },
        abcParty,
      ),
      409,
    );
    expect(
      Number(
        final.controls.find((x: any) => x.account === '211001').difference,
      ),
    ).toBe(0);
    const migration = new FinancePayablesCutoverAndCredits1799400000000();
    await db.transaction(async (manager) => {
      // Rehearse the historical migration without altering constraints owned by later releases.
      await manager.query('SAVEPOINT rehearsal');
      await migration.down(manager.queryRunner!);
      const [old] = await manager.query(
        'SELECT status FROM finance_ap_status WHERE id=$1',
        [bill.id],
      );
      expect(old.status).toBe('POSTED');
      await migration.up(manager.queryRunner!);
      await manager.query('ROLLBACK TO SAVEPOINT rehearsal');
    });
    await cash(
      await approve(
        voucher(
          'FINAL-SETTLEMENT',
          replacement.id,
          bill.id,
          '7000000',
          abcParty,
        ),
      ),
    );
    expect(await abcBalance()).toBe(0);
    const creditInput = doc(
      'CREDIT',
      'RETURN-ONE-LAPTOP',
      {
        description: 'One laptop returned after final settlement',
        itemId: bill.id,
        lines: [{ ...laptop, quantity: '1' }],
      },
      abcParty,
    );
    const credit = await approve(creditInput);
    expect(Number(credit.data.details.availableCredit)).toBe(1200000);
    await create(
      {
        ...creditInput,
        reference: 'EXCESS-CREDIT',
        requestKey: randomUUID(),
        details: { ...creditInput.details, lines: [laptop] },
      },
      409,
    );
    await ledger(await postRecord(credit));
    expect(await abcBalance()).toBe(-1200000);
    expect(
      (await report('S:' + abc.id)).aging.find((r: any) => r.id === credit.id)
        .bucket,
    ).toBe('CREDIT');
    const part = { ...laptop, quantity: '1', unitPrice: '400000' };
    const newOrder = await approve(
      doc(
        'ORDER',
        'PO-PART',
        { description: 'Replacement equipment', lines: [part] },
        abcParty,
      ),
    );
    await approve(
      doc(
        'RECEIPT',
        'GR-PART',
        {
          description: 'Replacement delivered',
          orderId: newOrder.id,
          lines: [{ item: part.item, quantity: '1' }],
        },
        abcParty,
      ),
    );
    const partBill = await approve(
      doc(
        'BILL',
        'BILL-PART',
        {
          description: 'Replacement equipment',
          orderId: newOrder.id,
          lines: [part],
        },
        abcParty,
      ),
    );
    await ledger(await postRecord(partBill));
    const apply = doc(
      'CREDIT_APPLICATION',
      'APPLY-RETURN',
      {
        creditId: credit.id,
        description: 'Settle replacement invoice',
        allocations: [{ itemId: partBill.id, amount: '400000' }],
      },
      abcParty,
    );
    const allocated = await approve(apply);
    expect(Number((await queue()).availableCredits[credit.id])).toBe(800000);
    const refundInput = doc(
      'SUPPLIER_REFUND',
      'SUP-REFUND',
      {
        description: 'Receive supplier refund',
        creditId: credit.id,
        bankRole: 'CASH',
        amount: '800000',
      },
      abcParty,
    );
    await create(
      { ...refundInput, details: { ...refundInput.details, amount: '800001' } },
      409,
    );
    await create({ ...refundInput, ...serviceParty }, 409);
    await ledger(await postRecord(allocated));
    const refund = await approve(refundInput);
    await postRecord(refund, {}, 503);
    await postRecord(
      refund,
      { observation: await sign(refund, 'AP_PAYMENT') },
      503,
    );
    // A supplier can return funds before Finance approves the record of the receipt.
    const [bankDay] = await db.query(
      "SELECT doc_date::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam' settled FROM finance_ap_records WHERE id=$1",
      [refund.id],
    );
    const incoming = await bank.observe(
      'AP_SUPPLIER_REFUND',
      refund.id,
      bankDay.settled,
    );
    const [receipt, retryRefund] = await Promise.all([
      postRecord(refund, { observation: incoming }),
      postRecord(refund, { observation: incoming }),
    ]);
    expect(receipt.candidate_id).toBe(retryRefund.candidate_id);
    const refundJournal = await ledger(receipt);
    expect((await queue()).availableCredits[credit.id]).toBeUndefined();
    const refundLines = await db.query(
      'SELECT account_code,transaction_debit::float debit,transaction_credit::float credit FROM finance_foundation_lines WHERE journal_id=$1 ORDER BY account_code',
      [refundJournal],
    );
    expect(refundLines).toEqual([
      { account_code: '1100', debit: 800000, credit: 0 },
      { account_code: '211001', debit: 0, credit: 800000 },
    ]);
    expect(await abcBalance()).toBe(0);
    expect(
      Number(
        (await report('S:' + abc.id)).controls.find(
          (r: any) => r.account === '211001',
        ).difference,
      ),
    ).toBe(0);
    await create(
      doc(
        'REVERSAL',
        'CANNOT-REVERSE-USED-CREDIT',
        { description: 'Credit has settlements', originalId: credit.id },
        abcParty,
      ),
      409,
    );
    const undone = await approve(
      doc(
        'REVERSAL',
        'REVERSE-REFUND',
        { description: 'Returned bank receipt', originalId: refund.id },
        abcParty,
      ),
    );
    await ledger(
      await postRecord(undone, {
        observation: await sign(undone, 'AP_REVERSAL'),
      }),
    );
    expect(await abcBalance()).toBe(-800000);
    const received = await approve({
      ...refundInput,
      reference: 'CONFIRMED-REFUND',
      requestKey: randomUUID(),
    });
    await ledger(
      await postRecord(received, {
        observation: await sign(received, 'AP_SUPPLIER_REFUND'),
      }),
    );
    const newSettings = {
      ...doc('SETTINGS', 'AP', {
        ...configuration.data.details,
        bankRole: 'CRDB',
      }),
      replacesId: configuration.id,
    };
    await approve(newSettings);
    const exact = await approve(
      doc(
        'IMPREST',
        'EXACT-IMPREST',
        {
          description: 'Expense equals imprest',
          amount: '200',
          bankRole: 'CASH',
          bankId: empBank.id,
        },
        employee,
      ),
    );
    await cash(exact);
    const retire = doc(
      'RETIREMENT',
      'EXACT-RETIREMENT',
      {
        description: 'All cash accounted for',
        cashReturned: '0',
        itemId: exact.id,
        lines: [staffLine],
      },
      employee,
    );
    await create(
      {
        ...retire,
        details: { ...retire.details, lines: [], cashReturned: '200' },
      },
      400,
    );
    const noCash = await approve(retire);
    expect(noCash.data.bankAccount).toBeUndefined();
    expect(noCash.data.lines.map((l: any) => l.role)).not.toContain('CRDB');
    await ledger(await postRecord(noCash));
    expect(Number((await report('E:' + maker)).advanceClosing)).toBe(0);
    await exerciseCutover(replacement.id);
  } finally {
    bank.restore();
  }
}
