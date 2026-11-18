import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { withOutgoingDatabase } from './finance-outgoing-fixture';
import { requireLease } from './finance-integration-fixture';
import { refreshSourceEnvelope } from './finance-event-fixture';
import { FinancePolicyChangeControls1797600000000 } from '../../src/database/migrations/1797600000000-FinancePolicyChangeControls';
import { FinancePolicyChangeService } from '../../src/modules/tenant/finance/governance/accounting-policies/finance-policy-change.service';
import {
  POLICY_CHANGE_EVENT,
  type PolicyChangeEvidence,
} from '../../src/modules/tenant/finance/governance/accounting-policies/finance-policy-change.types';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import { financeChartSourceMapHash } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/finance-chart.snapshot';

export async function withPolicyChangeDatabase<T>(
  run: (f: Awaited<ReturnType<typeof fixture>>) => Promise<T>,
) {
  return withOutgoingDatabase(async (f) => {
    const q = f.source.createQueryRunner();
    try {
      await new FinancePolicyChangeControls1797600000000().up(q);
    } finally {
      await q.release();
    }
    return run(await fixture(f));
  });
}
async function fixture(
  f: Parameters<Parameters<typeof withOutgoingDatabase>[0]>[0],
) {
  const service = new FinancePolicyChangeService(f.source);
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
    const contract = await review(
      'EVENT_CONTRACTS',
      'SYNTHETIC-POLICY-CHANGE',
      {
        schema: 'FINANCE_EVENT_CONTRACT_V1',
        purpose: 'SOURCE_FACT_REFERENCE',
        eventType: POLICY_CHANGE_EVENT,
        schemaVersion: '1.0.0',
        producerId: 'SYNTHETIC_PORTAL',
        sourceSystem: 'SYNTHETIC_PORTAL',
        aggregateType: 'POLICY_CHANGE',
        factKind: 'POLICY_CHANGE',
        codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
      },
    );
    await review('EVENT_ROUTES', 'SYNTHETIC-POLICY-CHANGE-ROUTE', {
      schema: 'FINANCE_EVENT_ROUTE_V1',
      contractId: contract.id,
      contractHash: contract.release_hash,
      sourceAssociationId: f.routes[i].association.id,
      sourceAssociationHash: f.routes[i].association.release_hash,
      sourceMapId: f.map.id,
      sourceMapHash: financeChartSourceMapHash(f.map),
    });
  }
  const grant = async (p = f.maker, permission = 'OBSERVE_CHANGE', i = 0) => {
    const [r] = await f.source.query(
      "INSERT INTO finance_policy_change_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,currency,max_amount,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'USD',1000,'ENABLED','SYNTHETIC-ONLY',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '2 hours') RETURNING *",
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
        'OBSERVE_CHANGE',
        'REVIEW_CHANGE',
        'PREPARE_REFUND',
        'REVIEW_REFUND',
        'RECONCILE_REFUND',
        'READ_CHANGE',
      ])
        await grant(p, perm, i);
  const post = async (snapshot: PolicyChangeEvidence, i = 0) => {
    const e = f.envelope();
    e.event_type = POLICY_CHANGE_EVENT;
    e.aggregate = {
      type: 'POLICY_CHANGE',
      id: snapshot.id,
      revision: snapshot.sourceRevision,
      previous_revision:
        snapshot.sourceRevision === 1 ? null : snapshot.sourceRevision - 1,
    };
    e.source_reference = {
      kind: 'POLICY_CHANGE',
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
  const observe = async (s: PolicyChangeEvidence, i = 0) =>
    service.observe(
      f.maker,
      f.scope(i),
      await post(s, i),
      'Synthetic applied policy change',
    );
  const review = (ref: { id: string; hash: string }) =>
    service.reviewChange(
      f.checker,
      f.scope(),
      ref,
      'REVIEWED_INACTIVE',
      'Independent synthetic change review',
    );
  const prepared = async (overrides: Partial<PolicyChangeEvidence> = {}) => {
    const c = await f.ready(),
      assignment = await f.assign(c, '80');
    await f.review(assignment);
    const pricing = { syntheticPricing: 'Existing source engine result' },
      snapshot: PolicyChangeEvidence = {
        schema: 'FINANCE_POLICY_CHANGE_V1',
        id: randomUUID(),
        sourceRevision: 1,
        workflowRevision: 3,
        sourceCompanyId: f.companyId,
        policyId: randomUUID(),
        quotationId: c.bill.snapshot.quotationId,
        customerId: c.bill.snapshot.customerId,
        kind: 'CANCELLATION',
        stage: 'APPLIED',
        regulatoryStatus: 'ACCEPTED',
        sourceVersion: { id: randomUUID(), number: 1, hash: '1'.repeat(64) },
        targetVersion: { id: randomUUID(), number: 2, hash: '2'.repeat(64) },
        previousChange: null,
        correctionOf: null,
        effect: 'NORMAL',
        effectiveDate: '2026-11-16',
        currency: 'USD',
        decimalScale: 2,
        originalBilling: { id: c.bill.memo.id, hash: c.bill.memo.hash },
        pricing: {
          snapshot: pricing,
          hash: new ProductDefinitionHashService().hashDefinition(pricing),
        },
        additionalPremium: '0',
        returnPremium: '60',
        taxDifference: '-9',
        feeDifference: '-1',
        commissionDifference: '-2',
        taxLines: [
          {
            code: 'SYNTHETIC-TAX',
            kind: 'TAX',
            amount: '-8',
            ruleHash: '3'.repeat(64),
          },
          {
            code: 'SYNTHETIC-LEVY',
            kind: 'LEVY',
            amount: '-1',
            ruleHash: '4'.repeat(64),
          },
        ],
        taxEvidenceHash: '5'.repeat(64),
        invoiceReconciliation: 'MATCHED',
        ...overrides,
      };
    const change = await observe(snapshot);
    return { ...c, assignment, snapshot, change };
  };
  const ready = async (overrides: Partial<PolicyChangeEvidence> = {}) => {
    const c = await prepared(overrides);
    await review(c.change);
    return c;
  };
  const plan = (c: Awaited<ReturnType<typeof prepared>>, amount = '40') => ({
    commandKey: randomUUID(),
    change: { id: c.change.id, hash: c.change.hash },
    assignment: { id: c.assignment.id, hash: c.assignment.hash },
    amount,
    beneficiary: f.obligation().beneficiary,
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  });
  const refund = async (
    c: Awaited<ReturnType<typeof prepared>>,
    amount = '40',
  ) => {
    const p = plan(c, amount),
      r = await service.prepareRefund(
        f.maker,
        f.scope(),
        p,
        'Synthetic refund preparation',
      );
    return { plan: p, refund: r };
  };
  const approve = async (ref: { id: string; hash: string }) =>
    service.reviewRefund(
      f.checker,
      f.scope(),
      ref,
      'APPROVE',
      randomUUID(),
      'Independent synthetic refund approval',
    );
  const execution = async (
    r: { id: string; hash: string },
    amount = '40',
    bind = true,
  ) => {
    const fund = await f.observeCash(f.funding()),
      candidate = await service.obligationCandidate(
        f.maker,
        f.scope(),
        r,
        fund,
        'Synthetic candidate only',
      ),
      owed = await f.observeCash(candidate.snapshot),
      p = {
        commandKey: randomUUID(),
        fundingId: fund.id,
        fundingHash: fund.hash,
        obligationId: owed.id,
        obligationHash: owed.hash,
        amount,
        maximumFee: '2',
        beneficiaryHash: hash(candidate.snapshot.beneficiary),
        expiresAt: new Date(Date.now() + 1200000).toISOString(),
      },
      intent = await f.outgoing.prepare(
        f.maker,
        f.scope(),
        p,
        'Synthetic refund cash preparation',
      );
    await f.outgoing.review(
      f.checker,
      f.scope(),
      intent,
      'APPROVE',
      randomUUID(),
      'Independent synthetic cash approval',
    );
    if (bind)
      await service.bindExecution(
        f.maker,
        f.scope(),
        r,
        intent,
        randomUUID(),
        'Bind synthetic refund execution',
      );
    return { fund, owed, intent, plan: p };
  };
  const next = (
    c: Awaited<ReturnType<typeof prepared>>,
    overrides: Partial<PolicyChangeEvidence> = {},
  ) => ({
    ...c.snapshot,
    id: randomUUID(),
    sourceRevision: 1,
    workflowRevision: 3,
    sourceVersion: c.snapshot.targetVersion,
    targetVersion: {
      id: randomUUID(),
      number: c.snapshot.targetVersion.number + 1,
      hash: '6'.repeat(64),
    },
    previousChange: { id: c.change.id, hash: c.change.hash },
    ...overrides,
  });
  return {
    ...f,
    changes: service,
    changeGrant: grant,
    postChange: post,
    observeChange: observe,
    reviewChange: review,
    preparedChange: prepared,
    readyChange: ready,
    refundPlan: plan,
    prepareRefund: refund,
    approveRefund: approve,
    refundExecution: execution,
    nextChange: next,
  };
}
