import { fixtureBank } from './finance-bank-observation-fixture';
import { exerciseNativeJournals } from './finance-native-journal-workflow';
import type { DataSource } from 'typeorm';
import type { ReinsuranceRecoveryService } from '../../src/modules/tenant/reinsurance/services/reinsurance-recovery.service';
import type { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import { randomUUID } from 'node:crypto';

export async function exerciseGeneralLedger(f: {
  post: (
    user: string,
    path: string,
    body?: Record<string, unknown>,
    status?: number,
  ) => Promise<any>;
  call: (
    user: string,
    path: string,
    body?: any,
    status?: number,
  ) => Promise<any>;
  query: string;
  maker: string;
  checker: string;
  deputy: string;
  today: string;
  until: string;
  document: { id: string; hash: string; documentId: string };
  branches: { id: string }[];
  contextPin: { contextId: string; contextHash: string };
  scope: { bookId: string; legalEntityId: string };
  db: DataSource;
  journal: FinanceJournalService;
  cededRecoveries: ReinsuranceRecoveryService;
  company: string;
  feeInput: Record<string, unknown>;
  paymentInput: Record<string, unknown>;
  receiptInput: Record<string, unknown>;
  invoiceId: string;
  receiptId: string;
  openingId: string;
  openingHash: string;
}) {
  const {
    post,
    call,
    query,
    maker,
    checker,
    deputy,
    today,
    until,
    branches,
    document,
  } = f;
  const path = 'foundation/gl',
    dims = { BRANCH: branches[0].id, COST_CENTRE: 'HQ' };
  const readiness = (await call(checker, path + '?' + query)).readiness;
  expect(readiness.blockers).toEqual([]);
  const rollout = {
    action: 'ENABLE',
    releaseId: readiness.releaseId,
    previousSequence: null,
    evidence: document,
    excludedSources: Object.fromEntries(
      readiness.missingNative.map((k: string) => [
        k,
        'Outside this acceptance company’s approved products.',
      ]),
    ),
  };
  await post(maker, path + '/deployments', { input: rollout }, 403);
  await post(checker, path + '/deployments', { input: rollout });
  const approve = async (c: { id: string; hash: string }) => {
    const url = 'foundation/operating-postings/' + c.id + '/approve',
      body = { subjectHash: c.hash };
    await post(maker, url, body, 403);
    expect((await post(deputy, url, body)).remainingApprovals).toBe(1);
    const result = await Promise.all([
      post(checker, url, body),
      post(checker, url, body),
    ]);
    expect(result[0].journalId).toBe(result[1].journalId);
    return result[0].journalId;
  };
  const input = {
    reference: 'JV-2026-000001',
    date: today,
    currency: 'TZS',
    description: 'Office internet paid through CRDB Bank',
    evidence: document,
    lines: [
      { role: 'INTERNET', debit: '500000', credit: '0', dimensions: dims },
      { role: 'CRDB', debit: '0', credit: '500000', dimensions: dims },
    ],
  };
  await post(
    maker,
    path + '/vouchers',
    { input: { ...input, evidence: { ...document, id: randomUUID() } } },
    409,
  );
  await post(
    maker,
    path + '/vouchers',
    {
      input: {
        ...input,
        lines: [
          { ...input.lines[0], dimensions: { BRANCH: dims.BRANCH } },
          input.lines[1],
        ],
      },
    },
    400,
  );
  await post(
    maker,
    path + '/vouchers',
    {
      input: {
        ...input,
        lines: [{ ...input.lines[0], credit: '5' }, input.lines[1]],
      },
    },
    400,
  );
  const firstDraft = await post(maker, path + '/drafts', {
    input: { ...input, description: 'Draft office internet payment' },
  });
  await post(checker, path + '/drafts', { input, ...firstDraft }, 403);
  const draft = await post(maker, path + '/drafts', { input, ...firstDraft });
  expect(draft).toEqual({
    id: firstDraft.id,
    revision: firstDraft.revision + 1,
  });
  await post(maker, path + '/drafts', { input, ...firstDraft }, 409);
  const [c, replay] = await Promise.all([
    post(maker, path + '/vouchers', { input, draft }),
    post(maker, path + '/vouchers', { input, draft }),
  ]);
  expect(c.id).toBe(replay.id);
  await post(
    maker,
    path + '/vouchers',
    { input: { ...input, description: 'Changed external reference content' } },
    409,
  );
  const journal = await approve(c);
  const reversal = {
    reference: 'COR-1',
    date: today,
    description: 'Correct the supplier invoice',
    evidence: document,
  };
  const rev = await post(maker, path + '/journals/' + journal + '/reverse', {
    input: reversal,
  });
  await approve(rev);
  expect(
    (
      await post(maker, path + '/journals/' + journal + '/reverse', {
        input: reversal,
      })
    ).id,
  ).toBe(rev.id);
  await approve(
    await post(maker, path + '/vouchers', {
      input: { ...input, reference: 'JV-REPLACEMENT', replacementOf: journal },
    }),
  );
  const program = async (
    code: string,
    kind: string,
    overrides: Record<string, unknown>,
  ) => {
    const definition = {
      start: today,
      end: until,
      currency: 'TZS',
      description: 'Ledger acceptance ' + code,
      dimensions: dims,
      evidence: document,
      ...overrides,
    };
    const p = await post(maker, path + '/programs', {
      input: { code, kind, definition },
    });
    await post(
      maker,
      path + '/programs/' + p.id + '/decisions',
      { action: 'APPROVE', subjectHash: p.subject_hash },
      403,
    );
    await post(checker, path + '/programs/' + p.id + '/decisions', {
      action: 'APPROVE',
      subjectHash: p.subject_hash,
    });
    return p;
  };
  const run = async (p: any, stage: string, ref?: string) => {
    const url = path + '/programs/' + p.id + '/occurrences',
      body = {
        input: {
          subjectHash: p.subject_hash,
          stage,
          date: today,
          ...(ref ? { reference: ref } : {}),
        },
      };
    const c = await post(maker, url, body);
    expect((await post(maker, url, body)).id).toBe(c.id);
    return approve(c);
  };
  const template = await program('NET', 'TEMPLATE', { lines: input.lines });
  await run(template, 'USE', 'TEMPLATE-USE-1');
  const recurring = await program('MONTH', 'RECURRING', {
    templateId: template.id,
    templateHash: template.subject_hash,
    firstDue: today,
    count: 1,
  });
  await run(recurring, 'GENERATE');
  await post(checker, path + '/programs/' + recurring.id + '/decisions', {
    action: 'PAUSE',
    subjectHash: recurring.subject_hash,
  });
  await post(
    maker,
    path + '/programs/' + recurring.id + '/occurrences',
    {
      input: {
        stage: 'GENERATE',
        date: today,
        subjectHash: recurring.subject_hash,
      },
    },
    409,
  );
  const accrual = await program('RENT', 'ACCRUAL', {
    amount: '99.99',
    debitRole: 'INTERNET',
    creditRole: 'ACCRUED',
    releaseRole: 'CRDB',
  });
  await run(accrual, 'INITIAL');
  await run(accrual, 'SETTLE');
  const prepaid = await program('PREPAY', 'PREPAYMENT', {
    amount: '61.39',
    debitRole: 'PREPAID',
    creditRole: 'CRDB',
    releaseRole: 'INTERNET',
    firstDue: today,
    count: 1,
  });
  await run(prepaid, 'INITIAL');
  await run(prepaid, 'AMORTIZE');
  const transfer = await program('TRANSFER', 'INTERBRANCH', {
    amount: '45.11',
    debitRole: 'CRDB',
    creditRole: 'CRDB',
    clearingRole: 'CLEARING',
    targetBranch: branches[1].id,
  });
  await run(transfer, 'TRANSFER');
  const allocation = await program('COST', 'ALLOCATION', {
    amount: '8.19',
    debitRole: 'INTERNET',
    clearingRole: 'CLEARING',
    targets: [{ branch: branches[1].id, weight: 1000000 }],
  });
  await run(allocation, 'ALLOCATE');
  const rate = async (version: number, quoted: string) => {
    const r = await post(maker, 'foundation/exchange-rates', {
      version,
      input: {
        ...f.contextPin,
        transactionCurrency: 'USD',
        rate: quoted,
        rateDate: today,
        validTo: until,
        source: 'BANK',
        sourceReference: 'Reviewed bank closing rate ' + version,
        evidenceHash: document.hash,
      },
    });
    await post(checker, 'foundation/documents/' + r.id + '/reviews', {
      subjectHash: r.subjectHash,
      evidenceHash: document.hash,
      decision: 'REVIEWED',
    });
  };
  await rate(1, '2500');
  const foreign = await post(maker, path + '/vouchers', {
    input: {
      ...input,
      reference: 'USD-POSITION',
      currency: 'USD',
      lines: [
        { role: 'CRDB', debit: '10', credit: '0', dimensions: dims },
        { role: 'FEES', debit: '0', credit: '10', dimensions: dims },
      ],
    },
  });
  await approve(foreign);
  await rate(2, '2600');
  const fx = await program('FX-CLOSE', 'REVALUATION', {
    currency: 'USD',
    owner: 'FINANCE_IAS21',
    monetaryRole: 'CRDB',
    gainRole: 'FEES',
    lossRole: 'INTERNET',
    openingForeign: '0',
    openingFunctional: '0',
  });
  await run(fx, 'REVALUE');
  const receipt = await call(maker, 'receipts/' + f.receiptId + '/reverse', {
    idempotency_key: randomUUID(),
    reason: 'Returned customer receipt',
  });
  expect(receipt.id).toBe(f.receiptId);
  const reversalQueue = await call(
    checker,
    'foundation/operating-postings?' + query,
  );
  const native = reversalQueue.find(
    (r: any) => r.snapshot.originalSourceType === 'RECEIPT',
  );
  expect(native).toBeDefined();
  await approve({ id: native.candidateId, hash: native.hash });
  const writeInput = {
    reference: 'WO-TEST-1',
    amount: '20',
    date: today,
    reason: 'Independently evidenced receivable impairment',
    dimensions: dims,
    evidence: document,
  };
  const wo = await post(
    maker,
    path + '/invoices/' + f.invoiceId + '/write-offs',
    { input: writeInput },
  );
  expect(
    (
      await post(maker, path + '/invoices/' + f.invoiceId + '/write-offs', {
        input: writeInput,
      })
    ).id,
  ).toBe(wo.id);
  expect(
    Number((await call(maker, 'invoices/' + f.invoiceId)).written_off_amount),
  ).toBe(0);
  await approve(wo);
  expect(
    Number((await call(maker, 'invoices/' + f.invoiceId)).written_off_amount),
  ).toBe(20);
  const wstate = await call(maker, path + '?' + query);
  const woDoc = wstate.journals.find((j: any) => j.id === wo.id).snapshot
    .sourceId;
  await approve(
    await post(maker, path + '/write-offs/' + woDoc + '/reverse', {}),
  );
  expect(
    Number((await call(maker, 'invoices/' + f.invoiceId)).written_off_amount),
  ).toBe(0);
  const bank = fixtureBank(f.db, f.company, f.scope.bookId);
  try {
    const collection = await call(maker, 'payment-transactions/manual', {
      ...f.paymentInput,
      payment_reference: 'SECOND-COLLECTION',
      idempotency_key: 'second-payment',
    });
    const newReceipt = await call(maker, 'receipts/post', {
      ...f.receiptInput,
      payment_transaction_id: collection.id,
      idempotency_key: 'second-receipt',
      finance_dimensions: dims,
    });
    let q = await call(checker, 'foundation/operating-postings?' + query);
    const rc = q.find((r: any) => r.snapshot.sourceId === newReceipt.id);
    await approve({ id: rc.candidateId, hash: rc.hash });
    const refund = await call(maker, 'refunds', {
      receipt_id: newReceipt.id,
      invoice_id: f.invoiceId,
      amount: '10',
      reason: 'Return collection overcharge',
      idempotency_key: 'refund-request',
    });
    await call(checker, 'refunds/' + refund.id + '/approve', {
      idempotency_key: 'refund-approve',
    });
    const observation = await bank.observe('REFUND', refund.id);
    await call(
      maker,
      'refunds/' + refund.id + '/pay',
      {
        idempotency_key: 'refund-pay',
        settlement_observation: {
          ...observation,
          reference: 'different-transaction',
        },
      },
      503,
    );
    await call(maker, 'refunds/' + refund.id + '/pay', {
      idempotency_key: 'refund-pay',
      settlement_observation: observation,
    });
    q = await call(checker, 'foundation/operating-postings?' + query);
    const rf = q.find((r: any) => r.snapshot.sourceId === refund.id);
    const decision = 'foundation/operating-postings/' + rf.candidateId;
    await post(checker, decision + '/reject', { subjectHash: rf.hash });
    await post(maker, decision + '/renew', {
      subjectHash: rf.hash,
      evidence: document,
    });
    const renewed = (
      await call(checker, 'foundation/operating-postings?' + query)
    ).find((r: any) => r.candidateId === rf.candidateId);
    expect(renewed.decisions).toBe(0);
    expect(renewed.supplement.evidence.id).toBe(document.id);
    await approve({ id: rf.candidateId, hash: rf.hash });
    await exerciseNativeJournals({
      ...f,
      invoice: f.invoiceId,
      branch: branches[0].id,
      approve,
      bank,
    });
  } finally {
    bank.restore();
  }
  const unmatched = await post(maker, path + '/programs', {
    input: {
      kind: 'RECONCILIATION',
      code: 'UNMATCHED',
      definition: {
        start: today,
        end: today,
        description: 'Review the external statement variance',
        dimensions: dims,
        currency: 'TZS',
        evidence: document,
        account: '213001',
        statementBalance: '0',
        exceptions: [],
      },
    },
  });
  await post(
    checker,
    path + '/programs/' + unmatched.id + '/decisions',
    { action: 'APPROVE', subjectHash: unmatched.subject_hash },
    409,
  );
  const check = await program('CHECK', 'RECONCILIATION', {
    end: today,
    account: '213001',
    // In this acceptance book the TZS 12.50 outgoing reinsurance settlement debits this control account.
    statementBalance: '12.50',
    exceptions: [],
  });
  const state = await call(checker, path + '?' + query);
  expect(
    state.reconciliations.find((r: any) => r.id === check.id).current,
  ).toBe(true);
  expect(state.registers.every((r: any) => Number(r.remaining) === 0)).toBe(
    true,
  );
  expect(
    state.journals.filter((j: any) => j.snapshot.reference === input.reference),
  ).toHaveLength(1);
  const tb = await call(
    checker,
    'foundation/trial-balance?' +
      query +
      '&' +
      new URLSearchParams({
        mode: 'LIVE',
        openingId: f.openingId,
        openingHash: f.openingHash,
        from: today,
        to: until,
      }),
  );
  expect(tb.totalDebit).toBe(tb.totalCredit);
  const adjustment = await post(maker, path + '/vouchers', {
    input: {
      ...input,
      reference: 'LATE-ACCRUAL',
      description: 'Accrued operating cost received after reconciliation',
      lines: [
        { role: 'INTERNET', debit: '1', credit: '0', dimensions: dims },
        { role: 'ACCRUED', debit: '0', credit: '1', dimensions: dims },
      ],
    },
  });
  await approve(adjustment);
  const refreshed = await call(checker, path + '?' + query);
  expect(
    refreshed.reconciliations.find((r: any) => r.id === check.id),
  ).toMatchObject({ current: false, difference: '-1.00' });
  const activation = state.readiness.deployment;
  const paused = await post(checker, path + '/deployments', {
    input: {
      ...rollout,
      previousSequence: activation.sequence,
      action: 'PAUSE',
    },
  });
  await post(
    maker,
    path + '/vouchers',
    { input: { ...input, reference: 'PAUSED-REQUEST' } },
    409,
  );
  const nextInvoice = await call(maker, 'invoices', f.feeInput);
  const issuePath = 'invoices/' + nextInvoice.id + '/issue';
  const issueInput = {
    expected_state_version: nextInvoice.state_version,
    idempotency_key: 'invoice-after-rollout-pause',
    finance_dimensions: dims,
  };
  await call(maker, issuePath, issueInput, 409);
  expect((await call(maker, 'invoices/' + nextInvoice.id)).status).toBe(
    'DRAFT',
  );
  await post(checker, path + '/deployments', {
    input: { ...rollout, previousSequence: paused.sequence },
  });
  const resumedInvoice = await call(maker, issuePath, issueInput);
  const queue = await call(checker, 'foundation/operating-postings?' + query);
  const resumed = queue.find(
    (c: any) => c.candidateId === resumedInvoice.journal_candidate_id,
  );
  await approve({ id: resumed.candidateId, hash: resumed.hash });
  expect(
    (await call(checker, path + '?' + query)).journals.filter(
      (j: any) => j.snapshot.reference === input.reference,
    ),
  ).toHaveLength(1);
}
