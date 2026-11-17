import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createPublicKey, verify } from 'node:crypto';
import { DataSource } from 'typeorm';
import { FINANCE_UUID } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import {
  parseSourceJson,
  sourceByteHash,
} from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-event.types';
import { approvalFields } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-approval.types';

/** A separately provisioned Ed25519 administrator signs scoped key grants and revocations. */
@Injectable()
export class FinanceSourceKeyChangesService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}
  async apply(rawBody: Buffer, signatureBase64: string) {
    const body = Buffer.isBuffer(rawBody) ? Buffer.from(rawBody) : rawBody;
    const p = parseSourceJson(body);
    approvalFields(p, [
      'schema',
      'changeId',
      'action',
      'tenantId',
      'companyId',
      'keyId',
      'producerId',
      'sourcePublicKeyPem',
      'validFrom',
      'validTo',
      'issuedAt',
      'expiresAt',
    ]);
    const uuid = (v: unknown): v is string =>
      typeof v === 'string' && FINANCE_UUID.test(v) && v === v.toLowerCase();
    const instant = (v: unknown): v is string =>
      typeof v === 'string' &&
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString() === v;
    if (
      p.schema !== 'FINANCE_SOURCE_KEY_CHANGE_V1' ||
      !uuid(p.changeId) ||
      !['GRANT', 'REVOKE'].includes(String(p.action)) ||
      !uuid(p.tenantId) ||
      !uuid(p.companyId) ||
      !uuid(p.keyId) ||
      typeof p.producerId !== 'string' ||
      !/^[A-Z0-9][A-Z0-9_.:-]{0,79}$/.test(p.producerId) ||
      typeof p.sourcePublicKeyPem !== 'string' ||
      p.sourcePublicKeyPem.length > 4096 ||
      !instant(p.validFrom) ||
      !instant(p.validTo) ||
      !instant(p.issuedAt) ||
      !instant(p.expiresAt) ||
      Date.parse(p.validTo) <= Date.parse(p.validFrom) ||
      Date.parse(p.validTo) - Date.parse(p.validFrom) > 90 * 86400000 ||
      Date.parse(p.expiresAt) <= Date.parse(p.issuedAt) ||
      Date.parse(p.expiresAt) - Date.parse(p.issuedAt) > 900000
    )
      throw new BadRequestException(
        'An exact scoped and bounded source-key change is required.',
      );
    if (
      typeof signatureBase64 !== 'string' ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signatureBase64)
    )
      throw new ForbiddenException(
        'A canonical key-administrator signature is required.',
      );
    const signature = Buffer.from(signatureBase64, 'base64');
    if (
      signature.length !== 64 ||
      signature.toString('base64') !== signatureBase64
    )
      throw new ForbiddenException(
        'A canonical key-administrator signature is required.',
      );
    let sourceFingerprint = '',
      issuerFingerprint = '',
      valid = false;
    try {
      const sourceKey = createPublicKey(p.sourcePublicKeyPem);
      const adminKey = createPublicKey(
        process.env.FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY ?? '',
      );
      sourceFingerprint = sourceByteHash(
        sourceKey.export({ type: 'spki', format: 'der' }),
      );
      issuerFingerprint = sourceByteHash(
        adminKey.export({ type: 'spki', format: 'der' }),
      );
      valid =
        sourceKey.asymmetricKeyType === 'ed25519' &&
        adminKey.asymmetricKeyType === 'ed25519' &&
        issuerFingerprint ===
          process.env.FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT &&
        verify(null, body, adminKey, signature);
    } catch {
      valid = false;
    }
    if (!valid)
      throw new ForbiddenException(
        'Configured key-administrator signature is invalid.',
      );
    return this.source.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `finance-source-attestation:${p.tenantId}:${p.companyId}`,
      ]);
      const [clock] = await m.query('SELECT statement_timestamp() AS now');
      if (
        Date.parse(p.issuedAt as string) > clock.now.getTime() ||
        Date.parse(p.expiresAt as string) <= clock.now.getTime()
      )
        throw new ConflictException('Key change is expired or not yet valid.');
      const hash = sourceByteHash(body);
      const [old] = await m.query(
        'SELECT * FROM finance_source_key_changes WHERE change_id=$1',
        [p.changeId],
      );
      if (old) {
        if (
          old.raw_hash !== hash ||
          old.signature_base64 !== signatureBase64 ||
          old.issuer_fingerprint !== issuerFingerprint
        )
          throw new ConflictException(
            'Key change ID already identifies different evidence.',
          );
        return {
          changeId: old.change_id,
          keyId: old.source_key_id,
          action: old.action,
          reused: true,
          postingAuthorized: false,
        };
      }
      const [key] = await m.query(
        'SELECT * FROM finance_source_attestation_keys WHERE id=$1 FOR UPDATE',
        [p.keyId],
      );
      if (p.action === 'GRANT') {
        if (key) throw new ConflictException('Source key already exists.');
        if (Date.parse(p.validTo as string) <= clock.now.getTime())
          throw new ConflictException(
            'Source key must not already be expired.',
          );
        await m.query(
          `INSERT INTO finance_source_attestation_keys(id,tenant_id,source_company_id,producer_id,public_key_pem,key_fingerprint,state,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'ENABLED',$7,$8)`,
          [
            p.keyId,
            p.tenantId,
            p.companyId,
            p.producerId,
            p.sourcePublicKeyPem,
            sourceFingerprint,
            p.validFrom,
            p.validTo,
          ],
        );
      } else {
        if (
          !key ||
          key.tenant_id !== p.tenantId ||
          key.source_company_id !== p.companyId ||
          key.producer_id !== p.producerId ||
          key.key_fingerprint !== sourceFingerprint ||
          key.valid_from.toISOString() !== p.validFrom ||
          key.valid_to.toISOString() !== p.validTo ||
          key.state !== 'ENABLED' ||
          key.revoked_at
        )
          throw new ForbiddenException(
            'Exact enabled company source key is unavailable.',
          );
        await m.query(
          "UPDATE finance_source_attestation_keys SET state='REVOKED',revoked_at=statement_timestamp() WHERE id=$1",
          [p.keyId],
        );
      }
      await m.query(
        `INSERT INTO finance_source_key_changes(change_id,tenant_id,source_company_id,source_key_id,action,issuer_fingerprint,raw_body,raw_hash,signature_base64) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          p.changeId,
          p.tenantId,
          p.companyId,
          p.keyId,
          p.action,
          issuerFingerprint,
          body,
          hash,
          signatureBase64,
        ],
      );
      return {
        changeId: p.changeId,
        keyId: p.keyId,
        action: p.action,
        reused: false,
        postingAuthorized: false,
      };
    });
  }
}
