import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createPublicKey, verify } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { FinanceConfigurationRelease } from './entities/finance-configuration-release.entity';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
  FINANCE_UUID,
} from './finance-configuration.types';
import { candidateCode } from './finance-journal-candidate.types';
import {
  normalizeSourceEnvelope,
  sourceByteHash,
  sourceEventHashes,
  MAX_SOURCE_EVENT_BYTES,
  type FinanceProducerPrincipal,
  type FinanceSourceEnvelope,
  type FinanceEventContract,
} from './finance-event.types';
import { verifyEventRouteSnapshot } from './finance-event-route.snapshot';
import { verifyReviewedDimensionMaster } from './finance-reviewed-dimension-master';

interface ProducerKey {
  id: string;
  tenant_id: string;
  producer_id: string;
  subject_id: string;
  source_system: string;
  source_company_id: string;
  version: number;
  public_key_pem: string;
  key_fingerprint: string;
  authority_reference: string;
  state: string;
  valid_from: Date;
  valid_to: Date | null;
  revoked_at: Date | null;
}
export interface Target {
  legalEntityId: string;
  bookId: string;
  routeId: string;
  routeHash: string;
  contractId: string;
  contractHash: string;
  associationId: string;
  associationHash: string;
  sourceMapId: string;
  sourceMapHash: string;
}
interface Preview {
  id: string;
  semantic_hash: string;
  target_hash: string;
  subject: Record<string, unknown>;
  target_manifest: Target[];
}

