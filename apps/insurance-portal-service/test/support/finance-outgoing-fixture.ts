import { randomUUID } from 'node:crypto';
import { withReceivableDatabase } from './finance-receivables-fixture';
import { requireLease } from './finance-integration-fixture';
import { refreshSourceEnvelope } from './finance-event-fixture';
import { FinanceOutgoingCashControls1797500000000 } from '../../src/database/migrations/1797500000000-FinanceOutgoingCashControls';
import { FinanceOutgoingService } from '../../src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service';
import {
  OUTGOING_EVENT,
  type FundingEvidence,
  type ObligationEvidence,
  type OutgoingEvidence,
  type BankPaymentEvidence,
  type CashProviderRequest,
  type CashProviderOutcome,
  type CashSimulationAdapter,
} from '../../src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.types';
import {
  financeConfigurationHash as hash,
  type FinanceConfigurationInput,
} from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import { financeChartSourceMapHash } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/finance-chart.snapshot';

export class CashTestSimulator implements CashSimulationAdapter {
  readonly purpose = 'ISOLATED_TEST_SIMULATOR_ONLY' as const;
  readonly providerCode = 'SYNTHETIC_CASH';
  readonly ledger: { operation: string; request: CashProviderRequest }[] = [];
  outcome: 'CONFIRMED' | 'PENDING' | 'FAILED_FINAL' | 'NOT_FOUND' = 'CONFIRMED';
  timeout = false;
  fee = '1';
  amount: string | null = null;
  beneficiaryHash: string | null = null;
  beforeReturn: (() => Promise<void>) | null = null;
  private truth = new Map<string, CashProviderOutcome>();
  private response(r: CashProviderRequest): CashProviderOutcome {
    return {
      executionKey: r.executionKey,
      providerCode: r.providerCode,
      providerAccountReference: r.providerAccountReference,
      beneficiaryHash: this.beneficiaryHash ?? r.beneficiaryHash,
      currency: r.currency,
      amount: this.outcome === 'CONFIRMED' ? (this.amount ?? r.amount) : '0',
      fee: this.outcome === 'CONFIRMED' ? this.fee : '0',
      state: this.outcome,
      providerPaymentId:
        this.outcome === 'CONFIRMED'
          ? 'SYNTHETIC-' + hash(r.executionKey).slice(0, 20)
          : null,
      evidenceHash: hash({ request: r, state: this.outcome }),
    };
  }
  async submit(request: CashProviderRequest) {
    this.ledger.push({ operation: 'SUBMIT', request });
    const outcome = this.response(request);
    this.truth.set(request.executionKey, outcome);
    if (this.beforeReturn) await this.beforeReturn();
    if (this.timeout)
      throw Error('Synthetic lost response after provider committed');
    return outcome;
  }
  async query(request: CashProviderRequest) {
    this.ledger.push({ operation: 'QUERY', request });
    if (this.beforeReturn) await this.beforeReturn();
    return this.truth.get(request.executionKey) ?? this.response(request);
  }
}
export async function withOutgoingDatabase<T>(
  run: (f: Awaited<ReturnType<typeof outgoingFixture>>) => Promise<T>,
) {
  return withReceivableDatabase(async (f) => {
    const q = f.source.createQueryRunner();
    try {
      await new FinanceOutgoingCashControls1797500000000().up(q);
    } finally {
      await q.release();
    }
    return run(await outgoingFixture(f));
  });
}
async function outgoingFixture(
  f: Parameters<Parameters<typeof withReceivableDatabase>[0]>[0],
) {
  const source = f.source,
    provider = new CashTestSimulator(),
    outgoing = new FinanceOutgoingService(source, [provider]);
  const reviewConfig = async (
    i: number,
    input: Partial<FinanceConfigurationInput> &
      Pick<FinanceConfigurationInput, 'kind' | 'key'>,
  ) => {
    const draft = await f.config.createDraft(
      f.maker,
      f.scope(i),
      {
        version: 1,
        effectiveFrom: '2026-01-01',
        dependencyRefs: ['DEC-12', 'DEC-14'],
        ...input,
      },
      'synthetic outgoing definition',
    );
    await f.config.submit(
      f.maker,
      f.scope(i),
      draft.id,
      draft.release_hash,
      'synthetic outgoing submission',
    );
    return f.config.reviewInactive(
      f.checker,
      f.scope(i),
      draft.id,
      draft.release_hash,
      'REVIEWED_INACTIVE',
      'independent outgoing configuration review',
    );
  };
  for (const [i] of f.books.entries()) {
    const contract = await reviewConfig(i, {
      kind: 'EVENT_CONTRACTS',
      key: 'SYNTHETIC-OUTGOING',
      payload: {
        schema: 'FINANCE_EVENT_CONTRACT_V1',
        purpose: 'SOURCE_FACT_REFERENCE',
        eventType: OUTGOING_EVENT,
        schemaVersion: '1.0.0',
        producerId: 'SYNTHETIC_PORTAL',
        sourceSystem: 'SYNTHETIC_PORTAL',
        aggregateType: 'OUTGOING_EVIDENCE',
        factKind: 'OUTGOING_EVIDENCE',
        codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
      },
    });
    await reviewConfig(i, {
      kind: 'EVENT_ROUTES',
      key: 'SYNTHETIC-OUTGOING-ROUTE',
      payload: {
        schema: 'FINANCE_EVENT_ROUTE_V1',
        contractId: contract.id,
        contractHash: contract.release_hash,
        sourceAssociationId: f.routes[i].association.id,
        sourceAssociationHash: f.routes[i].association.release_hash,
        sourceMapId: f.map.id,
        sourceMapHash: financeChartSourceMapHash(f.map),
      },
    });
  }
  const grant = async (
    p = f.maker,
    permission = 'PREPARE_PAYMENT',
    book = 0,
    currency = 'USD',
    limit = '1000',
  ) => {
    const [row] = await source.query(
      "INSERT INTO finance_outgoing_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,currency,max_amount,lease_seconds,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,60,'ENABLED','SYNTHETIC-ONLY',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '2 hours') RETURNING *",
      [
        f.tenantId,
        f.entity.id,
        f.books[book].id,
        p.subjectId,
        p.naturalPersonId,
        permission,
        currency,
        limit,
      ],
    );
    return row;
  };
  for (const [i] of f.books.entries())
    for (const p of [f.maker, f.checker])
      for (const permission of [
        'OBSERVE_CASH',
        'PREPARE_PAYMENT',
        'REVIEW_PAYMENT',
        'RESERVE_CASH',
        'EXECUTE_SIMULATION',
        'RECONCILE_CASH',
        'READ_CASH',
      ])
        await grant(p, permission, i);
  const base = () => ({
    schema: 'FINANCE_OUTGOING_EVIDENCE_V1' as const,
    id: randomUUID(),
    sourceRevision: 1 as const,
    sourceCompanyId: f.companyId,
    sourceAccountId: f.accountId,
    currency: 'USD',
    decimalScale: 2,
  });
  const funding = (): FundingEvidence => ({
    ...base(),
    kind: 'FUNDING',
    providerCode: provider.providerCode,
    providerAccountReference: 'SYNTHETIC-ACCOUNT',
    clearedBalance: '130',
    legacyReserved: '10',
    legacyCommitted: '10',
    unavailable: '10',
    available: '100',
    asOf: '2026-11-16',
    sourceEvidenceHash: 'a'.repeat(64),
  });
  const obligation = (): ObligationEvidence => ({
    ...base(),
    kind: 'OBLIGATION',
    obligationId: randomUUID(),
    amount: '100',
    beneficiary: {
      mode: 'REFERENCED',
      sourceSystem: 'SYNTHETIC_PORTAL',
      referenceId: randomUUID(),
      version: '1',
      evidenceHash: 'b'.repeat(64),
      naturalPersonIds: [randomUUID()],
    },
    entitlementEvidenceHash: 'c'.repeat(64),
  });
  const post = async (snapshot: OutgoingEvidence, book = 0) => {
    const e = f.envelope();
    e.event_type = OUTGOING_EVENT;
    e.aggregate = {
      type: 'OUTGOING_EVIDENCE',
      id: snapshot.id,
      revision: 1,
      previous_revision: null,
    };
    e.source_reference = {
      kind: 'OUTGOING_EVIDENCE',
      id: snapshot.id,
      version: 1,
    };
    e.payload = {
      snapshot_id: snapshot.id,
      snapshot_hash: hash(snapshot),
      source_revision: 1,
    };
    refreshSourceEnvelope(e);
    const r = await f.capture(e);
    const processed = await f.intake.process(
      f.worker,
      requireLease(await f.intake.claim(f.worker, r.intakeId)),
    );
    if (processed.state !== 'DISPOSITION_RECORDED')
      throw Error('Outgoing source evidence must pass actual B11 intake');
    const boxes = await source.query(
      'SELECT b.* FROM finance_integration_inboxes b JOIN finance_integration_intakes i ON i.preview_id=b.preview_id WHERE i.id=$1',
      [r.intakeId],
    );
    return {
      ...f.profile(book),
      inboxId: boxes.find((b: any) => b.book_id === f.books[book].id).id,
      snapshot,
    };
  };
  const observe = async (snapshot: OutgoingEvidence, book = 0) =>
    outgoing.observeEvidence(
      f.maker,
      f.scope(book),
      await post(snapshot, book),
      'synthetic controlled outgoing evidence',
    );
  const prepared = async (amount = '50', fee = '2') => {
    const fundingSnapshot = funding(),
      obligationSnapshot = obligation(),
      fund = await observe(fundingSnapshot),
      owed = await observe(obligationSnapshot);
    const plan = {
      commandKey: randomUUID(),
      fundingId: fund.id,
      fundingHash: fund.hash,
      obligationId: owed.id,
      obligationHash: owed.hash,
      amount,
      maximumFee: fee,
      beneficiaryHash: hash(obligationSnapshot.beneficiary),
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    };
    const intent = await outgoing.prepare(
      f.maker,
      f.scope(),
      plan,
      'synthetic payment preparation',
    );
    return { fundingSnapshot, obligationSnapshot, fund, owed, plan, intent };
  };
  const approve = async (c: Awaited<ReturnType<typeof prepared>>) =>
    outgoing.review(
      f.checker,
      f.scope(),
      c.intent,
      'APPROVE',
      randomUUID(),
      'independent synthetic payment approval',
    );
  const reserve = async (c: Awaited<ReturnType<typeof prepared>>) =>
    outgoing.reserve(
      f.maker,
      f.scope(),
      c.intent,
      randomUUID(),
      'synthetic cash reservation',
    );
  const ready = async (amount = '50', fee = '2') => {
    const c = await prepared(amount, fee);
    await approve(c);
    await reserve(c);
    return c;
  };
  const bank = async (c: Awaited<ReturnType<typeof prepared>>, fee = '1') => {
    const position = await outgoing.read(f.checker, f.scope(), c.intent),
      snapshot: BankPaymentEvidence = {
        ...base(),
        kind: 'BANK_PAYMENT',
        executionKey: position.executionKey,
        providerCode: provider.providerCode,
        providerAccountReference: 'SYNTHETIC-ACCOUNT',
        providerPaymentId:
          'SYNTHETIC-' + hash(position.executionKey).slice(0, 20),
        beneficiaryHash: c.plan.beneficiaryHash,
        amount: c.plan.amount,
        fee,
        valueDate: '2026-11-16',
        bankEvidenceHash: 'd'.repeat(64),
      };
    return observe(snapshot);
  };
  return {
    ...f,
    outgoing,
    provider,
    cashGrant: grant,
    funding,
    obligation,
    postCash: post,
    observeCash: observe,
    prepared,
    approveCash: approve,
    reserveCash: reserve,
    readyCash: ready,
    bankEvidence: bank,
  };
}
