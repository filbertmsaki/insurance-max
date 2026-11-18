import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  financeConfigurationHash,
  canonicalFinanceJson,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { candidateCode } from '../../accounting/journal-entries/finance-journal-candidate.types';
import {
  integrationWorker,
  integrationScope,
  integrationGrant,
  integrationBook,
  integrationProfile,
  integrationAudit,
  checkLease,
  referenceAttemptCeiling,
} from './finance-integration.controls';
import {
  FINANCE_REFERENCE_TRANSPORTS,
  REFERENCE_OUTCOME_CONTRACT,
  integrationLease,
  referenceOutcome,
  validAck,
  type FinanceReferenceTransport,
  type IntegrationWorker,
  type IntegrationScope,
  type IntegrationLease,
  type ReferenceOutcome,
  type ReferenceAcknowledgement,
} from './finance-integration.types';

@Injectable()
export class FinanceReferenceDeliveryService {
  private readonly transports: ReadonlyMap<string, FinanceReferenceTransport>;
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @Inject(FINANCE_REFERENCE_TRANSPORTS)
    transports: readonly FinanceReferenceTransport[] = [],
  ) {
    const registry = new Map<string, FinanceReferenceTransport>();
    for (const transport of transports) {
      if (
        !transport ||
        !candidateCode(transport.consumerId) ||
        transport.contract !== REFERENCE_OUTCOME_CONTRACT ||
        typeof transport.send !== 'function' ||
        registry.has(transport.consumerId)
      )
        throw new BadRequestException(
          'Explicit unique nonfinancial reference transports are required.',
        );
      registry.set(transport.consumerId, transport);
    }
    this.transports = registry;
  }
  async claim(
    actor: IntegrationWorker,
    scope: IntegrationScope,
  ): Promise<IntegrationLease | { state: string; id: string } | null> {
    actor = integrationWorker(actor);
    scope = integrationScope(scope);
    return this.source.transaction(async (m) => {
      await integrationBook(m, actor, scope);
      const verify = await integrationGrant(m, actor, 'DELIVER_OUTBOX', scope);
      const [row] = await m.query(
        "SELECT * FROM finance_reference_outbox WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND ((state IN ('PENDING','RETRY_WAIT') AND next_attempt_at<=statement_timestamp()) OR (state='LEASED' AND lease_until<=statement_timestamp())) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        [actor.tenantId, scope.legalEntityId, scope.bookId],
      );
      if (!row) return null;
      let profile;
      try {
        profile = await this.profile(m, row);
      } catch {
        await this.finish(
          m,
          actor,
          scope,
          row,
          'HELD_UNSUPPORTED',
          'INTEGRATION_PROFILE_UNAVAILABLE',
        );
        await verify();
        return { id: row.id, state: 'HELD_UNSUPPORTED' };
      }
      if (
        row.contract !== REFERENCE_OUTCOME_CONTRACT ||
        !this.transports.has(row.consumer_id)
      ) {
        await this.finish(
          m,
          actor,
          scope,
          row,
          'HELD_UNSUPPORTED',
          'UNSUPPORTED_TRANSPORT_CONTRACT',
        );
        await verify();
        return { id: row.id, state: 'HELD_UNSUPPORTED' };
      }
      if (
        row.attempt_count >=
        (await referenceAttemptCeiling(
          m,
          actor.tenantId,
          'OUTBOX',
          row.id,
          profile.maxAttempts,
        ))
      ) {
        await this.finish(
          m,
          actor,
          scope,
          row,
          'DEAD_LETTER',
          'DELIVERY_ATTEMPTS_EXHAUSTED',
        );
        await verify();
        return { id: row.id, state: 'DEAD_LETTER' };
      }
      const token = randomUUID();
      const [claimed] = await m.query(
        "WITH changed AS(UPDATE finance_reference_outbox SET state='LEASED',version=version+1,attempt_count=attempt_count+1,lease_token=$4,lease_subject_id=$5,lease_until=statement_timestamp()+$6*interval '1 second',reason_code='DELIVERY_LEASED' WHERE tenant_id=$1 AND book_id=$2 AND id=$3 RETURNING *) SELECT * FROM changed",
        [
          actor.tenantId,
          scope.bookId,
          row.id,
          token,
          actor.subjectId,
          profile.leaseSeconds,
        ],
      );
      await integrationAudit(m, {
        tenantId: actor.tenantId,
        ...scope,
        kind: 'outbox',
        id: row.id,
        action: 'DELIVERY_LEASED',
        version: claimed.version,
        leaseToken: token,
        actor: actor.subjectId,
        hash: row.payload_hash,
        reason: 'DELIVERY_LEASED',
      });
      await verify();
      return { id: row.id, token, version: claimed.version };
    });
  }
  async deliver(
    actor: IntegrationWorker,
    scope: IntegrationScope,
    value: IntegrationLease,
  ) {
    actor = integrationWorker(actor);
    scope = integrationScope(scope);
    const lease = integrationLease(value);
    // Commit dispatch intent and release all database locks before any transport.
    const message = await this.source.transaction(async (m) => {
      await integrationBook(m, actor, scope);
      const verify = await integrationGrant(m, actor, 'DELIVER_OUTBOX', scope);
      const row = await checkLease(
        m,
        'finance_reference_outbox',
        actor,
        lease,
        scope,
      );
      this.scope(row, scope);
      await this.profile(m, row);
      const payload = referenceOutcome(row.payload);
      if (
        payload.messageId !== row.id ||
        payload.tenantId !== actor.tenantId ||
        payload.bookId !== scope.bookId ||
        payload.legalEntityId !== scope.legalEntityId ||
        financeConfigurationHash(payload) !== row.payload_hash
      )
        throw new ConflictException('Exact immutable outcome payload differs.');
      const [dispatched] = await m.query(
        "SELECT id FROM finance_integration_audits WHERE outbox_id=$1 AND lease_token=$2 AND action='DISPATCH_STARTED'",
        [row.id, lease.token],
      );
      if (dispatched)
        throw new ConflictException(
          'This lease already dispatched; wait for fenced reclaim instead of sending again.',
        );
      await integrationAudit(m, {
        tenantId: actor.tenantId,
        ...scope,
        kind: 'outbox',
        id: row.id,
        action: 'DISPATCH_STARTED',
        version: row.version,
        leaseToken: lease.token,
        actor: actor.subjectId,
        hash: row.payload_hash,
        reason: 'AWAITING_EXPLICIT_ACK',
      });
      await verify();
      return {
        id: row.id,
        payloadHash: row.payload_hash as string,
        payload,
        consumerId: row.consumer_id as string,
      };
    });
    try {
      const transport = this.transports.get(message.consumerId);
      if (!transport || transport.contract !== REFERENCE_OUTCOME_CONTRACT)
        throw new BadRequestException('Unsupported reference transport.');
      const receivedAck = await transport.send({
        messageId: message.id,
        payloadHash: message.payloadHash,
        payload: JSON.parse(canonicalFinanceJson(message.payload)),
      });
      if (
        !validAck(
          receivedAck,
          message.id,
          message.payloadHash,
          message.consumerId,
        )
      )
        throw new BadRequestException(
          'An exact durable transport acknowledgement is required.',
        );
      const ack = Object.freeze({ ...receivedAck });
      return await this.source.transaction(async (m) => {
        await integrationBook(m, actor, scope);
        const verify = await integrationGrant(
          m,
          actor,
          'DELIVER_OUTBOX',
          scope,
        );
        const row = await checkLease(
          m,
          'finance_reference_outbox',
          actor,
          lease,
          scope,
        );
        this.scope(row, scope);
        await this.profile(m, row);
        await this.finish(
          m,
          actor,
          scope,
          row,
          'ACKNOWLEDGED',
          'TRANSPORT_ACKNOWLEDGED',
          lease,
          0,
          ack.receiptId,
        );
        await verify();
        return {
          messageId: row.id,
          state: 'ACKNOWLEDGED',
          receiptId: ack.receiptId,
          accountingState: 'HELD_INACTIVE',
          financialEffects: 0,
        };
      });
    } catch (error) {
      return this.source.transaction(async (m) => {
        await integrationBook(m, actor, scope);
        const verify = await integrationGrant(
          m,
          actor,
          'DELIVER_OUTBOX',
          scope,
        );
        const row = await checkLease(
          m,
          'finance_reference_outbox',
          actor,
          lease,
          scope,
        );
        this.scope(row, scope);
        const profile = await this.profile(m, row);
        const state =
          row.attempt_count >=
          (await referenceAttemptCeiling(
            m,
            actor.tenantId,
            'OUTBOX',
            row.id,
            profile.maxAttempts,
          ))
            ? 'DEAD_LETTER'
            : 'RETRY_WAIT';
        const reason =
          error instanceof BadRequestException
            ? 'INVALID_OR_UNSUPPORTED_ACK'
            : 'ACK_NOT_CONFIRMED';
        await this.finish(
          m,
          actor,
          scope,
          row,
          state,
          reason,
          lease,
          profile.retryDelaySeconds,
        );
        await verify();
        return {
          messageId: row.id,
          state,
          reason,
          accountingState: 'HELD_INACTIVE',
          financialEffects: 0,
        };
      });
    }
  }
  async receiveInactive(
    actor: IntegrationWorker,
    scope: IntegrationScope,
    consumerId: string,
    messageId: string,
    payloadHash: string,
    value: ReferenceOutcome,
  ): Promise<ReferenceAcknowledgement> {
    actor = integrationWorker(actor);
    scope = integrationScope(scope);
    const payload = referenceOutcome(value);
    if (!candidateCode(consumerId))
      throw new BadRequestException(
        'An explicit reference consumer is required.',
      );
    if (
      payload.messageId !== messageId ||
      payload.tenantId !== actor.tenantId ||
      payload.legalEntityId !== scope.legalEntityId ||
      payload.bookId !== scope.bookId ||
      financeConfigurationHash(payload) !== payloadHash
    )
      throw new ConflictException(
        'The exact scoped reference message/hash is required.',
      );
    return this.source.transaction(async (m) => {
      await integrationBook(m, actor, scope);
      const verify = await integrationGrant(
        m,
        actor,
        'RECEIVE_OUTCOME',
        scope,
        true,
        consumerId,
      );
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-reference-receipt:' +
          actor.tenantId +
          ':' +
          consumerId +
          ':' +
          messageId,
      ]);
      const [old] = await m.query(
        'SELECT * FROM finance_reference_receipts WHERE tenant_id=$1 AND consumer_id=$2 AND message_id=$3',
        [actor.tenantId, consumerId, messageId],
      );
      if (old) {
        if (
          old.payload_hash !== payloadHash ||
          old.book_id !== scope.bookId ||
          old.legal_entity_id !== scope.legalEntityId ||
          canonicalFinanceJson(old.payload) !== canonicalFinanceJson(payload)
        )
          throw new ConflictException(
            'Consumer message identity already belongs to different content or scope.',
          );
        await verify();
        return { messageId, payloadHash, consumerId, receiptId: old.id };
      }
      const [receipt] = await m.query(
        'INSERT INTO finance_reference_receipts(tenant_id,legal_entity_id,book_id,consumer_id,message_id,payload_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id',
        [
          actor.tenantId,
          scope.legalEntityId,
          scope.bookId,
          consumerId,
          messageId,
          payloadHash,
          canonicalFinanceJson(payload),
        ],
      );
      await integrationAudit(m, {
        tenantId: actor.tenantId,
        ...scope,
        kind: 'receipt',
        id: receipt.id,
        action: 'REFERENCE_RECEIVED',
        version: 1,
        actor: actor.subjectId,
        hash: payloadHash,
        reason: 'NONFINANCIAL_REFERENCE_ONLY',
      });
      await verify();
      return { messageId, payloadHash, consumerId, receiptId: receipt.id };
    });
  }
  async reconcile(actor: IntegrationWorker, scope: IntegrationScope) {
    actor = integrationWorker(actor);
    scope = integrationScope(scope);
    return this.source.transaction(async (m) => {
      await m.query('SET TRANSACTION READ ONLY');
      await integrationBook(m, actor, scope, false);
      await integrationGrant(m, actor, 'READ_RECONCILIATION', scope, false);
      const [r] = await m.query(
        `SELECT (SELECT count(*)::integer FROM finance_integration_inboxes WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3) AS inboxes,(SELECT count(*)::integer FROM finance_reference_dispositions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3) AS held_dispositions,(SELECT count(*)::integer FROM finance_reference_outbox WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3) AS outbox_messages,(SELECT count(*)::integer FROM finance_reference_outbox WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND state='ACKNOWLEDGED') AS acknowledged,(SELECT count(*)::integer FROM finance_reference_outbox WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND state<>'ACKNOWLEDGED') AS unresolved_delivery,(SELECT count(*)::integer FROM finance_reference_receipts WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3) AS local_consumer_receipts`,
        [actor.tenantId, scope.legalEntityId, scope.bookId],
      );
      return { ...r, accountingState: 'HELD_INACTIVE', financialEffects: 0 };
    });
  }
  private scope(row: Record<string, any>, s: IntegrationScope) {
    if (row.book_id !== s.bookId || row.legal_entity_id !== s.legalEntityId)
      throw new ConflictException(
        'Lease is outside the selected delivery book.',
      );
  }
  private profile(m: EntityManager, row: Record<string, any>) {
    return integrationProfile(m, {
      tenant_id: row.tenant_id,
      legal_entity_id: row.control_entity_id,
      book_id: row.control_book_id,
      profile_id: row.profile_id,
      profile_hash: row.profile_hash,
    });
  }
  private async finish(
    m: EntityManager,
    p: IntegrationWorker,
    s: IntegrationScope,
    row: Record<string, any>,
    state: string,
    reason: string,
    lease?: IntegrationLease,
    delay = 0,
    receiptId?: string,
  ) {
    const [updated] = await m.query(
      `WITH changed AS(UPDATE finance_reference_outbox SET state=$4,version=version+1,lease_token=NULL,lease_subject_id=NULL,lease_until=NULL,next_attempt_at=statement_timestamp()+$5*interval '1 second',reason_code=$6,ack_receipt_id=$7 WHERE tenant_id=$1 AND book_id=$2 AND id=$3 ${lease ? "AND state='LEASED' AND lease_token=$8 AND version=$9 AND lease_subject_id=$10 AND lease_until>statement_timestamp()" : ''} RETURNING *) SELECT * FROM changed`,
      [
        p.tenantId,
        s.bookId,
        row.id,
        state,
        delay,
        reason,
        receiptId ?? null,
        ...(lease ? [lease.token, lease.version, p.subjectId] : []),
      ],
    );
    if (!updated)
      throw new ConflictException(
        'Delivery lease expired before acknowledgement commit.',
      );
    await integrationAudit(m, {
      tenantId: p.tenantId,
      ...s,
      kind: 'outbox',
      id: row.id,
      action: state,
      version: updated.version,
      leaseToken: lease?.token,
      actor: p.subjectId,
      hash: row.payload_hash,
      reason,
    });
  }
}
