import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  createIntegrationFixture,
  requireLease,
} from './finance-integration-fixture';
import { refreshSourceEnvelope } from './finance-event-fixture';
import { FinanceQuotationBillingService } from '../../src/modules/tenant/finance/integrations/quotation-finance/finance-quotation-billing.service';
import {
  BILLING_EVENT,
  BILLING_SCHEMA,
  type QuotationBillingSnapshot,
} from '../../src/modules/tenant/finance/integrations/quotation-finance/finance-quotation-billing.types';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
export function syntheticBillingSnapshot(
  companyId = randomUUID(),
): QuotationBillingSnapshot {
  const c = {
    gross: '118',
    discount: '0',
    tax: null,
    charges: '0',
    total: '118',
  };
  return {
    schema: BILLING_SCHEMA,
    quotationId: randomUUID(),
    quotationNumber: 'SYNTHETIC-QUOTE',
    sourceCompanyId: companyId,
    sourceRevision: 1,
    workflowRevision: 7,
    invoiceId: randomUUID(),
    invoiceNumber: 'SYNTHETIC-INVOICE',
    invoiceSourceRevision: 3,
    invoiceStateVersion: 5,
    policyId: null,
    sourceStatus: 'ISSUED',
    billingDate: '2026-11-15',
    currency: 'USD',
    decimalScale: 2,
    taxPresentation: 'UNSPLIT',
    productId: randomUUID(),
    customerId: randomUUID(),
    branchId: null,
    pricingResultHash: null,
    finalizationHash: 'a'.repeat(64),
    paymentReference: {
      id: randomUUID(),
      currency: 'USD',
      amount: '118',
      state: 'ACTIVE',
    },
    legacyJournalEvidence: { state: 'NOT_ASSESSED', references: [] },
    components: c,
    lines: [
      {
        key: 'PREMIUM',
        description: 'Synthetic premium, tax split unknown',
        ...c,
      },
    ],
  };
}
export async function createBillingFixture(source: DataSource) {
  const f = await createIntegrationFixture(source, {
      eventContract: {
        eventType: BILLING_EVENT,
        aggregateType: 'QUOTATION',
        factKind: 'QUOTATION_BILLING',
      },
    }),
    service = new FinanceQuotationBillingService(source);
  const profiles: Awaited<ReturnType<typeof f.review>>[] = [];
  for (let i = 0; i < 2; i++)
    profiles.push(
      await f.review(i, {
        kind: 'QUOTATION_BILLING_RULES',
        key: 'SYNTHETIC-BILLING',
        dependencyRefs: ['DEC-01', 'DEC-12', 'DEC-14'],
        payload: {
          schema: 'FINANCE_QUOTATION_BILLING_RULES_V1',
          purpose: 'MEMORANDUM_ONLY',
          recognition: 'HELD_INACTIVE',
          maxLines: 10,
        },
      }),
    );
  const grant = async (p = f.maker, permission = 'PREPARE_BILLING', i = 0) => {
    const [r] = await source.query(
      "INSERT INTO finance_billing_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-ONLY','2020-01-01') RETURNING *",
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
  for (let i = 0; i < 2; i++)
    for (const p of [f.maker, f.checker])
      for (const perm of ['PREPARE_BILLING', 'REVIEW_BILLING', 'READ_BILLING'])
        await grant(p, perm, i);
  const post = async (snapshot: QuotationBillingSnapshot) => {
    const e = f.envelope();
    e.aggregate = {
      type: 'QUOTATION',
      id: snapshot.quotationId,
      revision: snapshot.sourceRevision,
      previous_revision:
        snapshot.sourceRevision === 1 ? null : snapshot.sourceRevision - 1,
    };
    e.source_reference = {
      kind: 'QUOTATION',
      id: snapshot.quotationId,
      version: snapshot.sourceRevision,
    };
    e.payload = {
      snapshot_id: snapshot.invoiceId ?? snapshot.quotationId,
      snapshot_hash: hash(snapshot),
      source_revision: snapshot.sourceRevision,
    };
    refreshSourceEnvelope(e);
    const r = await f.capture(e),
      l = requireLease(await f.intake.claim(f.worker, r.intakeId)),
      processed = await f.intake.process(f.worker, l);
    if (processed.state !== 'DISPOSITION_RECORDED')
      throw new Error('Synthetic source must be accepted before billing');
    const [intake] = await source.query(
      'SELECT preview_id FROM finance_integration_intakes WHERE id=$1',
      [r.intakeId],
    );
    const boxes = await source.query(
      'SELECT * FROM finance_integration_inboxes WHERE preview_id=$1',
      [intake.preview_id],
    );
    return {
      event: e,
      inbox: (i = 0) => boxes.find((b) => b.book_id === f.books[i].id),
      input: (i = 0) => ({
        inboxId: boxes.find((b) => b.book_id === f.books[i].id).id,
        profileId: profiles[i].id,
        profileHash: profiles[i].release_hash,
        snapshot,
      }),
    };
  };
  const prepare = async (snapshot = syntheticBillingSnapshot(f.companyId)) => {
    const accepted = await post(snapshot);
    const memo = await service.prepareInactive(
      f.maker,
      f.scope(),
      accepted.input(),
      'synthetic quotation observation',
    );
    return { snapshot, accepted, memo };
  };
  return {
    ...f,
    billing: service,
    billingProfiles: profiles,
    billingGrant: grant,
    post,
    prepare,
    snapshot: () => syntheticBillingSnapshot(f.companyId),
  };
}
