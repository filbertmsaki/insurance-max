import { randomUUID } from 'node:crypto';
import { withCommissionDatabase } from './finance-commission-fixture';
import { requireLease } from './finance-integration-fixture';
import { refreshSourceEnvelope } from './finance-event-fixture';
import { FinanceClaimsControls1797900000000 } from '../../src/database/migrations/1797900000000-FinanceClaimsControls';
import { FinanceClaimsService } from '../../src/modules/tenant/finance/payables/claims-controls/finance-claims.service';
import {
  CLAIMS_EVENT,
  sealClaimsSource,
  type ClaimsEvidence,
  type CaseVector,
  type PayableVector,
  type RecoveryVector,
} from '../../src/modules/tenant/finance/payables/claims-controls/finance-claims.types';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import { financeChartSourceMapHash } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/finance-chart.snapshot';
export async function withClaimsDatabase<T>(
  run: (f: Awaited<ReturnType<typeof fixture>>) => Promise<T>,
) {
  return withCommissionDatabase(async (f) => {
    const q = f.source.createQueryRunner();
    try {
      await new FinanceClaimsControls1797900000000().up(q);
    } finally {
      await q.release();
    }
    return run(await fixture(f));
  });
}
async function fixture(
  f: Parameters<Parameters<typeof withCommissionDatabase>[0]>[0],
) {
  const service = new FinanceClaimsService(f.source);
  for (const [i] of f.books.entries()) {
    const review = async (kind: string, key: string, payload: any) => {
      const d = await f.config.createDraft(
        f.maker,
        f.scope(i),
        {
          kind: kind as any,
          key,
          version: 1,
          effectiveFrom: '2026-01-01',
          dependencyRefs: ['DEC-12', 'DEC-14'],
          payload,
        },
        'Synthetic policy change definition',
      );
      await f.config.submit(
        f.maker,
        f.scope(i),
        d.id,
        d.release_hash,
        'Synthetic submission',
      );
      return f.config.reviewInactive(
        f.checker,
        f.scope(i),
        d.id,
        d.release_hash,
        'REVIEWED_INACTIVE',
        'Independent synthetic review',
      );
    };
    const contract = await review('EVENT_CONTRACTS', 'SYNTHETIC-CLAIM', {
      schema: 'FINANCE_EVENT_CONTRACT_V1',
      purpose: 'SOURCE_FACT_REFERENCE',
      eventType: CLAIMS_EVENT,
      schemaVersion: '1.0.0',
      producerId: 'SYNTHETIC_PORTAL',
      sourceSystem: 'SYNTHETIC_PORTAL',
      aggregateType: 'CLAIMS',
      factKind: 'CLAIMS',
      codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
    });
    await review('EVENT_ROUTES', 'SYNTHETIC-CLAIM-ROUTE', {
      schema: 'FINANCE_EVENT_ROUTE_V1',
      contractId: contract.id,
      contractHash: contract.release_hash,
      sourceAssociationId: f.routes[i].association.id,
      sourceAssociationHash: f.routes[i].association.release_hash,
      sourceMapId: f.map.id,
      sourceMapHash: financeChartSourceMapHash(f.map),
    });
  }
  const grant = async (p = f.maker, permission = 'OBSERVE_CLAIM', i = 0) => {
    const [r] = await f.source.query(
      "INSERT INTO finance_claim_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,currency,max_amount,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'USD',1000,'ENABLED','SYNTHETIC-ONLY',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '2 hours') RETURNING *",
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
  for (const [i] of f.books.entries())
    for (const p of [f.maker, f.checker])
      for (const perm of [
        'OBSERVE_CLAIM',
        'REVIEW_CLAIM',
        'PREPARE_SETTLEMENT',
        'REVIEW_SETTLEMENT',
        'RECONCILE_CLAIM',
        'READ_CLAIM',
        'PREPARE_RECOVERY',
        'REVIEW_RECOVERY',
      ])
        await grant(p, perm, i);
  const post = async (snapshot: ClaimsEvidence, i = 0) => {
    const e = f.envelope();
    e.event_type = CLAIMS_EVENT;
    e.aggregate = {
      type: 'CLAIMS',
      id: snapshot.id,
      revision: snapshot.sourceRevision,
      previous_revision:
        snapshot.sourceRevision === 1 ? null : snapshot.sourceRevision - 1,
    };
    e.source_reference = {
      kind: 'CLAIMS',
      id: snapshot.id,
      version: snapshot.sourceRevision,
    };
    e.payload = {
      snapshot_id: snapshot.id,
      snapshot_hash: hash(snapshot),
      source_revision: snapshot.sourceRevision,
    };
    refreshSourceEnvelope(e);
    const captured = await f.capture(e),
      done = await f.intake.process(
        f.worker,
        requireLease(await f.intake.claim(f.worker, captured.intakeId)),
      );
    if (done.state !== 'DISPOSITION_RECORDED')
      throw Error('Policy change must pass B11 intake');
    const boxes = await f.source.query(
      'SELECT b.* FROM finance_integration_inboxes b JOIN finance_integration_intakes i ON i.preview_id=b.preview_id WHERE i.id=$1',
      [captured.intakeId],
    );
    return {
      inboxId: boxes.find((b: any) => b.book_id === f.books[i].id).id,
      snapshot,
    };
  };

  const observe = async (snapshot: ClaimsEvidence, i = 0) =>
    service.observe(
      f.maker,
      f.scope(i),
      await post(snapshot, i),
      'Synthetic claims source evidence',
    );
  const review = (ref: { id: string; hash: string }) =>
    service.review(
      f.checker,
      f.scope(),
      ref,
      'REVIEWED_INACTIVE',
      'Independent synthetic claims review',
    );
  const preparedCase = async (overrides: Partial<CaseVector> = {}) => {
    const cash = await f.ready(),
      claimId = randomUUID(),
      policyId = randomUUID();
    const snapshot = sealClaimsSource(
      {
        schema: 'FINANCE_CLAIMS_V1',
        kind: 'CASE',
        id: claimId,
        sourceRevision: 1,
        sourceCompanyId: f.companyId,
        claimId,
        policyId,
        previous: null,
        caseRef: null,
        effectiveDate: '2026-11-17',
        currency: 'USD',
        decimalScale: 2,
        data: {
          approvedLimit: '100',
          acceptedOffer: '100',
          voucher: { id: randomUUID(), version: 1, hash: 'a'.repeat(64) },
          paidIndemnity: '0',
          paidExpenses: '0',
          legacyReserved: '0',
          caseEstimateIncludingPaid: '100',
          caseOutstanding: '100',
          ibnr: null,
          expenseOutstanding: null,
          riskAdjustment: null,
          discount: null,
          fullLicTarget: null,
          ...overrides,
        },
      },
      { syntheticCase: true },
    );
    const caseControl = await observe(snapshot);
    return { ...cash, caseSnapshot: snapshot, caseControl };
  };
  const readyCase = async (overrides: Partial<CaseVector> = {}) => {
    const c = await preparedCase(overrides);
    await review(c.caseControl);
    return c;
  };
  const payable = async (
    c: Awaited<ReturnType<typeof readyCase>>,
    overrides: Partial<PayableVector> = {},
    approved = true,
  ) => {
    const { source: ignored, ...base } = c.caseSnapshot;
    void ignored;
    const snapshot = sealClaimsSource(
      {
        ...base,
        id: randomUUID(),
        kind: 'PAYABLE',
        previous: null,
        caseRef: { id: c.caseControl.id, hash: c.caseControl.hash },
        data: {
          amount: '80',
          legacyPaid: '0',
          legacyReserved: '0',
          component: 'INDEMNITY',
          sourceApproved: true,
          beneficiary: f.obligation().beneficiary,
          taxEvidenceHash: 'b'.repeat(64),
          writer: 'HANDOFF_RECONCILED',
          writerEvidenceHash: 'c'.repeat(64),
          ...overrides,
        },
      },
      { syntheticApprovedInstruction: true },
    );
    const control = await observe(snapshot);
    if (approved) await review(control);
    return { ...c, payableSnapshot: snapshot, control };
  };
  const next = async (
    snapshot: ClaimsEvidence,
    control: { id: string; hash: string },
    data: Record<string, unknown>,
    approved = true,
  ) => {
    const { source: ignored, ...base } = snapshot;
    void ignored;
    const revised = sealClaimsSource(
      {
        ...base,
        sourceRevision: snapshot.sourceRevision + 1,
        previous: { id: control.id, hash: control.hash },
        data: { ...snapshot.data, ...data },
      },
      { syntheticRevision: true },
    );
    const ref = await observe(revised);
    if (approved) await review(ref);
    return { snapshot: revised, control: ref };
  };
  const settlement = async (
    c: Awaited<ReturnType<typeof payable>>,
    amount = '40',
  ) => {
    const plan = {
      commandKey: randomUUID(),
      head: { id: c.control.id, hash: c.control.hash },
      amount,
      beneficiary: (c.payableSnapshot.data as PayableVector).beneficiary,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    };
    return {
      plan,
      ref: await service.prepareSettlement(
        f.maker,
        f.scope(),
        plan,
        'Synthetic claim settlement',
      ),
    };
  };
  const approve = (ref: { id: string; hash: string }) =>
    service.reviewSettlement(
      f.checker,
      f.scope(),
      ref,
      'APPROVE',
      randomUUID(),
      'Independent claim settlement review',
    );
  const recovery = async (
    c: Awaited<ReturnType<typeof readyCase>>,
    overrides: Partial<RecoveryVector> = {},
    approved = true,
  ) => {
    const { source: ignored, ...base } = c.caseSnapshot;
    void ignored;
    const snapshot = sealClaimsSource(
      {
        ...base,
        id: randomUUID(),
        kind: 'RECOVERY',
        previous: null,
        caseRef: { id: c.caseControl.id, hash: c.caseControl.hash },
        data: {
          type: 'SALVAGE',
          expected: '50',
          legacyReceived: '0',
          debtorId: c.snap.customerId,
          legalStatus: 'ESTABLISHED',
          legalEvidenceHash: 'd'.repeat(64),
          ...overrides,
        },
      },
      { syntheticLegalRight: true },
    );
    const control = await observe(snapshot);
    if (approved) await review(control);
    return { ...c, recoverySnapshot: snapshot, control };
  };
  const receiptRef = async (c: Awaited<ReturnType<typeof readyCase>>) => {
    const [r] = await f.source.query(
      'SELECT subject_hash FROM finance_confirmed_receipts WHERE id=$1',
      [c.observed.receiptId],
    );
    return { id: c.observed.receiptId!, hash: r.subject_hash };
  };
  const allocate = async (
    c: Awaited<ReturnType<typeof recovery>>,
    amount = '20',
  ) => {
    const plan = {
      commandKey: randomUUID(),
      recovery: { id: c.control.id, hash: c.control.hash },
      receipt: await receiptRef(c),
      amount,
    };
    return {
      plan,
      ref: await service.prepareRecoveryReceipt(
        f.maker,
        f.scope(),
        plan,
        'Synthetic recovery allocation',
      ),
    };
  };
  const reviewReceipt = (
    ref: { id: string; hash: string },
    action: 'APPROVE' | 'REJECT' | 'REVERSE' = 'APPROVE',
  ) =>
    service.reviewRecoveryReceipt(
      f.checker,
      f.scope(),
      ref,
      action,
      randomUUID(),
      'Independent synthetic recovery review',
    );
  const execution = async (
    ref: { id: string; hash: string },
    amount = '40',
    bind = true,
  ) => {
    const fundingSnapshot = f.funding(),
      fund = await f.observeCash(fundingSnapshot),
      candidate = await service.obligationCandidate(
        f.maker,
        f.scope(),
        ref,
        fund,
        'Synthetic claim candidate',
      ),
      owed = await f.observeCash(candidate.snapshot);
    const plan = {
      commandKey: randomUUID(),
      fundingId: fund.id,
      fundingHash: fund.hash,
      obligationId: owed.id,
      obligationHash: owed.hash,
      amount,
      maximumFee: '2',
      beneficiaryHash: hash(candidate.snapshot.beneficiary),
      expiresAt: new Date(Date.now() + 1200000).toISOString(),
    };
    const intent = await f.outgoing.prepare(
      f.maker,
      f.scope(),
      plan,
      'Synthetic claim cash',
    );
    await f.outgoing.review(
      f.checker,
      f.scope(),
      intent,
      'APPROVE',
      randomUUID(),
      'Independent cash review',
    );
    if (bind)
      await service.bindExecution(
        f.maker,
        f.scope(),
        ref,
        intent,
        randomUUID(),
        'Bind synthetic claim cash',
      );
    return {
      intent,
      plan,
      fund,
      owed,
      fundingSnapshot,
      obligationSnapshot: candidate.snapshot,
    };
  };

  return {
    ...f,
    claims: service,
    claimGrant: grant,
    postClaim: post,
    observeClaim: observe,
    reviewClaim: review,
    preparedCase,
    readyCase,
    payable,
    nextClaim: next,
    claimSettlement: settlement,
    approveClaim: approve,
    claimExecution: execution,
    recovery,
    receiptRef,
    allocateRecovery: allocate,
    reviewRecovery: reviewReceipt,
  };
}
