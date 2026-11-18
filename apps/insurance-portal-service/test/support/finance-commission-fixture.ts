import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { withPolicyChangeDatabase } from './finance-policy-change-fixture';
import { requireLease } from './finance-integration-fixture';
import { refreshSourceEnvelope } from './finance-event-fixture';
import { FinanceCommissionControls1797700000000 } from '../../src/database/migrations/1797700000000-FinanceCommissionControls';
import { FinanceCommissionControlHardening1797800000000 } from '../../src/database/migrations/1797800000000-FinanceCommissionControlHardening';
import { FinanceCommissionService } from '../../src/modules/tenant/billing-commission/foundation/finance-commission.service';
import {
  COMMISSION_EVENT,
  type CommissionEvidence,
} from '../../src/modules/tenant/billing-commission/foundation/finance-commission.types';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import { financeChartSourceMapHash } from '../../src/modules/tenant/billing-commission/foundation/finance-chart.snapshot';
export async function withCommissionDatabase<T>(
  run: (f: Awaited<ReturnType<typeof fixture>>) => Promise<T>,
) {
  return withPolicyChangeDatabase(async (f) => {
    const q = f.source.createQueryRunner();
    try {
      await new FinanceCommissionControls1797700000000().up(q);
      await new FinanceCommissionControlHardening1797800000000().up(q);
    } finally {
      await q.release();
    }
    return run(await fixture(f));
  });
}
async function fixture(
  f: Parameters<Parameters<typeof withPolicyChangeDatabase>[0]>[0],
) {
  const service = new FinanceCommissionService(f.source);
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
    const contract = await review('EVENT_CONTRACTS', 'SYNTHETIC-COMMISSION', {
      schema: 'FINANCE_EVENT_CONTRACT_V1',
      purpose: 'SOURCE_FACT_REFERENCE',
      eventType: COMMISSION_EVENT,
      schemaVersion: '1.0.0',
      producerId: 'SYNTHETIC_PORTAL',
      sourceSystem: 'SYNTHETIC_PORTAL',
      aggregateType: 'COMMISSION',
      factKind: 'COMMISSION',
      codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
    });
    await review('EVENT_ROUTES', 'SYNTHETIC-COMMISSION-ROUTE', {
      schema: 'FINANCE_EVENT_ROUTE_V1',
      contractId: contract.id,
      contractHash: contract.release_hash,
      sourceAssociationId: f.routes[i].association.id,
      sourceAssociationHash: f.routes[i].association.release_hash,
      sourceMapId: f.map.id,
      sourceMapHash: financeChartSourceMapHash(f.map),
    });
  }
  const grant = async (
    p = f.maker,
    permission = 'OBSERVE_COMMISSION',
    i = 0,
  ) => {
    const [r] = await f.source.query(
      "INSERT INTO finance_commission_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,currency,max_amount,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'USD',1000,'ENABLED','SYNTHETIC-ONLY',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '2 hours') RETURNING *",
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
        'OBSERVE_COMMISSION',
        'REVIEW_COMMISSION',
        'PREPARE_SETTLEMENT',
        'REVIEW_SETTLEMENT',
        'RECONCILE_COMMISSION',
        'READ_COMMISSION',
      ])
        await grant(p, perm, i);
  const post = async (snapshot: CommissionEvidence, i = 0) => {
    const e = f.envelope();
    e.event_type = COMMISSION_EVENT;
    e.aggregate = {
      type: 'COMMISSION',
      id: snapshot.id,
      revision: snapshot.sourceRevision,
      previous_revision:
        snapshot.sourceRevision === 1 ? null : snapshot.sourceRevision - 1,
    };
    e.source_reference = {
      kind: 'COMMISSION',
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
  const observe = async (s: CommissionEvidence, i = 0) => {
    s.calculation = {
      snapshot: {
        ...s.calculation.snapshot,
        [s.effect === 'INITIAL' ? 'commissionAmount' : 'commissionDifference']:
          s.commissionDelta,
      },
      hash: '',
    };
    s.calculation.hash = new ProductDefinitionHashService().hashDefinition(
      s.calculation.snapshot,
    );
    return service.observe(
      f.maker,
      f.scope(i),
      await post(s, i),
      'Synthetic applied policy change',
    );
  };
  const review = (ref: { id: string; hash: string }) =>
    service.review(
      f.checker,
      f.scope(),
      ref,
      'REVIEWED_INACTIVE',
      'Independent synthetic change review',
    );
  const prepared = async (overrides: Partial<CommissionEvidence> = {}) => {
    const c = await f.preparedChange({}, true);
    const calculation = {
      commissionBase: '100',
      commissionRate: '20',
      commissionAmount: '20',
      ruleHash: 'a'.repeat(64),
      rounding: 'SOURCE_ENGINE_FROZEN',
    };
    const beneficiary = f.obligation().beneficiary;
    if (beneficiary.mode !== 'REFERENCED')
      throw Error('Referenced beneficiary required');
    const snapshot: CommissionEvidence = {
      schema: 'FINANCE_COMMISSION_V1',
      id: randomUUID(),
      sourceRevision: 1,
      commissionId: randomUUID(),
      sourceCompanyId: f.companyId,
      partyId: beneficiary.referenceId,
      quotationId: c.snapshot.quotationId,
      policyId: c.snapshot.policyId,
      originalBilling: c.snapshot.originalBilling,
      previous: null,
      policyChange: null,
      effect: 'INITIAL',
      reverses: null,
      effectiveDate: '2026-11-17',
      currency: 'USD',
      decimalScale: 2,
      commissionDelta: '20',
      taxDelta: '0',
      withholdingDelta: '0',
      payableDelta: '20',
      taxEvidenceHash: 'b'.repeat(64),
      calculation: {
        snapshot: calculation,
        hash: new ProductDefinitionHashService().hashDefinition(calculation),
      },
      legacyPaid: '0',
      legacyReserved: '0',
      legacyEvidenceHash: 'c'.repeat(64),
      beneficiary,
      acquisition: {
        classification: 'UNASSESSED',
        evidenceHash: null,
        allocationReference: null,
      },
      ...overrides,
    };
    const movement = await observe(snapshot);
    return { ...c, commissionSnapshot: snapshot, movement };
  };
  const ready = async (overrides: Partial<CommissionEvidence> = {}) => {
    const c = await prepared(overrides);
    await review(c.movement);
    return c;
  };
  const settlement = async (
    c: Awaited<ReturnType<typeof prepared>>,
    amount = '10',
  ) => {
    const plan = {
      commandKey: randomUUID(),
      head: { id: c.movement.id, hash: c.movement.hash },
      amount,
      beneficiary: c.commissionSnapshot.beneficiary,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    };
    const ref = await service.prepareSettlement(
      f.maker,
      f.scope(),
      plan,
      'Synthetic commission settlement',
    );
    return { plan, ref };
  };
  const approve = (ref: { id: string; hash: string }) =>
    service.reviewSettlement(
      f.checker,
      f.scope(),
      ref,
      'APPROVE',
      randomUUID(),
      'Independent synthetic commission approval',
    );
  const execution = async (
    ref: { id: string; hash: string },
    amount = '10',
    bind = true,
  ) => {
    const fundingSnapshot = f.funding(),
      fund = await f.observeCash(fundingSnapshot),
      candidate = await service.obligationCandidate(
        f.maker,
        f.scope(),
        ref,
        fund,
        'Synthetic commission candidate',
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
      'Synthetic commission cash',
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
        'Bind synthetic commission cash',
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
  const clawback = async (
    c: Awaited<ReturnType<typeof prepared>>,
    overrides: Partial<CommissionEvidence> = {},
  ): Promise<CommissionEvidence> => {
    if (!c.change) {
      c.change = await f.observeChange(c.snapshot);
      await f.reviewChange(c.change);
    }
    return {
      ...c.commissionSnapshot,
      id: randomUUID(),
      sourceRevision: 1,
      previous: { id: c.movement.id, hash: c.movement.hash },
      policyChange: { id: c.change.id, hash: c.change.hash },
      effect: 'POLICY_CHANGE',
      commissionDelta: '-2',
      payableDelta: '-2',
      ...overrides,
    };
  };
  return {
    ...f,
    commissions: service,
    commissionGrant: grant,
    postCommission: post,
    observeCommission: observe,
    reviewCommission: review,
    preparedCommission: prepared,
    readyCommission: ready,
    commissionSettlement: settlement,
    approveCommission: approve,
    commissionExecution: execution,
    clawback,
  };
}
