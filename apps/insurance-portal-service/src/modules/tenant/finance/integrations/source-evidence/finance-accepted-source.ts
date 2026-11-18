import { ConflictException, ForbiddenException } from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import {
  normalizeSourceEnvelope,
  sourceByteHash,
  sourceEventHashes,
  validateEventContract,
} from '../../accounting/accounting-events/finance-event.types';
import type { IntegrationScope } from '../finance-events/finance-integration.types';
/** Re-verify accepted historical signed bytes, codec and exact book target. Never fetch arbitrary source URLs. */
export async function verifyAcceptedSource(
  m: EntityManager,
  p: { tenantId: string },
  s: IntegrationScope,
  inboxId: string,
  expected: {
    eventType: string;
    factKind: string;
    aggregateType: string;
    aggregateId: string;
    companyId: string;
    revision: number;
    snapshotHash: string;
  },
  deliveryId: string | null = null,
) {
  const [b] = await m.query(
    'SELECT i.*,s.source_system,s.economic_root,s.source_revision,s.previous_preview_id,s.subject AS preview_subject,s.target_manifest,s.target_hash AS preview_target_hash,d.id AS delivery_id,d.raw_body,d.raw_hash,d.signature_base64,d.signature_hash,d.key_snapshot,d.key_hash,d.event_hash,c.payload AS contract,c.dependency_refs,c.release_hash AS contract_hash,t.contract_hash AS pinned_contract_hash FROM finance_integration_inboxes i JOIN finance_source_event_previews s ON s.id=i.preview_id AND s.tenant_id=i.tenant_id JOIN finance_source_event_preview_targets t ON t.preview_id=s.id AND t.tenant_id=i.tenant_id AND t.legal_entity_id=i.legal_entity_id AND t.book_id=i.book_id JOIN finance_configuration_releases c ON c.id=t.contract_id JOIN finance_source_event_preview_deliveries d ON d.preview_id=s.id AND d.tenant_id=i.tenant_id JOIN finance_reference_dispositions h ON h.inbox_id=i.id WHERE i.tenant_id=$1 AND i.legal_entity_id=$2 AND i.book_id=$3 AND i.id=$4 AND ($5::uuid IS NULL OR d.id=$5) ORDER BY d.id LIMIT 1',
    [p.tenantId, s.legalEntityId, s.bookId, inboxId, deliveryId],
  );
  if (!b)
    throw new ForbiddenException(
      'An accepted held quotation source is required in the exact book.',
    );
  const event = normalizeSourceEnvelope(b.raw_body),
    contract = validateEventContract(b.contract, b.dependency_refs),
    eventHashes = sourceEventHashes(event, contract);
  let signatureValid = false;
  try {
    const key = createPublicKey(b.key_snapshot.public_key_pem);
    signatureValid =
      key.asymmetricKeyType === 'ed25519' &&
      sourceByteHash(key.export({ format: 'der', type: 'spki' })) ===
        b.key_snapshot.key_fingerprint &&
      verify(null, b.raw_body, key, Buffer.from(b.signature_base64, 'base64'));
  } catch {
    signatureValid = false;
  }
  if (
    !signatureValid ||
    sourceByteHash(b.raw_body) !== b.raw_hash ||
    sourceByteHash(Buffer.from(b.signature_base64, 'base64')) !==
      b.signature_hash ||
    hash(b.key_snapshot) !== b.key_hash ||
    event.tenant_id !== p.tenantId ||
    b.key_snapshot.tenant_id !== p.tenantId ||
    event.key_id !== b.key_snapshot.id ||
    event.producer_id !== b.key_snapshot.producer_id ||
    event.source_system !== b.key_snapshot.source_system ||
    event.source_company_id !== b.key_snapshot.source_company_id ||
    event.event_type !== expected.eventType ||
    contract.eventType !== expected.eventType ||
    contract.factKind !== expected.factKind ||
    contract.aggregateType !== expected.aggregateType ||
    event.aggregate.type !== expected.aggregateType ||
    event.aggregate.id !== expected.aggregateId ||
    event.source_company_id !== expected.companyId ||
    event.aggregate.revision !== expected.revision ||
    event.payload.snapshot_hash !== expected.snapshotHash ||
    b.contract_hash !== b.pinned_contract_hash ||
    eventHashes.root !== b.economic_root ||
    eventHashes.semantic !== b.semantic_hash ||
    eventHashes.event !== b.event_hash ||
    hash(b.preview_subject) !== b.semantic_hash ||
    hash(b.target_manifest) !== b.preview_target_hash ||
    hash(
      b.target_manifest.find(
        (t: Record<string, unknown>) =>
          t.bookId === s.bookId && t.legalEntityId === s.legalEntityId,
      ),
    ) !== b.target_hash
  )
    throw new ConflictException(
      'Quotation snapshot, signature or original source binding differs.',
    );
  return b;
}
