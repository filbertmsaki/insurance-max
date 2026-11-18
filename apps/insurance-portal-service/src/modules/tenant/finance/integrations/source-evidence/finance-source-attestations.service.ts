import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  FINANCE_UUID,
  canonicalFinanceJson,
  financeConfigurationHash,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  parseSourceJson,
  sourceByteHash,
} from '../../accounting/accounting-events/finance-event.types';
import { approvalFields } from '../../governance/finance-approvals/finance-approval.types';
import { verifyReviewedDimensionMaster } from '../../foundation/accounting-dimensions/finance-reviewed-dimension-master';

/** Accepts only signed, scoped source evidence. It grants no Finance or posting authority. */
@Injectable()
export class FinanceSourceAttestationsService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  async ingest(
    rawBody: Buffer,
    signatureBase64: string,
    archiveExpired = false,
  ) {
    const body = Buffer.isBuffer(rawBody) ? Buffer.from(rawBody) : rawBody;
    const p = parseSourceJson(body);
    approvalFields(p, [
      'schema',
      'tenantId',
      'companyId',
      'keyId',
      'producerId',
      'revision',
      'issuedAt',
      'expiresAt',
      'branches',
      'products',
    ]);
    const uuid = (x: unknown): x is string =>
      typeof x === 'string' && FINANCE_UUID.test(x) && x === x.toLowerCase();
    const instant = (x: unknown): x is string =>
      typeof x === 'string' &&
      Number.isFinite(Date.parse(x)) &&
      new Date(x).toISOString() === x;
    if (
      p.schema !== 'FINANCE_COMPANY_SOURCE_ATTESTATION_V1' ||
      !uuid(p.tenantId) ||
      !uuid(p.companyId) ||
      !uuid(p.keyId) ||
      typeof p.producerId !== 'string' ||
      !/^[A-Z0-9][A-Z0-9_.:-]{0,79}$/.test(p.producerId) ||
      !Number.isInteger(p.revision) ||
      Number(p.revision) < 1 ||
      Number(p.revision) > 2147483647 ||
      !instant(p.issuedAt) ||
      !instant(p.expiresAt) ||
      Date.parse(p.expiresAt) <= Date.parse(p.issuedAt) ||
      Date.parse(p.expiresAt) - Date.parse(p.issuedAt) > 86400000 ||
      !Array.isArray(p.branches) ||
      !Array.isArray(p.products) ||
      p.branches.length + p.products.length > 10000
    )
      throw new BadRequestException(
        'A bounded, scoped source attestation is required.',
      );
    const seen = new Set<string>();
    for (const branch of p.branches) {
      approvalFields(branch, ['id', 'code', 'status']);
      if (
        !uuid(branch.id) ||
        seen.has('B:' + branch.id) ||
        typeof branch.code !== 'string' ||
        !branch.code.trim() ||
        branch.code !== branch.code.trim() ||
        branch.code.length > 50 ||
        !['active', 'inactive'].includes(String(branch.status))
      )
        throw new BadRequestException('Invalid source branch evidence.');
      seen.add('B:' + branch.id);
    }
    for (const product of p.products) {
      approvalFields(product, [
        'id',
        'productCode',
        'active',
        'lifecycleStatus',
        'versionId',
        'versionStatus',
        'effectiveFrom',
        'effectiveTo',
        'definitionHash',
      ]);
      if (
        !uuid(product.id) ||
        seen.has('P:' + product.id) ||
        typeof product.productCode !== 'string' ||
        !product.productCode.trim() ||
        product.productCode !== product.productCode.trim() ||
        product.productCode.length > 50 ||
        typeof product.active !== 'boolean' ||
        !['ACTIVE', 'DRAFT', 'RETIRED'].includes(
          String(product.lifecycleStatus),
        ) ||
        !uuid(product.versionId) ||
        !['ACTIVE', 'PUBLISHED', 'DRAFT', 'RETIRED'].includes(
          String(product.versionStatus),
        ) ||
        !isFinanceDate(product.effectiveFrom) ||
        (product.effectiveTo !== null &&
          (!isFinanceDate(product.effectiveTo) ||
            product.effectiveTo <= product.effectiveFrom)) ||
        typeof product.definitionHash !== 'string' ||
        !/^[0-9a-f]{64}$/.test(product.definitionHash)
      )
        throw new BadRequestException('Invalid source product evidence.');
      seen.add('P:' + product.id);
    }
    if (
      typeof signatureBase64 !== 'string' ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signatureBase64)
    )
      throw new ForbiddenException(
        'A canonical Ed25519 signature is required.',
      );
    const signature = Buffer.from(signatureBase64, 'base64');
    if (
      signature.length !== 64 ||
      signature.toString('base64') !== signatureBase64
    )
      throw new ForbiddenException(
        'A canonical Ed25519 signature is required.',
      );
    return this.source.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `finance-source-attestation:${p.tenantId}:${p.companyId}`,
      ]);
      const rawHash = sourceByteHash(body);
      const [existing] = await m.query(
        'SELECT id,raw_hash,signature_base64 FROM finance_source_attestations WHERE tenant_id=$1 AND source_company_id=$2 AND revision=$3',
        [p.tenantId, p.companyId, p.revision],
      );
      if (existing) {
        if (
          existing.raw_hash !== rawHash ||
          existing.signature_base64 !== signatureBase64
        )
          throw new ConflictException(
            'Source revision already has different signed bytes.',
          );
        return {
          id: existing.id,
          rawHash,
          reused: true,
          postingAuthorized: false,
        };
      }
      const [key] = await m.query(
        `SELECT * FROM finance_source_attestation_keys WHERE id=$1 AND tenant_id=$2 AND source_company_id=$3 AND producer_id=$4 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE`,
        [p.keyId, p.tenantId, p.companyId, p.producerId],
      );
      if (!key)
        throw new ForbiddenException(
          'Current company-scoped source signing authority is required.',
        );
      let valid = false;
      try {
        const publicKey = createPublicKey(key.public_key_pem);
        valid =
          publicKey.asymmetricKeyType === 'ed25519' &&
          sourceByteHash(publicKey.export({ format: 'der', type: 'spki' })) ===
            key.key_fingerprint &&
          verify(null, body, publicKey, signature);
      } catch {
        valid = false;
      }
      if (!valid)
        throw new ForbiddenException(
          'Source attestation signature is invalid.',
        );
      const [clock] = await m.query('SELECT statement_timestamp() AS now');
      if (
        Date.parse(p.issuedAt as string) > clock.now.getTime() ||
        (!archiveExpired &&
          Date.parse(p.expiresAt as string) <= clock.now.getTime()) ||
        (archiveExpired &&
          Date.parse(p.expiresAt as string) > clock.now.getTime()) ||
        Date.parse(p.issuedAt as string) < key.valid_from.getTime() ||
        Date.parse(p.expiresAt as string) > key.valid_to.getTime()
      )
        throw new ConflictException(
          'Source attestation is expired, not yet valid or outside its signing authority.',
        );
      const [latest] = await m.query(
        'SELECT revision FROM finance_source_attestations WHERE tenant_id=$1 AND source_company_id=$2 ORDER BY revision DESC LIMIT 1',
        [p.tenantId, p.companyId],
      );
      if (Number(p.revision) !== (latest?.revision ?? 0) + 1)
        throw new ConflictException('Source revisions must be consecutive.');
      const [row] = await m.query(
        `INSERT INTO finance_source_attestations(tenant_id,source_company_id,key_id,revision,issued_at,expires_at,raw_body,raw_hash,signature_base64,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id`,
        [
          p.tenantId,
          p.companyId,
          p.keyId,
          p.revision,
          p.issuedAt,
          p.expiresAt,
          body,
          rawHash,
          signatureBase64,
          canonicalFinanceJson(p),
        ],
      );
      return { id: row.id, rawHash, reused: false, postingAuthorized: false };
    });
  }

  /** The signed receipt attests only that the exact source revision was stored. */
  async signedReceipt(id: string) {
    const privatePem = process.env.FINANCE_SOURCE_RECEIPT_PRIVATE_KEY;
    const expected = process.env.FINANCE_SOURCE_RECEIPT_PUBLIC_FINGERPRINT;
    if (!privatePem && !expected) return null;
    let key;
    try {
      if (!privatePem || !expected || !/^[0-9a-f]{64}$/.test(expected))
        throw new Error('missing receipt signer');
      key = createPrivateKey(privatePem);
      if (
        key.asymmetricKeyType !== 'ed25519' ||
        sourceByteHash(
          createPublicKey(key).export({ type: 'spki', format: 'der' }),
        ) !== expected
      )
        throw new Error('invalid receipt signer');
    } catch {
      throw new ForbiddenException(
        'Configured source receipt signer is unavailable.',
      );
    }
    const [row] = await this.source.query(
      'SELECT id,tenant_id,source_company_id,key_id,revision,raw_hash,received_at FROM finance_source_attestations WHERE id=$1',
      [id],
    );
    if (!row)
      throw new ForbiddenException('Source receipt evidence is unavailable.');
    const receipt = {
      schema: 'FINANCE_SOURCE_RECEIPT_V1',
      status: 'ACCEPTED',
      receiptId: row.id,
      tenantId: row.tenant_id,
      companyId: row.source_company_id,
      keyId: row.key_id,
      revision: row.revision,
      rawHash: row.raw_hash,
      receivedAt: row.received_at.toISOString(),
      issuerFingerprint: expected,
    };
    const body = Buffer.from(canonicalFinanceJson(receipt), 'utf8');
    return {
      bodyBase64: body.toString('base64'),
      signature: sign(null, body, key).toString('base64'),
    };
  }

  /** Reverify the newest signed source evidence against an exact reviewed master. */
  async verifyDimensions(
    manager: EntityManager,
    ids: string[],
    candidate: Parameters<typeof verifyReviewedDimensionMaster>[2],
  ) {
    return verifyReviewedDimensionMaster(
      manager,
      ids,
      candidate,
      async (m, company, payload, from, to) => {
        const [row] = await m.query(
          `SELECT s.*,k.public_key_pem,k.key_fingerprint,k.producer_id AS key_producer_id,k.state AS key_state,k.revoked_at,k.valid_from AS key_valid_from,k.valid_to AS key_valid_to,statement_timestamp() AS current_time FROM finance_source_attestations s JOIN finance_source_attestation_keys k ON k.id=s.key_id AND k.tenant_id=s.tenant_id AND k.source_company_id=s.source_company_id WHERE s.tenant_id=$1 AND s.source_company_id=$2 ORDER BY s.revision DESC LIMIT 1 FOR SHARE OF s,k`,
          [ids[0], company],
        );
        if (
          !row ||
          row.key_state !== 'ENABLED' ||
          row.revoked_at ||
          row.key_valid_from > row.current_time ||
          row.key_valid_to <= row.current_time ||
          row.expires_at <= row.current_time ||
          row.issued_at > row.current_time ||
          row.issued_at < row.key_valid_from ||
          row.expires_at > row.key_valid_to
        )
          throw new ForbiddenException(
            'A current company-scoped source attestation is required.',
          );
        const body = row.raw_body as Buffer,
          parsed = parseSourceJson(body) as Record<string, any>;
        let valid = false;
        try {
          const key = createPublicKey(row.public_key_pem);
          valid =
            key.asymmetricKeyType === 'ed25519' &&
            sourceByteHash(key.export({ format: 'der', type: 'spki' })) ===
              row.key_fingerprint &&
            verify(
              null,
              body,
              key,
              Buffer.from(row.signature_base64, 'base64'),
            );
        } catch {
          valid = false;
        }
        if (
          !valid ||
          sourceByteHash(body) !== row.raw_hash ||
          financeConfigurationHash(parsed) !==
            financeConfigurationHash(row.payload) ||
          parsed.tenantId !== ids[0] ||
          parsed.companyId !== company ||
          parsed.revision !== row.revision ||
          parsed.keyId !== row.key_id ||
          parsed.producerId !== row.key_producer_id ||
          parsed.issuedAt !== row.issued_at.toISOString() ||
          parsed.expiresAt !== row.expires_at.toISOString()
        )
          throw new ConflictException(
            'Signed company source evidence differs from the stored snapshot.',
          );
        const master = payload.companyMaster as Record<string, any>;
        if (
          !master ||
          !Array.isArray(master.branchIds) ||
          !Array.isArray(master.productIds) ||
          !Array.isArray(parsed.branches) ||
          !Array.isArray(parsed.products)
        )
          throw new ConflictException(
            'Company dimension snapshot is malformed.',
          );
        const order = (a: { id: string }, b: { id: string }) =>
          a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        const branches = parsed.branches
          .filter((branch: any) => master.branchIds.includes(branch.id))
          .map((branch: any) => ({
            id: branch.id,
            code: branch.code,
            status: branch.status,
          }))
          .sort(order);
        const products = parsed.products
          .filter((product: any) => master.productIds.includes(product.id))
          .map((product: any) => ({
            id: product.id,
            product_code: product.productCode,
            is_active: product.active,
            lifecycle_status: product.lifecycleStatus,
            current_version_id: product.versionId,
            version_status: product.versionStatus,
            effective_from: product.effectiveFrom,
            effective_to: product.effectiveTo,
            definition_hash: product.definitionHash,
          }))
          .sort(order);
        if (
          branches.length !== master.branchIds.length ||
          branches.some((branch: any) => branch.status !== 'active') ||
          products.length !== master.productIds.length ||
          products.some(
            (product: any) =>
              !product.is_active ||
              product.lifecycle_status !== 'ACTIVE' ||
              !['ACTIVE', 'PUBLISHED'].includes(product.version_status) ||
              !isFinanceDate(from) ||
              !isFinanceDate(to) ||
              product.effective_from > from ||
              (product.effective_to && product.effective_to < to),
          )
        )
          throw new ConflictException(
            'Signed company sources do not cover the reviewed dimensions.',
          );
        const snapshot = {
          companyId: company,
          effectiveFrom: from,
          effectiveTo: to,
          branches,
          products,
        };
        if (
          financeConfigurationHash(snapshot) !== master.snapshotHash ||
          financeConfigurationHash(master.snapshot) !== master.snapshotHash
        )
          throw new ConflictException(
            'Signed company sources differ from the reviewed dimension snapshot.',
          );
        return payload;
      },
    );
  }
}
