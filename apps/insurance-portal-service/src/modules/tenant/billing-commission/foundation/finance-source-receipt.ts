import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { FINANCE_UUID } from './finance-configuration.types';
import { parseSourceJson, sourceByteHash } from './finance-event.types';
import { approvalFields } from './finance-approval.types';

/** Store a signed receiver receipt only when it binds the exact immutable outbox revision. */
export async function reconcileSourceReceipt(
  m: EntityManager,
  scope: {
    tenantId: string;
    legalEntityId: string;
    bookId: string;
    companyId: string;
  },
  id: string,
  bodyBase64: string,
  signatureBase64: string,
) {
  if (
    typeof bodyBase64 !== 'string' ||
    bodyBase64.length > 16384 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(bodyBase64) ||
    typeof signatureBase64 !== 'string' ||
    !/^[A-Za-z0-9+/]{86}==$/.test(signatureBase64)
  )
    throw new BadRequestException(
      'Canonical signed receipt evidence is required.',
    );
  const body = Buffer.from(bodyBase64, 'base64'),
    signature = Buffer.from(signatureBase64, 'base64');
  if (
    !body.length ||
    body.toString('base64') !== bodyBase64 ||
    signature.length !== 64 ||
    signature.toString('base64') !== signatureBase64
  )
    throw new BadRequestException(
      'Canonical signed receipt evidence is required.',
    );
  const p = parseSourceJson(body);
  approvalFields(p, [
    'schema',
    'status',
    'receiptId',
    'tenantId',
    'companyId',
    'keyId',
    'revision',
    'rawHash',
    'receivedAt',
    'issuerFingerprint',
  ]);
  if (
    p.schema !== 'FINANCE_SOURCE_RECEIPT_V1' ||
    p.status !== 'ACCEPTED' ||
    typeof p.receiptId !== 'string' ||
    !FINANCE_UUID.test(p.receiptId) ||
    typeof p.tenantId !== 'string' ||
    !FINANCE_UUID.test(p.tenantId) ||
    typeof p.companyId !== 'string' ||
    !FINANCE_UUID.test(p.companyId) ||
    typeof p.keyId !== 'string' ||
    !FINANCE_UUID.test(p.keyId) ||
    !Number.isInteger(p.revision) ||
    Number(p.revision) < 1 ||
    typeof p.rawHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(p.rawHash) ||
    typeof p.receivedAt !== 'string' ||
    !Number.isFinite(Date.parse(p.receivedAt)) ||
    new Date(p.receivedAt).toISOString() !== p.receivedAt ||
    typeof p.issuerFingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/.test(p.issuerFingerprint)
  )
    throw new BadRequestException('Exact source receipt fields are required.');
  let valid = false;
  try {
    const key = createPublicKey(
      process.env.FINANCE_SOURCE_RECEIPT_PUBLIC_KEY ?? '',
    );
    const fingerprint = sourceByteHash(
      key.export({ type: 'spki', format: 'der' }),
    );
    valid =
      key.asymmetricKeyType === 'ed25519' &&
      fingerprint === process.env.FINANCE_SOURCE_RECEIPT_PUBLIC_FINGERPRINT &&
      fingerprint === p.issuerFingerprint &&
      verify(null, body, key, signature);
  } catch {
    valid = false;
  }
  if (!valid)
    throw new ForbiddenException(
      'A trusted Finance receipt signature is required.',
    );
  await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `finance-portal-attestation:${scope.tenantId}:${scope.companyId}`,
  ]);
  const [outbox] = await m.query(
    'SELECT * FROM finance_source_attestation_outbox WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND id=$5 FOR SHARE',
    [scope.tenantId, scope.legalEntityId, scope.bookId, scope.companyId, id],
  );
  if (
    !outbox ||
    outbox.tenant_id !== p.tenantId ||
    outbox.source_company_id !== p.companyId ||
    outbox.key_id !== p.keyId ||
    outbox.revision !== p.revision ||
    outbox.raw_hash !== p.rawHash ||
    sourceByteHash(outbox.raw_body) !== outbox.raw_hash
  )
    throw new ForbiddenException(
      'Receipt does not match the exact company source revision.',
    );
  const [existing] = await m.query(
    'SELECT * FROM finance_source_delivery_receipts WHERE outbox_id=$1',
    [id],
  );
  if (existing) {
    if (
      existing.receipt_id !== p.receiptId ||
      existing.source_hash !== p.rawHash ||
      existing.tenant_id !== p.tenantId ||
      existing.source_company_id !== p.companyId ||
      existing.revision !== p.revision
    )
      throw new ConflictException(
        'A different source receipt was already recorded.',
      );
    return {
      outboxId: id,
      receiptId: existing.receipt_id,
      revision: existing.revision,
      reused: true,
      postingAuthorized: false,
    };
  }
  await m.query(
    `INSERT INTO finance_source_delivery_receipts(outbox_id,receipt_id,tenant_id,source_company_id,revision,source_hash,receipt_body,receipt_hash,signature_base64,issuer_fingerprint,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      p.receiptId,
      p.tenantId,
      p.companyId,
      p.revision,
      p.rawHash,
      body,
      sourceByteHash(body),
      signatureBase64,
      p.issuerFingerprint,
      p.receivedAt,
    ],
  );
  return {
    outboxId: id,
    receiptId: p.receiptId,
    revision: p.revision,
    reused: false,
    postingAuthorized: false,
  };
}
