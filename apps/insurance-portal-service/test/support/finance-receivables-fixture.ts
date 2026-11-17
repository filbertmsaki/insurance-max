import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createBillingFixture } from './finance-quotation-billing-fixture';
import { requireLease } from './finance-integration-fixture';
import { refreshSourceEnvelope } from './finance-event-fixture';
import { withFinanceTestDatabase } from './finance-test-database';
import { FinanceReceivableControls1797000000000 } from '../../src/database/migrations/1797000000000-FinanceReceivableControls';
import { FinanceReceivablesService } from '../../src/modules/tenant/billing-commission/foundation/finance-receivables.service';
import {
  RECEIVABLE_EVENT,
  type ReceiptEvidence,
  type TermsEvidence,
} from '../../src/modules/tenant/billing-commission/foundation/finance-receivables.types';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import { financeChartSourceMapHash } from '../../src/modules/tenant/billing-commission/foundation/finance-chart.snapshot';
export async function withReceivableDatabase<T>(
  run: (f: Awaited<ReturnType<typeof createReceivableFixture>>) => Promise<T>,
) {
  return withFinanceTestDatabase(
    async ({ dataSource }) => {
      const q = dataSource.createQueryRunner();
      try {
        await new FinanceReceivableControls1797000000000().up(q);
      } finally {
        await q.release();
      }
      return run(await createReceivableFixture(dataSource));
    },
    process.env,
    'quotation-billing',
  );
}
export async function createReceivableFixture(source: DataSource) {
  const f = await createBillingFixture(source),
    service = new FinanceReceivablesService(source),
    accountId = randomUUID(),
    profiles = [] as Awaited<ReturnType<typeof f.review>>[];
  const grant = async (
    p = f.maker,
    permission = 'PREPARE_ASSIGNMENT',
    i = 0,
  ) => {
    const [r] = await source.query(
      "INSERT INTO finance_receivable_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-ONLY','2020-01-01') RETURNING *",
      [
        f.tenantId,
        f.entity.id,
        f.books[i].id,
        p.subjectId,
        p.naturalPersonId,
        permission,
      ],
    );
    return r;
  };
  for (const [i] of f.books.entries()) {
    const contract = await f.review(i, {
      kind: 'EVENT_CONTRACTS',
      key: 'SYNTHETIC-RECEIVABLE-EVIDENCE',
      payload: {
        schema: 'FINANCE_EVENT_CONTRACT_V1',
        purpose: 'SOURCE_FACT_REFERENCE',
        eventType: RECEIVABLE_EVENT,
        schemaVersion: '1.0.0',
        producerId: 'SYNTHETIC_PORTAL',
        sourceSystem: 'SYNTHETIC_PORTAL',
        aggregateType: 'RECEIVABLE_EVIDENCE',
        factKind: 'RECEIVABLE_EVIDENCE',
        codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
      },
    });
    await f.review(i, {
      kind: 'EVENT_ROUTES',
      key: 'SYNTHETIC-RECEIVABLE-ROUTE',
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
    profiles.push(
      await f.review(i, {
        kind: 'RECEIVABLE_CONTROLS',
        key: 'SYNTHETIC-RECEIVABLE-PROFILE',
        dependencyRefs: ['DEC-01', 'DEC-02', 'DEC-05', 'DEC-12', 'DEC-14'],
        payload: {
          schema: 'FINANCE_RECEIVABLE_CONTROLS_V1',
          purpose: 'INACTIVE_CONTROLS_ONLY',
          recognition: 'HELD_INACTIVE',
          cashAccounts: [
            {
              sourceAccountId: accountId,
              sourceCompanyId: f.companyId,
              currency: 'USD',
              decimalScale: 2,
            },
          ],
          ageingBands: [30, 60, 90],
        },
      }),
    );
    for (const p of [f.maker, f.checker])
      for (const perm of [
        'OBSERVE_RECEIPT',
        'PREPARE_ASSIGNMENT',
        'REVIEW_ASSIGNMENT',
        'RECONCILE_RECEIPT',
        'READ_RECEIVABLES',
      ])
        await grant(p, perm, i);
  }
  const profile = (i = 0) => ({
    profileId: profiles[i].id,
    profileHash: profiles[i].release_hash,
  });
  const receipt = (): ReceiptEvidence => ({
    schema: 'FINANCE_RECEIVABLE_EVIDENCE_V1',
    kind: 'CONFIRMED_RECEIPT',
    id: randomUUID(),
    sourceRevision: 1,
    sourceCompanyId: f.companyId,
    sourceAccountId: accountId,
    bankTransactionId: 'SYNTHETIC-' + randomUUID(),
    customerId: randomUUID(),
    currency: 'USD',
    decimalScale: 2,
    received: '118',
    bankSettled: '116',
    bankFee: '2',
    valueDate: '2026-11-15',
    bankEvidenceHash: 'b'.repeat(64),
    legacyAllocated: '0',
    legacyRefunded: '0',
    legacyReserved: '0',
    legacyEvidenceHash: 'c'.repeat(64),
  });
  const postEvidence = async (snapshot: ReceiptEvidence | TermsEvidence) => {
    const e = f.envelope();
    e.event_type = RECEIVABLE_EVENT;
    e.aggregate = {
      type: 'RECEIVABLE_EVIDENCE',
      id: snapshot.id,
      revision: snapshot.sourceRevision,
      previous_revision: null,
    };
    e.source_reference = {
      kind: 'RECEIVABLE_EVIDENCE',
      id: snapshot.id,
      version: snapshot.sourceRevision,
    };
    e.payload = {
      snapshot_id: snapshot.id,
      snapshot_hash: hash(snapshot),
      source_revision: snapshot.sourceRevision,
    };
    refreshSourceEnvelope(e);
    const r = await f.capture(e);
    const done = await f.intake.process(
      f.worker,
      requireLease(await f.intake.claim(f.worker, r.intakeId)),
    );
    if (done.state !== 'DISPOSITION_RECORDED')
      throw new Error('Synthetic evidence must pass actual B10/B11 intake');
    const boxes = await source.query(
      'SELECT b.* FROM finance_integration_inboxes b JOIN finance_integration_intakes i ON i.preview_id=b.preview_id WHERE i.id=$1',
      [r.intakeId],
    );
    return {
      event: e,
      input: (i = 0) => ({
        ...profile(i),
        inboxId: boxes.find((b: any) => b.book_id === f.books[i].id).id,
        snapshot,
      }),
    };
  };
  const observe = async (snap = receipt(), i = 0) => {
    const accepted = await postEvidence(snap),
      observed = await service.observeReceipt(
        f.maker,
        f.scope(i),
        accepted.input(i),
        'synthetic confirmed cash',
      );
    return { snap, accepted, observed };
  };
  const billing = async () => {
    const made = await f.prepare();
    await f.billing.reviewInactive(
      f.checker,
      f.scope(),
      made.memo,
      'REVIEWED_INACTIVE',
      'independent synthetic billing review',
    );
    return made;
  };
  const ready = async () => {
    const bill = await billing(),
      snap = receipt();
    snap.customerId = bill.snapshot.customerId;
    return { ...(await observe(snap)), bill };
  };
  const assign = async (
    c: Awaited<ReturnType<typeof ready>>,
    amount = '50',
    key = randomUUID(),
  ) =>
    service.proposeAssignment(
      f.maker,
      f.scope(),
      {
        ...profile(),
        commandKey: key,
        receiptId: c.observed.receiptId!,
        memoId: c.bill.memo.id,
        memoHash: c.bill.memo.hash,
        amount,
      },
      'synthetic partial assignment',
    );
  const review = (
    ref: { id: string; hash: string },
    decision: 'REVIEWED_INACTIVE' | 'REJECTED_INACTIVE' = 'REVIEWED_INACTIVE',
  ) =>
    service.reviewInactive(
      f.checker,
      f.scope(),
      ref,
      decision,
      'synthetic independent review',
    );
  return {
    ...f,
    source,
    receivables: service,
    billingService: f.billing,
    accountId,
    receivableProfiles: profiles,
    receivableGrant: grant,
    profile,
    receipt,
    postEvidence,
    observe,
    billing,
    ready,
    assign,
    review,
  };
}
