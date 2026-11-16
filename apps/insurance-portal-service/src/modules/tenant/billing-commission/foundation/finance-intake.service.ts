import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { FinanceEventPreviewService } from './finance-event-preview.service';
import { sourceByteHash, MAX_SOURCE_EVENT_BYTES } from './finance-event.types';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
} from './finance-configuration.types';
import {
  integrationLease,
  REFERENCE_OUTCOME_CONTRACT,
  type IngressWorker,
  type IntegrationWorker,
  type ReferenceOutcome,
  type IntegrationLease,
} from './finance-integration.types';
import {
  requireUuid,
  integrationWorker,
  integrationGrant,
  integrationProfile,
  integrationAudit,
  integrationSnapshot,
  channelHash,
  checkLease,
  referenceAttemptCeiling,
} from './finance-integration.controls';

@Injectable()
export class FinanceIntakeService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly previews: FinanceEventPreviewService = new FinanceEventPreviewService(
      source,
    ),
  ) {}
  async capture(
    actor: IngressWorker,
    channelId: string,
    receiptKey: string,
    rawBody: Buffer,
    signature: string,
  ) {
    if (!actor || actor.kind !== 'WORKER')
      throw new ForbiddenException('A verified ingress identity is required.');
    requireUuid(actor.subjectId);
    requireUuid(channelId);
    requireUuid(receiptKey);
    const subjectId = actor.subjectId.toLowerCase();
    channelId = channelId.toLowerCase();
    receiptKey = receiptKey.toLowerCase();
    if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string')
      throw new BadRequestException(
        'Actual received bytes and signature text are required.',
      );
    const rawHash = sourceByteHash(rawBody),
      signatureHash = sourceByteHash(Buffer.from(signature)),
      byteLength = rawBody.length;
    const body =
        rawBody.length <= MAX_SOURCE_EVENT_BYTES ? Buffer.from(rawBody) : null,
      storedSignature = signature.length <= 1024 ? signature : null;
    return this.source.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-intake:' + channelId + ':' + receiptKey,
      ]);
      const channel = await this.channel(m, channelId, subjectId),
        hash = channelHash(channel);
      const [old] = await m.query(
        'SELECT * FROM finance_integration_intakes WHERE channel_id=$1 AND receipt_key=$2 FOR UPDATE',
        [channelId, receiptKey],
      );
      if (old) {
        if (
          old.tenant_id !== channel.tenant_id ||
          old.channel_snapshot.ingress_subject_id !== subjectId
        )
          throw new ForbiddenException(
            'The receipt key is unavailable in this ingress binding.',
          );
        if (
          old.raw_hash === rawHash &&
          old.signature_hash === signatureHash &&
          old.channel_hash === hash
        )
          return {
            intakeId: old.id,
            state: old.state,
            reused: true,
            financialEffects: 0,
          };
        const [conflict] = await m.query(
          "INSERT INTO finance_integration_conflicts(intake_id,tenant_id,raw_hash,signature_hash,owner_reference,reason_code) VALUES($1,$2,$3,$4,$5,'RECEIPT_KEY_CONTENT_CONFLICT') RETURNING id",
          [old.id, old.tenant_id, rawHash, signatureHash, old.owner_reference],
        );
        await integrationAudit(m, {
          tenantId: old.tenant_id,
          kind: 'conflict',
          id: conflict.id,
          action: 'CONFLICT_CAPTURED',
          version: 1,
          actor: subjectId,
          hash: rawHash,
          reason: 'RECEIPT_KEY_CONTENT_CONFLICT',
        });
        return {
          intakeId: old.id,
          conflictId: conflict.id,
          state: 'CONFLICT_CAPTURED',
          reused: false,
          financialEffects: 0,
        };
      }
      const state = !channel.tenant_id
        ? 'QUARANTINED'
        : !body || storedSignature === null || !channel.profile_id
          ? 'HELD'
          : 'PENDING';
      const reason = !channel.tenant_id
        ? 'UNRESOLVED_SOURCE_SCOPE'
        : !body
          ? 'RAW_BODY_REDACTED_TOO_LARGE'
          : storedSignature === null
            ? 'SIGNATURE_REDACTED_TOO_LARGE'
            : !channel.profile_id
              ? 'INTEGRATION_PROFILE_MISSING'
              : 'PENDING_VALIDATION';
      const [row] = await m.query(
        `INSERT INTO finance_integration_intakes(channel_id,receipt_key,tenant_id,channel_snapshot,channel_hash,raw_body,raw_hash,byte_length,signature_input,signature_hash,owner_reference,state,reason_code) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          channelId,
          receiptKey,
          channel.tenant_id,
          canonicalFinanceJson(integrationSnapshot(channel)),
          hash,
          body,
          rawHash,
          byteLength,
          storedSignature,
          signatureHash,
          channel.owner_reference,
          state,
          reason,
        ],
      );
      await integrationAudit(m, {
        tenantId: row.tenant_id,
        kind: 'intake',
        id: row.id,
        action: 'CAPTURED',
        version: 1,
        actor: subjectId,
        hash: rawHash,
        reason,
      });
      if (channelHash(await this.channel(m, channelId, subjectId)) !== hash)
        throw new ForbiddenException(
          'Ingress binding changed before capture completed.',
        );
      return { intakeId: row.id, state, reused: false, financialEffects: 0 };
    });
  }
  async claim(
    actor: IntegrationWorker,
    intakeId: string,
  ): Promise<IntegrationLease | { state: string } | null> {
    actor = integrationWorker(actor);
    requireUuid(intakeId);
    intakeId = intakeId.toLowerCase();
    return this.source.transaction(async (m) => {
      const verify = await integrationGrant(m, actor, 'PROCESS_INTAKE');
      const [row] = await m.query(
        "SELECT * FROM finance_integration_intakes WHERE tenant_id=$1 AND id=$2 AND ((state IN ('PENDING','RETRY_WAIT') AND next_attempt_at<=statement_timestamp()) OR (state='LEASED' AND lease_until<=statement_timestamp())) FOR UPDATE SKIP LOCKED",
        [actor.tenantId, intakeId],
      );
      if (!row) return null;
      let profile;
      try {
        await this.currentChannel(m, row);
        profile = await integrationProfile(m, row.channel_snapshot);
      } catch {
        await this.finish(
          m,
          actor,
          row,
          'HELD',
          'INTEGRATION_PROFILE_OR_CHANNEL_UNAVAILABLE',
        );
        await verify();
        return { state: 'HELD' };
      }
      if (
        row.attempt_count >=
        (await referenceAttemptCeiling(
          m,
          actor.tenantId,
          'INTAKE',
          row.id,
          profile.maxAttempts,
        ))
      ) {
        await this.finish(
          m,
          actor,
          row,
          'DEAD_LETTER',
          'PROCESSING_ATTEMPTS_EXHAUSTED',
        );
        await verify();
        return { state: 'DEAD_LETTER' };
      }
      const token = randomUUID();
      const [claimed] = await m.query(
        "WITH changed AS(UPDATE finance_integration_intakes SET state='LEASED',version=version+1,attempt_count=attempt_count+1,lease_token=$3,lease_subject_id=$4,lease_until=statement_timestamp()+$5*interval '1 second',reason_code='PROCESSING_LEASED' WHERE tenant_id=$1 AND id=$2 RETURNING *) SELECT * FROM changed",
        [actor.tenantId, row.id, token, actor.subjectId, profile.leaseSeconds],
      );
      await integrationAudit(m, {
        tenantId: actor.tenantId,
        kind: 'intake',
        id: row.id,
        action: 'PROCESSING_LEASED',
        version: claimed.version,
        leaseToken: token,
        actor: actor.subjectId,
        hash: row.raw_hash,
        reason: 'PROCESSING_LEASED',
      });
      await verify();
      return { id: row.id, token, version: claimed.version };
    });
  }
  async process(actor: IntegrationWorker, claim: IntegrationLease) {
    actor = integrationWorker(actor);
    claim = integrationLease(claim);
    try {
      return await this.source.transaction(async (m) => {
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          'finance-inactive-config:' + actor.tenantId,
        ]);
        const verifies = [await integrationGrant(m, actor, 'PROCESS_INTAKE')];
        const intake = await checkLease(
          m,
          'finance_integration_intakes',
          actor,
          claim,
        );
        await this.currentChannel(m, intake);
        const profile = await integrationProfile(m, intake.channel_snapshot);
        if (
          !Buffer.isBuffer(intake.raw_body) ||
          sourceByteHash(intake.raw_body) !== intake.raw_hash ||
          typeof intake.signature_input !== 'string' ||
          sourceByteHash(Buffer.from(intake.signature_input)) !==
            intake.signature_hash
        )
          throw new BadRequestException('Captured source evidence differs.');
        const channel = intake.channel_snapshot;
        const preview = await this.previews.previewInTransaction(
          m,
          {
            kind: 'WORKER',
            tenantId: channel.tenant_id,
            subjectId: channel.producer_subject_id,
            producerId: channel.producer_id,
          },
          intake.raw_body,
          intake.signature_input,
        );
        const outboxIds: string[] = [];
        for (const target of preview.destinations) {
          verifies.push(
            await integrationGrant(m, actor, 'PROCESS_INBOX', {
              legalEntityId: target.legalEntityId,
              bookId: target.bookId,
            }),
          );
          const [old] = await m.query(
            'SELECT * FROM finance_integration_inboxes WHERE tenant_id=$1 AND book_id=$2 AND preview_id=$3',
            [actor.tenantId, target.bookId, preview.previewId],
          );
          if (old) {
            const [message] = await m.query(
              'SELECT * FROM finance_reference_outbox WHERE inbox_id=$1',
              [old.id],
            );
            if (
              old.semantic_hash !== preview.semanticHash ||
              old.target_hash !== financeConfigurationHash(target) ||
              old.consumer_id !== profile.consumerId ||
              !message ||
              message.payload_hash !== financeConfigurationHash(message.payload)
            )
              throw new ConflictException(
                'Canonical inbox or outcome differs; a new delivery cannot create another effect.',
              );
            outboxIds.push(message.id);
            continue;
          }
          const [inbox] = await m.query(
            `INSERT INTO finance_integration_inboxes(tenant_id,legal_entity_id,book_id,preview_id,semantic_hash,target_hash,first_intake_id,profile_id,profile_hash,consumer_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [
              actor.tenantId,
              target.legalEntityId,
              target.bookId,
              preview.previewId,
              preview.semanticHash,
              financeConfigurationHash(target),
              intake.id,
              channel.profile_id,
              channel.profile_hash,
              profile.consumerId,
            ],
          );
          const [disposition] = await m.query(
            "INSERT INTO finance_reference_dispositions(tenant_id,legal_entity_id,book_id,inbox_id,owner_reference,reason_code,accounting_state,financial_effects,subject_hash) VALUES($1,$2,$3,$4,$5,'UNRESOLVED_ACCOUNTING_POLICIES','HELD_INACTIVE',0,$6) RETURNING id",
            [
              actor.tenantId,
              target.legalEntityId,
              target.bookId,
              inbox.id,
              intake.owner_reference,
              preview.semanticHash,
            ],
          );
          const messageId = randomUUID(),
            payload: ReferenceOutcome = {
              schema: 'FINANCE_REFERENCE_OUTCOME_V1',
              messageId,
              inboxId: inbox.id,
              dispositionId: disposition.id,
              previewId: preview.previewId,
              semanticHash: preview.semanticHash,
              tenantId: actor.tenantId,
              legalEntityId: target.legalEntityId,
              bookId: target.bookId,
              accountingState: 'HELD_INACTIVE',
              financialEffects: 0,
            };
          const payloadHash = financeConfigurationHash(payload);
          await m.query(
            `INSERT INTO finance_reference_outbox(id,tenant_id,legal_entity_id,book_id,inbox_id,profile_id,profile_hash,control_entity_id,control_book_id,consumer_id,contract,payload,payload_hash,owner_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)`,
            [
              messageId,
              actor.tenantId,
              target.legalEntityId,
              target.bookId,
              inbox.id,
              channel.profile_id,
              channel.profile_hash,
              channel.legal_entity_id,
              channel.book_id,
              profile.consumerId,
              REFERENCE_OUTCOME_CONTRACT,
              canonicalFinanceJson(payload),
              payloadHash,
              intake.owner_reference,
            ],
          );
          await integrationAudit(m, {
            tenantId: actor.tenantId,
            legalEntityId: target.legalEntityId,
            bookId: target.bookId,
            kind: 'inbox',
            id: inbox.id,
            action: 'REFERENCE_HELD',
            version: 1,
            actor: actor.subjectId,
            hash: preview.semanticHash,
            reason: 'UNRESOLVED_ACCOUNTING_POLICIES',
          });
          await integrationAudit(m, {
            tenantId: actor.tenantId,
            legalEntityId: target.legalEntityId,
            bookId: target.bookId,
            kind: 'outbox',
            id: messageId,
            action: 'OUTCOME_ENQUEUED',
            version: 1,
            actor: actor.subjectId,
            hash: payloadHash,
            reason: 'PENDING_DELIVERY',
          });
          outboxIds.push(messageId);
        }
        await this.finish(
          m,
          actor,
          intake,
          'DISPOSITION_RECORDED',
          'UNRESOLVED_ACCOUNTING_POLICIES',
          preview.previewId,
          claim,
        );
        for (const verify of verifies) await verify();
        await this.currentChannel(m, intake);
        return {
          intakeId: intake.id,
          state: 'DISPOSITION_RECORDED',
          accountingState: 'HELD_INACTIVE',
          outboxIds,
          financialEffects: 0,
        };
      });
    } catch (error) {
      // This transaction is deliberately separate from the rolled-back work.
      // Failure to record a failure propagates; no fabricated state is returned.
      return this.source.transaction(async (m) => {
        const verify = await integrationGrant(m, actor, 'PROCESS_INTAKE');
        const row = await checkLease(
          m,
          'finance_integration_intakes',
          actor,
          claim,
        );
        const reason =
          error instanceof BadRequestException
            ? 'MALFORMED_SOURCE'
            : error instanceof ForbiddenException
              ? 'AUTHORITY_OR_SIGNATURE_REJECTED'
              : error instanceof ConflictException
                ? 'SOURCE_OR_CONFIGURATION_CONFLICT'
                : 'PROCESSING_FAILED';
        let profile;
        try {
          profile = await integrationProfile(m, row.channel_snapshot);
        } catch {
          profile = null;
        }
        const terminal =
          reason !== 'PROCESSING_FAILED' || !profile
            ? 'HELD'
            : row.attempt_count >=
                (await referenceAttemptCeiling(
                  m,
                  actor.tenantId,
                  'INTAKE',
                  row.id,
                  profile.maxAttempts,
                ))
              ? 'DEAD_LETTER'
              : 'RETRY_WAIT';
        await this.finish(
          m,
          actor,
          row,
          terminal,
          reason,
          undefined,
          claim,
          profile?.retryDelaySeconds ?? 0,
        );
        await verify();
        return {
          intakeId: row.id,
          state: terminal,
          reason,
          accountingState: 'HELD_INACTIVE',
          financialEffects: 0,
        };
      });
    }
  }
  private async channel(m: EntityManager, id: string, subject: string) {
    const [row] = await m.query(
      "SELECT * FROM finance_integration_channels WHERE id=$1 AND ingress_subject_id=$2 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE",
      [id, subject],
    );
    if (!row)
      throw new ForbiddenException(
        'Current registered ingress-channel authority is required.',
      );
    return row;
  }
  private async currentChannel(
    m: EntityManager,
    intake: {
      channel_id: string;
      channel_hash: string;
      channel_snapshot: { ingress_subject_id: string };
    },
  ) {
    const current = await this.channel(
      m,
      intake.channel_id,
      intake.channel_snapshot.ingress_subject_id,
    );
    if (channelHash(current) !== intake.channel_hash)
      throw new ForbiddenException('Captured ingress binding changed.');
  }
  private async finish(
    m: EntityManager,
    actor: IntegrationWorker,
    row: Record<string, any>,
    state: string,
    reason: string,
    previewId?: string,
    lease?: IntegrationLease,
    delay = 0,
  ) {
    const [updated] = await m.query(
      `WITH changed AS(UPDATE finance_integration_intakes SET state=$3,version=version+1,lease_token=NULL,lease_subject_id=NULL,lease_until=NULL,reason_code=$4,preview_id=$5,next_attempt_at=statement_timestamp()+$6*interval '1 second' WHERE tenant_id=$1 AND id=$2 ${lease ? "AND state='LEASED' AND lease_token=$7 AND version=$8 AND lease_subject_id=$9 AND lease_until>statement_timestamp()" : ''} RETURNING *) SELECT * FROM changed`,
      [
        actor.tenantId,
        row.id,
        state,
        reason,
        previewId ?? null,
        delay,
        ...(lease ? [lease.token, lease.version, actor.subjectId] : []),
      ],
    );
    if (!updated)
      throw new ConflictException(
        'Intake lease expired before checkpoint commit.',
      );
    await integrationAudit(m, {
      tenantId: actor.tenantId,
      kind: 'intake',
      id: row.id,
      action: state,
      version: updated.version,
      leaseToken: lease?.token,
      actor: actor.subjectId,
      hash: row.raw_hash,
      reason,
    });
  }
}
