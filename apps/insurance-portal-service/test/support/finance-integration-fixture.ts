import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createEventFixture } from './finance-event-fixture';
import { FinanceIntakeService } from '../../src/modules/tenant/finance/accounting/accounting-events/finance-intake.service';
import { FinanceReferenceDeliveryService } from '../../src/modules/tenant/finance/integrations/finance-events/finance-reference-delivery.service';
import {
  REFERENCE_OUTCOME_CONTRACT,
  type IntegrationLease,
  type IntegrationWorker,
  type FinanceReferenceTransport,
  type ReferenceAcknowledgement,
} from '../../src/modules/tenant/finance/integrations/finance-events/finance-integration.types';
export function requireLease(
  value: IntegrationLease | { state: string } | null,
): IntegrationLease {
  if (!value || !('token' in value))
    throw new Error('Expected an actual scoped integration lease');
  return value;
}
export async function createIntegrationFixture(
  source: DataSource,
  options: {
    leaseSeconds?: number;
    maxAttempts?: number;
    retryDelaySeconds?: number;
    eventContract?: {
      eventType: string;
      aggregateType: string;
      factKind: string;
    };
  } = {},
) {
  const f = await createEventFixture(source, {
    contract: options.eventContract,
  });
  const profile = await f.review(0, {
    kind: 'INTEGRATION_RULES',
    key: 'SYNTHETIC-RELIABILITY',
    payload: {
      schema: 'FINANCE_INTEGRATION_RULES_V1',
      purpose: 'INACTIVE_REFERENCE_ONLY',
      handler: 'HOLD_REFERENCE_V1',
      leaseSeconds: options.leaseSeconds ?? 30,
      maxAttempts: options.maxAttempts ?? 3,
      retryDelaySeconds: options.retryDelaySeconds ?? 0,
      consumerId: 'SYNTHETIC_REFERENCE_CONSUMER',
    },
  });
  const worker: IntegrationWorker = {
    kind: 'WORKER',
    tenantId: f.tenantId,
    subjectId: randomUUID(),
  };
  const ingress = { kind: 'WORKER' as const, subjectId: randomUUID() };
  const [channel] = await source.query(
    `INSERT INTO finance_integration_channels(ingress_subject_id,tenant_id,producer_id,producer_subject_id,legal_entity_id,book_id,profile_id,profile_hash,owner_reference,version,state,valid_from) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'SYNTHETIC-INTEGRATION-OWNER',1,'ENABLED','2020-01-01') RETURNING *`,
    [
      ingress.subjectId,
      f.tenantId,
      f.principal.producerId,
      f.principal.subjectId,
      f.entity.id,
      f.books[0].id,
      profile.id,
      profile.release_hash,
    ],
  );
  const grant = async (
    permission: string,
    bookIndex?: number,
    who = worker,
  ) => {
    const [r] = await source.query(
      `INSERT INTO finance_integration_authorities(tenant_id,legal_entity_id,book_id,subject_id,permission,consumer_id,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-ONLY','2020-01-01') RETURNING *`,
      [
        f.tenantId,
        bookIndex === undefined ? null : f.entity.id,
        bookIndex === undefined ? null : f.books[bookIndex].id,
        who.subjectId,
        permission,
        permission === 'RECEIVE_OUTCOME'
          ? 'SYNTHETIC_REFERENCE_CONSUMER'
          : null,
      ],
    );
    return r;
  };
  await grant('PROCESS_INTAKE');
  for (const [i] of f.books.entries())
    for (const p of [
      'PROCESS_INBOX',
      'DELIVER_OUTBOX',
      'RECEIVE_OUTCOME',
      'READ_RECONCILIATION',
    ])
      await grant(p, i);
  const intake = new FinanceIntakeService(source, f.service),
    receiver = new FinanceReferenceDeliveryService(source);
  const calls: { messageId: string; payloadHash: string }[] = [];
  const accept: FinanceReferenceTransport['send'] = async (message) =>
    receiver.receiveInactive(
      worker,
      {
        legalEntityId: message.payload.legalEntityId,
        bookId: message.payload.bookId,
      },
      'SYNTHETIC_REFERENCE_CONSUMER',
      message.messageId,
      message.payloadHash,
      message.payload,
    );
  let implementation: FinanceReferenceTransport['send'] = accept;
  const transport: FinanceReferenceTransport = {
    consumerId: 'SYNTHETIC_REFERENCE_CONSUMER',
    contract: REFERENCE_OUTCOME_CONTRACT,
    send: async (message) => {
      calls.push({
        messageId: message.messageId,
        payloadHash: message.payloadHash,
      });
      return implementation(message);
    },
  };
  const delivery = new FinanceReferenceDeliveryService(source, [transport]);
  const setSend = (send: FinanceReferenceTransport['send']) => {
    implementation = send;
  };
  const capture = async (p = f.envelope(), receiptKey = randomUUID()) => {
    const signed = f.signed(p);
    return intake.capture(
      ingress,
      channel.id,
      receiptKey,
      signed.body,
      signed.signature,
    );
  };
  const process = async () => {
    const captured = await capture();
    const claim = requireLease(await intake.claim(worker, captured.intakeId));
    return intake.process(worker, claim);
  };
  const deliver = async (index = 0) => {
    const claim = requireLease(await delivery.claim(worker, f.scope(index)));
    return delivery.deliver(worker, f.scope(index), claim);
  };
  return {
    ...f,
    profile,
    worker,
    ingress,
    channel,
    grant,
    intake,
    receiver,
    delivery,
    transport,
    setSend,
    calls,
    capture,
    process,
    deliver,
    accept,
  };
}
