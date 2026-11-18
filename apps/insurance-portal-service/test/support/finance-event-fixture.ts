import {
  randomUUID,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from 'node:crypto';
import { DataSource } from 'typeorm';
import { FinanceLegalEntity } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/finance/foundation/entities/finance-accounting-book.entity';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity-source-map.entity';
import { FinanceConfigurationAuthority } from '../../src/modules/tenant/finance/foundation/entities/finance-configuration-authority.entity';
import { FinanceConfigurationService } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.service';
import { FinanceEventPreviewService } from '../../src/modules/tenant/finance/accounting/accounting-events/finance-event-preview.service';
import { financeChartSourceMapHash } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/finance-chart.snapshot';
import {
  financeConfigurationHash,
  type FinanceConfigurationActor,
  type FinanceConfigurationInput,
} from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import {
  sourceOrderingKey,
  sourceByteHash,
  type FinanceSourceEnvelope,
  type FinanceProducerPrincipal,
} from '../../src/modules/tenant/finance/accounting/accounting-events/finance-event.types';

export function syntheticSourceEnvelope(
  tenantId = randomUUID(),
  keyId = randomUUID(),
): FinanceSourceEnvelope {
  const p: FinanceSourceEnvelope = {
    event_id: randomUUID(),
    delivery_id: randomUUID(),
    event_type: 'source.policy.terms-snapshotted.v1',
    schema_version: '1.0.0',
    producer_id: 'SYNTHETIC_PORTAL',
    key_id: keyId,
    tenant_id: tenantId,
    source_system: 'SYNTHETIC_PORTAL',
    source_company_id: randomUUID(),
    aggregate: {
      type: 'POLICY',
      id: 'synthetic-policy-1',
      revision: 1,
      previous_revision: null,
    },
    occurred_at: '2026-11-15T10:00:00.000Z',
    source_reference: { kind: 'POLICY', id: 'synthetic-policy-1', version: 1 },
    correlation_id: randomUUID(),
    causation_id: null,
    ordering_key: '',
    payload: {
      snapshot_id: 'synthetic-snapshot-1',
      snapshot_hash: 'a'.repeat(64),
      source_revision: 1,
    },
    payload_hash: '',
  };
  return refreshSourceEnvelope(p);
}
export function refreshSourceEnvelope(
  p: FinanceSourceEnvelope,
): FinanceSourceEnvelope {
  p.payload_hash = financeConfigurationHash(p.payload);
  p.ordering_key = sourceOrderingKey(p);
  return p;
}
export async function createEventFixture(
  source: DataSource,
  options: {
    factKinds?: string[];
    withoutRoutes?: boolean;
    contract?: { eventType: string; aggregateType: string; factKind: string };
  } = {},
) {
  const tenantId = randomUUID(),
    companyId = randomUUID();
  const entity = await source.getRepository(FinanceLegalEntity).save({
    tenant_id: tenantId,
    entity_code: 'SYNTHETIC',
    legal_name: 'Synthetic source owner',
    business_profile: 'GENERAL_INSURER',
  });
  const books = await source.getRepository(FinanceAccountingBook).save(
    ['A', 'B'].map((book_code) => ({
      tenant_id: tenantId,
      legal_entity_id: entity.id,
      book_code,
    })),
  );
  const human = (): FinanceConfigurationActor => ({
    kind: 'USER',
    tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
  });
  const maker = human(),
    checker = human();
  for (const book of books)
    await source.getRepository(FinanceConfigurationAuthority).save(
      [
        { actor: maker, permission: 'PREPARE_CONFIG' as const },
        { actor: checker, permission: 'REVIEW_CONFIG' as const },
      ].map(({ actor, permission }) => ({
        tenant_id: tenantId,
        legal_entity_id: entity.id,
        book_id: book.id,
        subject_id: actor.subjectId,
        natural_person_id: actor.naturalPersonId,
        permission,
        state: 'ENABLED' as const,
        authority_reference: 'SYNTHETIC-TEST-ONLY',
        valid_from: new Date('2020-01-01Z'),
      })),
    );
  const map = await source.getRepository(FinanceLegalEntitySourceMap).save({
    tenant_id: tenantId,
    legal_entity_id: entity.id,
    source_system: 'SYNTHETIC_PORTAL',
    source_company_id: companyId,
    legal_role: 'INSURER',
    business_profile: 'GENERAL_INSURER',
    mapping_version: 1,
    valid_from: '2020-01-01',
  });
  const config = new FinanceConfigurationService(source),
    service = new FinanceEventPreviewService(source);
  const scope = (index = 0) => ({
    legalEntityId: entity.id,
    bookId: books[index].id,
  });
  const review = async (
    index: number,
    input: Partial<FinanceConfigurationInput> &
      Pick<FinanceConfigurationInput, 'kind' | 'key'>,
  ) => {
    const draft = await config.createDraft(
      maker,
      scope(index),
      {
        version: 1,
        effectiveFrom: '2026-01-01',
        dependencyRefs: ['DEC-12', 'DEC-14'],
        ...input,
      },
      'synthetic inactive event definition',
    );
    await config.submit(
      maker,
      scope(index),
      draft.id,
      draft.release_hash,
      'synthetic submission',
    );
    return config.reviewInactive(
      checker,
      scope(index),
      draft.id,
      draft.release_hash,
      'REVIEWED_INACTIVE',
      'synthetic independent review',
    );
  };
  const routes: {
    contract: Awaited<ReturnType<typeof review>>;
    association: Awaited<ReturnType<typeof review>>;
    route: Awaited<ReturnType<typeof review>>;
  }[] = [];
  if (!options.withoutRoutes)
    for (const [i] of books.entries()) {
      const contract = await review(i, {
        kind: 'EVENT_CONTRACTS',
        key: 'TEST-CONTRACT',
        payload: {
          schema: 'FINANCE_EVENT_CONTRACT_V1',
          purpose: 'SOURCE_FACT_REFERENCE',
          eventType:
            options.contract?.eventType ?? 'source.policy.terms-snapshotted.v1',
          schemaVersion: '1.0.0',
          producerId: 'SYNTHETIC_PORTAL',
          sourceSystem: 'SYNTHETIC_PORTAL',
          aggregateType: options.contract?.aggregateType ?? 'POLICY',
          factKind:
            options.factKinds?.[i] ??
            options.contract?.factKind ??
            'POLICY_TERMS',
          codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
        },
      });
      const association = await review(i, {
        kind: 'SOURCE_ASSOCIATIONS',
        key: 'TEST-ASSOCIATION',
        sourceMapIds: [map.id],
      });
      const current = await source
        .getRepository(FinanceLegalEntitySourceMap)
        .findOneByOrFail({ id: map.id });
      const route = await review(i, {
        kind: 'EVENT_ROUTES',
        key: 'TEST-ROUTE',
        payload: {
          schema: 'FINANCE_EVENT_ROUTE_V1',
          contractId: contract.id,
          contractHash: contract.release_hash,
          sourceAssociationId: association.id,
          sourceAssociationHash: association.release_hash,
          sourceMapId: map.id,
          sourceMapHash: financeChartSourceMapHash(current),
        },
      });
      routes.push({ contract, association, route });
    }
  const keys = generateKeyPairSync('ed25519'),
    keyId = randomUUID();
  const principal: FinanceProducerPrincipal = {
    kind: 'WORKER',
    tenantId,
    subjectId: randomUUID(),
    producerId: 'SYNTHETIC_PORTAL',
  };
  await source.query(
    `INSERT INTO finance_event_producer_keys(id,tenant_id,producer_id,subject_id,source_system,source_company_id,version,public_key_pem,key_fingerprint,authority_reference,state,valid_from) VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,'SYNTHETIC-KEY-ONLY','ENABLED','2020-01-01')`,
    [
      keyId,
      tenantId,
      principal.producerId,
      principal.subjectId,
      'SYNTHETIC_PORTAL',
      companyId,
      keys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      sourceByteHash(keys.publicKey.export({ format: 'der', type: 'spki' })),
    ],
  );
  const envelope = () => {
    const p = syntheticSourceEnvelope(tenantId, keyId);
    p.source_company_id = companyId;
    if (options.contract) {
      p.event_type = options.contract.eventType;
      p.aggregate.type = options.contract.aggregateType;
      p.source_reference.kind = options.contract.aggregateType;
    }
    return refreshSourceEnvelope(p);
  };
  const signed = (
    p: FinanceSourceEnvelope = envelope(),
    key: KeyObject = keys.privateKey,
    raw?: Buffer,
  ) => {
    const body = raw ?? Buffer.from(JSON.stringify(p));
    return { body, signature: sign(null, body, key).toString('base64') };
  };
  const preview = (p: FinanceSourceEnvelope = envelope()) => {
    const s = signed(p);
    return service.previewInactive(principal, s.body, s.signature);
  };
  return {
    tenantId,
    companyId,
    entity,
    books,
    map,
    scope,
    maker,
    checker,
    config,
    service,
    review,
    routes,
    keys,
    keyId,
    principal,
    envelope,
    signed,
    preview,
  };
}