/** Native signature/schema/routing validation only; never dispatches or posts. */
@Injectable()
export class FinanceEventPreviewService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  async previewInactive(
    principal: FinanceProducerPrincipal,
    rawBody: Buffer,
    signatureBase64: string,
  ) {
    return this.validatePreview(principal, rawBody, signatureBase64);
  }

  async previewInTransaction(
    manager: EntityManager,
    principal: FinanceProducerPrincipal,
    rawBody: Buffer,
    signatureBase64: string,
  ) {
    if (
      !manager.queryRunner?.isTransactionActive ||
      manager.connection !== this.source
    )
      throw new ForbiddenException(
        'An owning Finance transaction is required.',
      );
    return this.validatePreview(principal, rawBody, signatureBase64, manager);
  }

  private async validatePreview(
    principal: FinanceProducerPrincipal,
    rawBody: Buffer,
    signatureBase64: string,
    owningManager?: EntityManager,
  ) {
    if (
      !principal ||
      principal.kind !== 'WORKER' ||
      ![principal.tenantId, principal.subjectId].every(
        (id) => typeof id === 'string' && FINANCE_UUID.test(id),
      ) ||
      !candidateCode(principal.producerId)
    )
      throw new ForbiddenException(
        'A verified tenant-scoped producer identity is required.',
      );
    principal = Object.freeze({
      kind: 'WORKER',
      tenantId: principal.tenantId.toLowerCase(),
      subjectId: principal.subjectId.toLowerCase(),
      producerId: principal.producerId,
    });
    if (
      !Buffer.isBuffer(rawBody) ||
      !rawBody.length ||
      rawBody.length > MAX_SOURCE_EVENT_BYTES
    )
      throw new BadRequestException(
        'A bounded raw source-event Buffer is required.',
      );
    const body = Buffer.from(rawBody),
      event = normalizeSourceEnvelope(body);
    if (
      event.tenant_id !== principal.tenantId ||
      event.producer_id !== principal.producerId
    )
      throw new ForbiddenException(
        'Signed source scope differs from the verified producer.',
      );
    if (
      typeof signatureBase64 !== 'string' ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signatureBase64)
    )
      throw new ForbiddenException(
        'A canonical Ed25519 source signature is required.',
      );
    const signature = Buffer.from(signatureBase64, 'base64');
    if (
      signature.length !== 64 ||
      signature.toString('base64') !== signatureBase64
    )
      throw new ForbiddenException('Source signature is invalid.');
    try {
      const execute = async (manager: EntityManager) => {
        // Supported configuration writers use this lock before all book locks.
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['finance-inactive-config:' + principal.tenantId],
        );
        const credential = await this.key(manager, principal, event);
        let valid = false;
        try {
          const publicKey = createPublicKey(credential.public_key_pem);
          valid =
            publicKey.asymmetricKeyType === 'ed25519' &&
            sourceByteHash(
              publicKey.export({ format: 'der', type: 'spki' }),
            ) === credential.key_fingerprint &&
            verify(null, body, publicKey, signature);
        } catch {
          valid = false;
        }
        if (!valid)
          throw new ForbiddenException(
            'Source signature or pinned producer key is invalid.',
          );
        const keyHash = this.keyHash(credential),
          rawHash = sourceByteHash(body),
          signatureHash = sourceByteHash(signature);
        const resolved = await this.destinations(manager, principal, event),
          targets = resolved.targets,
          contract = resolved.contract;
        if (event.payload.dimensions) {
          if (event.payload.dimensions.length !== targets.length)
            throw new ConflictException(
              'Signed dimension evidence must cover every routed book.',
            );
          for (const target of targets) {
            const selected = event.payload.dimensions.find(
              (row) => row.book_id.toLowerCase() === target.bookId,
            );
            if (!selected)
              throw new ConflictException(
                'Signed dimension evidence must cover every routed book.',
              );
            const dimensions: Record<string, string> = {
              COMPANY: event.source_company_id,
              DIMENSION_RELEASE: selected.dimension_release_id,
              DIMENSION_HASH: selected.dimension_release_hash,
              SOURCE_ASSOCIATION: selected.source_association_id,
              SOURCE_ASSOCIATION_HASH: selected.source_association_hash,
            };
            if (selected.branch_id) dimensions.BRANCH = selected.branch_id;
            if (selected.product_id) dimensions.PRODUCT = selected.product_id;
            await verifyReviewedDimensionMaster(
              manager,
              [principal.tenantId, target.legalEntityId, target.bookId],
              {
                economicOrigin: 'SIGNED_EVENT_DIMENSIONS',
                accountingDate: event.occurred_at.slice(0, 10),
                lines: [
                  {
                    lineKey: 'SOURCE',
                    roleCode: 'SOURCE',
                    debit: '0',
                    credit: '0',
                    dimensions,
                  },
                ],
              },
            );
          }
        }
        const hashes = sourceEventHashes(event, contract),
          targetHash = financeConfigurationHash(targets);
        const [seenEvent] = await manager.query(
          'SELECT event_hash FROM finance_source_event_preview_deliveries WHERE tenant_id=$1 AND producer_id=$2 AND event_id=$3 LIMIT 1',
          [principal.tenantId, principal.producerId, event.event_id],
        );
        if (seenEvent && seenEvent.event_hash !== hashes.event)
          throw new ConflictException(
            'The producer event ID already identifies different immutable content.',
          );
        const [seenDelivery] = await manager.query(
          'SELECT * FROM finance_source_event_preview_deliveries WHERE tenant_id=$1 AND producer_id=$2 AND delivery_id=$3',
          [principal.tenantId, principal.producerId, event.delivery_id],
        );
        let [preview]: Preview[] = await manager.query(
          'SELECT * FROM finance_source_event_previews WHERE tenant_id=$1 AND economic_root=$2 AND source_revision=$3',
          [principal.tenantId, hashes.root, event.aggregate.revision],
        );
        if (seenDelivery) {
          this.storedDelivery(seenDelivery, body, signatureBase64, keyHash);
          if (
            !preview ||
            seenDelivery.preview_id !== preview.id ||
            seenDelivery.event_id !== event.event_id ||
            seenDelivery.event_hash !== hashes.event ||
            seenDelivery.raw_hash !== rawHash ||
            seenDelivery.signature_hash !== signatureHash ||
            seenDelivery.key_hash !== keyHash
          )
            throw new ConflictException(
              'Delivery identity was reused with changed raw bytes, credentials or content.',
            );
          await this.persisted(
            manager,
            principal,
            event,
            preview,
            hashes.semantic,
            targetHash,
            targets,
          );
          await this.recheckKey(manager, principal, event, keyHash);
          return this.result(preview, event, targets, 'EXACT_DELIVERY_RETRY');
        }
        if (preview)
          await this.persisted(
            manager,
            principal,
            event,
            preview,
            hashes.semantic,
            targetHash,
            targets,
          );
        else {
          const [latest] = await manager.query(
            'SELECT id,source_revision FROM finance_source_event_previews WHERE tenant_id=$1 AND economic_root=$2 ORDER BY source_revision DESC LIMIT 1',
            [principal.tenantId, hashes.root],
          );
          if (
            latest
              ? event.aggregate.revision !== latest.source_revision + 1 ||
                event.aggregate.previous_revision !== latest.source_revision
              : event.aggregate.revision !== 1
          )
            throw new ConflictException(
              'Source revision is missing, out of order or stale; no predecessor is invented.',
            );
          [preview] = await manager.query(
            `INSERT INTO finance_source_event_previews (tenant_id,source_system,source_company_id,economic_root,source_revision,previous_preview_id,semantic_hash,subject,target_hash,target_manifest) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb) RETURNING *`,
            [
              principal.tenantId,
              event.source_system,
              event.source_company_id,
              hashes.root,
              event.aggregate.revision,
              latest?.id ?? null,
              hashes.semantic,
              canonicalFinanceJson(hashes.subject),
              targetHash,
              canonicalFinanceJson(targets),
            ],
          );
          for (const t of targets)
            await manager.query(
              `INSERT INTO finance_source_event_preview_targets (tenant_id,preview_id,legal_entity_id,book_id,route_id,route_hash,contract_id,contract_hash,association_id,association_hash,source_map_id,source_map_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [
                principal.tenantId,
                preview.id,
                t.legalEntityId,
                t.bookId,
                t.routeId,
                t.routeHash,
                t.contractId,
                t.contractHash,
                t.associationId,
                t.associationHash,
                t.sourceMapId,
                t.sourceMapHash,
              ],
            );
          await this.persisted(
            manager,
            principal,
            event,
            preview,
            hashes.semantic,
            targetHash,
            targets,
          );
        }
        const [delivery] = await manager.query(
          `INSERT INTO finance_source_event_preview_deliveries (tenant_id,producer_id,source_system,source_company_id,delivery_id,event_id,event_hash,raw_hash,signature_hash,key_id,key_hash,preview_id,raw_body,signature_base64,key_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb) RETURNING *`,
          [
            principal.tenantId,
            principal.producerId,
            event.source_system,
            event.source_company_id,
            event.delivery_id,
            event.event_id,
            hashes.event,
            rawHash,
            signatureHash,
            credential.id,
            keyHash,
            preview.id,
            body,
            signatureBase64,
            canonicalFinanceJson(this.keySnapshot(credential)),
          ],
        );
        this.storedDelivery(delivery, body, signatureBase64, keyHash);
        await manager.query(
          'INSERT INTO finance_source_event_preview_audits (tenant_id,delivery_record_id,preview_id,actor_subject_id,event_hash) VALUES ($1,$2,$3,$4,$5)',
          [
            principal.tenantId,
            delivery.id,
            preview.id,
            principal.subjectId,
            hashes.event,
          ],
        );
        await this.recheckKey(manager, principal, event, keyHash);
        return this.result(preview, event, targets, 'VALIDATED_DELIVERY_ONLY');
      };
      return await (owningManager
        ? execute(owningManager)
        : this.source.transaction(execute));
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } })?.driverError?.code ===
        '23505'
      )
        throw new ConflictException(
          'Source preview identity or revision already exists.',
        );
      throw error;
    }
  }
  private result(
    preview: Preview,
    event: FinanceSourceEnvelope,
    targets: Target[],
    disposition: string,
  ) {
    return {
      previewId: preview.id,
      state: 'VALIDATED_INACTIVE' as const,
      disposition,
      eventId: event.event_id,
      deliveryId: event.delivery_id,
      semanticHash: preview.semantic_hash,
      destinations: targets,
      financialEffects: 0 as const,
    };
  }
  private async persisted(
    manager: EntityManager,
    p: FinanceProducerPrincipal,
    event: FinanceSourceEnvelope,
    preview: Preview,
    semantic: string,
    targetHash: string,
    targets: Target[],
  ) {
    if (
      preview.semantic_hash !== semantic ||
      financeConfigurationHash(preview.subject) !== semantic ||
      preview.target_hash !== targetHash ||
      canonicalFinanceJson(preview.target_manifest) !==
        canonicalFinanceJson(targets)
    )
      throw new ConflictException(
        'Source content or the exact approved routing manifest changed; controlled replay/rebase is required.',
      );
    const actual = await manager.query(
      `SELECT legal_entity_id AS "legalEntityId",book_id AS "bookId",route_id AS "routeId",route_hash AS "routeHash",contract_id AS "contractId",contract_hash AS "contractHash",association_id AS "associationId",association_hash AS "associationHash",source_map_id AS "sourceMapId",source_map_hash AS "sourceMapHash" FROM finance_source_event_preview_targets WHERE tenant_id=$1 AND preview_id=$2 ORDER BY book_id`,
      [p.tenantId, preview.id],
    );
    if (canonicalFinanceJson(actual) !== canonicalFinanceJson(targets))
      throw new ConflictException(
        'Persisted destination population differs from the complete routing manifest.',
      );
  }
  private async destinations(
    manager: EntityManager,
    p: FinanceProducerPrincipal,
    event: FinanceSourceEnvelope,
  ) {
    const date = event.occurred_at.slice(0, 10);
    const routes: FinanceConfigurationRelease[] = await manager
      .getRepository(FinanceConfigurationRelease)
      .createQueryBuilder('r')
      .where(
        "r.tenant_id=:tenant AND r.kind='EVENT_ROUTES' AND r.state='REVIEWED_INACTIVE'",
        { tenant: p.tenantId },
      )
      .andWhere(
        "r.payload->'selector'->>'producerId'=:producer AND r.payload->'selector'->>'eventType'=:event AND r.payload->'selector'->>'schemaVersion'=:version AND r.payload->'selector'->>'sourceSystem'=:system AND r.payload->'selector'->>'sourceCompanyId'=:company",
        {
          producer: p.producerId,
          event: event.event_type,
          version: event.schema_version,
          system: event.source_system,
          company: event.source_company_id,
        },
      )
      .andWhere(
        'r.effective_from<=:date AND (r.effective_to IS NULL OR r.effective_to>:date)',
        { date },
      )
      .orderBy('r.book_id', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getMany();
    if (!routes.length || routes.length > 20)
      throw new ForbiddenException(
        'No bounded exact independently reviewed inactive source fanout is available.',
      );
    const targets: Target[] = [];
    let contract: FinanceEventContract | undefined;
    for (const r of routes) {
      const [book] = await manager.query(
        "SELECT id FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 AND state IN ('DRAFT','ACTIVE') FOR SHARE",
        [p.tenantId, r.legal_entity_id, r.book_id],
      );
      const [entity] = await manager.query(
        "SELECT business_profile FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2 AND state IN ('DRAFT','ACTIVE') FOR SHARE",
        [p.tenantId, r.legal_entity_id],
      );
      if (!book || !entity || targets.some((t) => t.bookId === r.book_id))
        throw new ConflictException(
          'An approved destination is unavailable or ambiguous; partial fanout is forbidden.',
        );
      const verified = await verifyEventRouteSnapshot(
        manager,
        { tenantId: p.tenantId },
        { legalEntityId: r.legal_entity_id, bookId: r.book_id },
        entity.business_profile,
        r.payload,
        r.effective_from,
        r.effective_to,
        r.dependency_refs,
      );
      const c = verified.contract;
      if (
        c.producerId !== p.producerId ||
        c.eventType !== event.event_type ||
        c.schemaVersion !== event.schema_version ||
        c.sourceSystem !== event.source_system ||
        c.aggregateType !== event.aggregate.type ||
        verified.map.source_company_id !== event.source_company_id ||
        (contract && canonicalFinanceJson(c) !== canonicalFinanceJson(contract))
      )
        throw new ConflictException(
          'The exact codec, source identity or fact meaning differs across destinations.',
        );
      contract = c;
      targets.push({
        legalEntityId: r.legal_entity_id,
        bookId: r.book_id,
        routeId: r.id,
        routeHash: r.release_hash,
        contractId: verified.contractRelease.id,
        contractHash: verified.contractRelease.release_hash,
        associationId: verified.association.id,
        associationHash: verified.association.release_hash,
        sourceMapId: verified.map.id,
        sourceMapHash: verified.route.sourceMapHash,
      });
    }
    return { targets, contract: contract! };
  }
  private async key(
    manager: EntityManager,
    p: FinanceProducerPrincipal,
    event: FinanceSourceEnvelope,
  ): Promise<ProducerKey> {
    const [key]: ProducerKey[] = await manager.query(
      "SELECT * FROM finance_event_producer_keys WHERE tenant_id=$1 AND id=$2 AND producer_id=$3 AND subject_id=$4 AND source_system=$5 AND source_company_id=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE",
      [
        p.tenantId,
        event.key_id,
        p.producerId,
        p.subjectId,
        event.source_system,
        event.source_company_id,
      ],
    );
    if (!key)
      throw new ForbiddenException(
        'A current source-company-scoped producer key is required.',
      );
    return key;
  }
  private keyHash(k: ProducerKey) {
    return financeConfigurationHash(this.keySnapshot(k));
  }
  private keySnapshot(k: ProducerKey) {
    return {
      ...k,
      valid_from: k.valid_from.toISOString(),
      valid_to: k.valid_to?.toISOString() ?? null,
      revoked_at: k.revoked_at?.toISOString() ?? null,
    };
  }
  private storedDelivery(
    row: {
      raw_body: Buffer;
      raw_hash: string;
      signature_base64: string;
      signature_hash: string;
      key_snapshot: unknown;
      key_hash: string;
    },
    body: Buffer,
    signature: string,
    keyHash: string,
  ) {
    if (
      !Buffer.isBuffer(row.raw_body) ||
      !row.raw_body.equals(body) ||
      sourceByteHash(row.raw_body) !== row.raw_hash ||
      row.signature_base64 !== signature ||
      sourceByteHash(Buffer.from(signature, 'base64')) !== row.signature_hash ||
      row.key_hash !== keyHash ||
      financeConfigurationHash(row.key_snapshot) !== keyHash
    )
      throw new ConflictException(
        'Stored signature, exact source bytes or public-key snapshot differs.',
      );
  }
  private async recheckKey(
    manager: EntityManager,
    p: FinanceProducerPrincipal,
    event: FinanceSourceEnvelope,
    hash: string,
  ) {
    if (this.keyHash(await this.key(manager, p, event)) !== hash)
      throw new ForbiddenException(
        'Producer credential changed before completion.',
      );
  }
}
