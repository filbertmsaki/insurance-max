import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { EntityManager } from 'typeorm';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
  isFinanceDate,
} from './finance-configuration.types';
import { MAX_SOURCE_EVENT_BYTES, sourceByteHash } from './finance-event.types';
import { prepareSetupDimensionMaster } from './finance-setup-dimension-master';
import { assertSourceSnapshotCoverage } from './finance-source-snapshot-coverage';

/** Generates exact signed bytes from a rechecked company-owned reviewed master. */
export async function preparePortalSourceAttestation(
  m: EntityManager,
  input: {
    tenantId: string;
    legalEntityId: string;
    bookId: string;
    companyId: string;
    masterId: string;
    masterHash: string;
    actorSubjectId: string;
    actorPersonId: string;
    authorityId: string;
    reason: string;
  },
  release: {
    payload: Record<string, any>;
    effective_from: string;
    effective_to: string | null;
  },
) {
  const keyId = process.env.FINANCE_SOURCE_ATTESTATION_KEY_ID;
  const producerId = process.env.FINANCE_SOURCE_ATTESTATION_PRODUCER_ID;
  const expectedFingerprint =
    process.env.FINANCE_SOURCE_ATTESTATION_PUBLIC_FINGERPRINT;
  const privatePem = process.env.FINANCE_SOURCE_ATTESTATION_PRIVATE_KEY;
  if (
    !keyId ||
    !FINANCE_UUID.test(keyId) ||
    keyId !== keyId.toLowerCase() ||
    !producerId ||
    !/^[A-Z0-9][A-Z0-9_.:-]{0,79}$/.test(producerId) ||
    !expectedFingerprint ||
    !/^[0-9a-f]{64}$/.test(expectedFingerprint) ||
    !privatePem
  )
    throw new ForbiddenException(
      'A configured scoped source signer is required.',
    );
  let key;
  try {
    key = createPrivateKey(privatePem);
    const publicKey = createPublicKey(key);
    if (
      key.asymmetricKeyType !== 'ed25519' ||
      sourceByteHash(publicKey.export({ type: 'spki', format: 'der' })) !==
        expectedFingerprint
    )
      throw new Error('invalid signer');
  } catch {
    throw new ForbiddenException(
      'Configured source signer does not match its public fingerprint.',
    );
  }
  await prepareSetupDimensionMaster(
    m,
    input.companyId,
    release.payload,
    release.effective_from,
    release.effective_to,
    false,
  );
  const master = release.payload.companyMaster;
  if (
    !master ||
    master.snapshot?.companyId !== input.companyId.toLowerCase() ||
    !Array.isArray(master.snapshot.branches) ||
    !Array.isArray(master.snapshot.products)
  )
    throw new ForbiddenException(
      'An exact company-owned source master is required.',
    );
  const branches = master.snapshot.branches.map((row: any) => ({
    id: row.id,
    code: row.code,
    status: row.status,
  }));
  const products = master.snapshot.products.map((row: any) => ({
    id: row.id,
    productCode: row.product_code,
    active: row.is_active,
    lifecycleStatus: row.lifecycle_status,
    versionId: row.current_version_id,
    versionStatus: row.version_status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    definitionHash: row.definition_hash,
  }));
  if (
    products.some(
      (row: any) =>
        !isFinanceDate(row.effectiveFrom) ||
        typeof row.definitionHash !== 'string' ||
        !/^[0-9a-f]{64}$/.test(row.definitionHash),
    )
  )
    throw new BadRequestException(
      'Every selected source product needs an effective date and exact definition hash.',
    );
  await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `finance-portal-attestation:${input.tenantId}:${input.companyId}`,
  ]);
  const reviewedMasters = await m.query(
    `SELECT payload,effective_from::text AS start_date,effective_to::text AS end_date FROM finance_configuration_releases WHERE tenant_id=$1 AND kind='DIMENSIONS' AND state='REVIEWED_INACTIVE' AND effective_from<=statement_timestamp()::date AND (effective_to IS NULL OR effective_to>statement_timestamp()::date) AND payload->'companyMaster'->'snapshot'->>'companyId'=$2 FOR SHARE`,
    [input.tenantId, input.companyId.toLowerCase()],
  );
  for (const reviewed of reviewedMasters)
    await prepareSetupDimensionMaster(
      m,
      input.companyId,
      reviewed.payload,
      reviewed.start_date,
      reviewed.end_date,
      false,
    );
  assertSourceSnapshotCoverage(
    master.snapshot,
    reviewedMasters.map((row: any) => row.payload.companyMaster.snapshot),
  );
  const [latest] = await m.query(
    'SELECT o.revision,r.id AS receipt_id FROM finance_source_attestation_outbox o LEFT JOIN finance_source_delivery_receipts r ON r.outbox_id=o.id WHERE o.tenant_id=$1 AND o.source_company_id=$2 ORDER BY o.revision DESC LIMIT 1',
    [input.tenantId, input.companyId],
  );
  if (latest && !latest.receipt_id)
    throw new ConflictException(
      'The previous source attestation requires verified delivery reconciliation before another revision.',
    );
  const revision = (latest?.revision ?? 0) + 1;
  if (revision > 2147483647)
    throw new BadRequestException('Source attestation revision limit reached.');
  const [clock] = await m.query('SELECT statement_timestamp() AS now');
  const issuedAt = clock.now.toISOString(),
    expiresAt = new Date(clock.now.getTime() + 15 * 60000).toISOString();
  const body = Buffer.from(
    canonicalFinanceJson({
      schema: 'FINANCE_COMPANY_SOURCE_ATTESTATION_V1',
      tenantId: input.tenantId,
      companyId: input.companyId,
      keyId,
      producerId,
      revision,
      issuedAt,
      expiresAt,
      branches,
      products,
    }),
    'utf8',
  );
  if (body.length > MAX_SOURCE_EVENT_BYTES)
    throw new BadRequestException(
      'Source attestation exceeds the supported size.',
    );
  const signature = sign(null, body, key).toString('base64'),
    hash = sourceByteHash(body);
  const [row] = await m.query(
    `INSERT INTO finance_source_attestation_outbox(tenant_id,legal_entity_id,book_id,source_company_id,revision,key_id,producer_id,master_release_id,master_release_hash,actor_subject_id,actor_natural_person_id,authority_id,issued_at,expires_at,raw_body,raw_hash,signature_base64,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
    [
      input.tenantId,
      input.legalEntityId,
      input.bookId,
      input.companyId,
      revision,
      keyId,
      producerId,
      input.masterId,
      input.masterHash,
      input.actorSubjectId,
      input.actorPersonId,
      input.authorityId,
      issuedAt,
      expiresAt,
      body,
      hash,
      signature,
      input.reason,
    ],
  );
  return {
    id: row.id,
    revision,
    rawHash: hash,
    bodyBase64: body.toString('base64'),
    signature,
    issuedAt,
    expiresAt,
    postingAuthorized: false,
  };
}
