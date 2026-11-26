import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { canonicalFinanceJson } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import type { MeasurementDelivery } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ifrs-premiums';
import type { exerciseGeneralLedger } from './finance-general-ledger-workflow';
type Fixture = Pick<
  Parameters<typeof exerciseGeneralLedger>[0],
  | 'call'
  | 'post'
  | 'maker'
  | 'checker'
  | 'deputy'
  | 'company'
  | 'scope'
  | 'document'
  | 'contextPin'
  | 'today'
  | 'feeInput'
  | 'query'
  | 'db'
  | 'paymentInput'
  | 'receiptInput'
> & { issue: { finance_dimensions: Record<string, string> } };

export async function exerciseInsurerPremium(f: Fixture) {
  const { call, post, maker, checker, deputy, company, scope, contextPin, db } =
    f;
  const premiumInvoice = () =>
    call(maker, 'invoices', {
      ...f.feeInput,
      invoice_type: 'PREMIUM',
      items: [
        {
          item_type: 'PREMIUM',
          item_name: 'Insured cover',
          quantity: 1,
          unit_amount: 100,
          total_amount: 100,
        },
      ],
    });
  const invoice = await premiumInvoice();
  const issue = {
    ...f.issue,
    expected_state_version: invoice.state_version,
    idempotency_key: randomUUID(),
  };
  const [issued, retry] = await Promise.all(
    [1, 2].map(() => call(maker, 'invoices/' + invoice.id + '/issue', issue)),
  );
  expect(issued.accounting_status).toBe('MEMORANDUM_RECORDED');
  expect(retry.premium_memo_id).toBe(issued.premium_memo_id);
  expect(
    await db.query(
      'SELECT 1 FROM finance_operating_postings WHERE source_id=$1',
      [invoice.id],
    ),
  ).toHaveLength(0);
  const [memo] = await call(
    maker,
    'foundation/gl/premium-memos?' + f.query + '&invoice=' + invoice.id,
  );
  const keys = generateKeyPairSync('ed25519'),
    prior = process.env.FINANCE_IFRS17_MEASUREMENT_KEYS;
  const key = {
    issuer: 'MEASUREMENT',
    keyId: 'A',
    bookId: scope.bookId,
    companyId: company,
    validFrom: '2020-01-01',
    validUntil: '2099-01-01',
    publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }),
  };
  process.env.FINANCE_IFRS17_MEASUREMENT_KEYS = JSON.stringify([key]);
  const payload: MeasurementDelivery['payload'] = {
    schema: 'FINANCE_IFRS17_MOVEMENT_V1',
    companyId: company,
    bookId: scope.bookId,
    contextHash: contextPin.contextHash,
    issuer: key.issuer,
    keyId: key.keyId,
    approvedAt: new Date().toISOString(),
    movementId: randomUUID(),
    group: 'PROPERTY-ISSUED',
    run: 'PAA-1',
    component: 'PAA_RELEASE',
    date: f.today,
    currency: 'TZS',
    memoranda: [{ id: memo.id, hash: memo.hash }],
    lines: [
      {
        role: 'LRC',
        debit: '17.50',
        credit: '0',
        dimensions: issue.finance_dimensions,
      },
      {
        role: 'INSURANCE_REVENUE',
        debit: '0',
        credit: '17.50',
        dimensions: issue.finance_dimensions,
      },
    ],
  };
  const signed = (p: typeof payload) => ({
    payload: p,
    signature: sign(
      null,
      Buffer.from(canonicalFinanceJson(p)),
      keys.privateKey,
    ).toString('base64'),
  });
  const send = (input: MeasurementDelivery, status?: number) =>
    post(maker, 'foundation/gl/measurements', { input }, status);
  const approve = async (id: string, hash: string) => {
    const url = 'foundation/operating-postings/' + id + '/approve';
    await post(maker, url, { subjectHash: hash }, 403);
    await post(deputy, url, { subjectHash: hash });
    return (await post(checker, url, { subjectHash: hash })).journalId;
  };
  try {
    await send(
      { ...signed(payload), payload: { ...payload, group: 'Changed' } },
      409,
    );
    await send(
      signed({
        ...payload,
        memoranda: [{ id: memo.id, hash: '0'.repeat(64) }],
      }),
      409,
    );
    const noMovement = signed({
      ...payload,
      run: 'PAA-ZERO',
      movementId: randomUUID(),
      lines: [],
    });
    expect((await send(noMovement)).state).toBe('NO_MOVEMENT');
    const delivery = signed(payload),
      [first, duplicate] = await Promise.all([send(delivery), send(delivery)]);
    expect(first.id).toBe(duplicate.id);
    await approve(first.id, first.hash);
    expect((await send(delivery)).state).toBe('POSTED');
    const moved = await db.query(
      'SELECT l.role_code,l.transaction_debit::float debit,l.transaction_credit::float credit FROM finance_foundation_lines l JOIN finance_foundation_journals j ON j.id=l.journal_id WHERE j.candidate_id=$1 ORDER BY l.line_key',
      [first.id],
    );
    expect(moved).toEqual([
      { role_code: 'LRC', debit: 17.5, credit: 0 },
      { role_code: 'INSURANCE_REVENUE', debit: 0, credit: 17.5 },
    ]);
    expect(
      (await call(checker, 'invoices/' + invoice.id)).accounting_status,
    ).toBe('POSTED');
    const payment = await call(maker, 'payment-transactions/manual', {
      ...f.paymentInput,
      invoice_id: invoice.id,
      payment_reference: 'PREMIUMCOLLECTION',
      idempotency_key: randomUUID(),
    });
    const receiptInput = {
      ...f.receiptInput,
      payment_transaction_id: payment.id,
      invoice_id: invoice.id,
      idempotency_key: randomUUID(),
    };
    const [r1, r2] = await Promise.all(
      [1, 2].map(() => call(maker, 'receipts/post', receiptInput)),
    );
    expect(r1.id).toBe(r2.id);
    const pending = (
      await call(checker, 'foundation/operating-postings?' + f.query)
    ).find((r) => r.candidateId === r1.journal_candidate_id);
    expect(pending.lines.map((l: { role: string }) => l.role)).toEqual([
      'CASH',
      'LRC',
    ]);
    await approve(pending.candidateId, pending.hash);
    expect(
      (await call(maker, 'receipts/post', receiptInput)).accounting_status,
    ).toBe('POSTED');
    const cancelled = await premiumInvoice();
    const issuedBeforeVoid = await call(
      maker,
      'invoices/' + cancelled.id + '/issue',
      {
        ...issue,
        expected_state_version: cancelled.state_version,
        idempotency_key: randomUUID(),
      },
    );
    const lookup =
      'foundation/gl/premium-memos?' + f.query + '&invoice=' + cancelled.id;
    const [oldMemo] = await call(maker, lookup);
    expect(oldMemo.id).toBe(issuedBeforeVoid.premium_memo_id);
    const oldPin = {
      ...payload,
      run: 'PAA-CANCEL',
      movementId: randomUUID(),
      memoranda: [{ id: oldMemo.id, hash: oldMemo.hash }],
    };
    const beforeVoid = await send(signed(oldPin));
    await call(maker, 'invoices/' + cancelled.id + '/void', {
      reason: 'Policy cancelled before collection',
      idempotency_key: randomUUID(),
    });
    const vote = 'foundation/operating-postings/' + beforeVoid.id + '/approve';
    await post(deputy, vote, { subjectHash: beforeVoid.hash });
    await post(checker, vote, { subjectHash: beforeVoid.hash }, 409);
    await send(signed({ ...oldPin, movementId: randomUUID() }), 409);
    const voidMemo = (await call(maker, lookup)).find(
      (m) => m.event === 'VOIDED',
    );
    expect(
      (
        await send(
          signed({
            ...payload,
            run: 'PAA-CANCEL-FINAL',
            movementId: randomUUID(),
            lines: [],
            memoranda: [{ id: voidMemo.id, hash: voidMemo.hash }],
          }),
        )
      ).state,
    ).toBe('NO_MOVEMENT');
    const note = await post(maker, 'customer-accounts', {
      input: {
        kind: 'DEBIT_NOTE',
        reference: 'Insurer premium correction',
        requestKey: randomUUID(),
        date: f.today,
        currency: 'TZS',
        amount: '10.00',
        tax: '0',
        invoiceId: invoice.id,
        customerId: f.feeInput.customer_id,
        evidence: f.document,
      },
    });
    await post(checker, 'customer-accounts/' + note.id + '/approve', {
      reason: 'Confirmed premium correction',
    });
    const recorded = await post(
      maker,
      'customer-accounts/' + note.id + '/post',
    );
    expect(recorded).toMatchObject({ state: 'POSTED', journal_id: null });
    const memoList = await call(
      checker,
      'foundation/gl/premium-memos?' + f.query + '&invoice=' + invoice.id,
    );
    const correction = memoList.find((x: { id: string }) => x.id === note.id);
    expect(correction.event).toBe('DEBIT_NOTE');
    const corrected = {
      ...payload,
      approvedAt: new Date().toISOString(),
      movementId: randomUUID(),
      run: 'PAA-REASSESS',
      memoranda: [{ id: correction.id, hash: correction.hash }],
    };
    const adjust = await send(signed(corrected));
    await approve(adjust.id, adjust.hash);
    expect((await send(signed(corrected))).state).toBe('POSTED');
    expect(
      (
        await db.query(
          'SELECT memo_id FROM finance_ar_measurement_memos WHERE measurement_id=$1',
          [corrected.movementId],
        )
      )[0].memo_id,
    ).toBe(note.id);
  } finally {
    if (prior === undefined) delete process.env.FINANCE_IFRS17_MEASUREMENT_KEYS;
    else process.env.FINANCE_IFRS17_MEASUREMENT_KEYS = prior;
  }
}
