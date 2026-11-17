import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { FINANCE_UUID } from './finance-configuration.types';
import { sourceByteHash } from './finance-event.types';
import { reconcileSourceReceipt } from './finance-source-receipt';

export const FINANCE_SOURCE_DELIVERY_TRANSPORT = Symbol(
  'FINANCE_SOURCE_DELIVERY_TRANSPORT',
);
export type FinanceSourceTransport = (message: {
  body: Buffer;
  signature: string;
  archiveExpired: boolean;
}) => Promise<{ bodyBase64: string; signature: string }>;

/** A dedicated worker sends immutable source bytes and records only signed receiver receipts. */
@Injectable()
export class FinanceSourceDeliveryService {
  private readonly logger = new Logger(FinanceSourceDeliveryService.name);
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @Optional()
    @Inject(FINANCE_SOURCE_DELIVERY_TRANSPORT)
    private readonly transport?: FinanceSourceTransport,
  ) {}

  @Cron('0 */5 * * * *', { timeZone: 'UTC' })
  async tick() {
    const worker = process.env.FINANCE_SOURCE_DELIVERY_WORKER_ID;
    if (!worker) return;
    try {
      await this.runOnce(worker);
    } catch (error) {
      this.logger.error(
        'Source delivery worker failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async send(message: Parameters<FinanceSourceTransport>[0]) {
    if (this.transport) return this.transport(message);
    let base: URL;
    try {
      base = new URL(process.env.FINANCE_SOURCE_DELIVERY_URL ?? '');
    } catch {
      throw new ForbiddenException(
        'A fixed Finance source delivery URL is required.',
      );
    }
    const testLoopback =
      process.env.NODE_ENV === 'test' &&
      process.env.APP_ENV === 'test' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
    if (
      (!testLoopback && base.protocol !== 'https:') ||
      (testLoopback && !['http:', 'https:'].includes(base.protocol)) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !['', '/'].includes(base.pathname)
    )
      throw new ForbiddenException(
        'The Finance source delivery URL is not permitted.',
      );
    const destination = new URL(
      `/internal/company-source-attestations${message.archiveExpired ? '/archive-expired' : ''}`,
      base,
    );
    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-finance-source-signature': message.signature,
      },
      body: new Uint8Array(message.body),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new ForbiddenException('Finance source delivery was not accepted.');
    const text = await response.text();
    if (text.length > 16384)
      throw new ForbiddenException(
        'Finance receipt response exceeds the supported size.',
      );
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new ForbiddenException('Finance receipt response is invalid.');
    }
    const receipt =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, any>).receipt
        : null;
    if (
      !receipt ||
      typeof receipt.bodyBase64 !== 'string' ||
      typeof receipt.signature !== 'string'
    )
      throw new ForbiddenException('A signed Finance receipt is required.');
    return { bodyBase64: receipt.bodyBase64, signature: receipt.signature };
  }

  async runOnce(worker: string) {
    if (typeof worker !== 'string' || !FINANCE_UUID.test(worker))
      throw new ForbiddenException(
        'A dedicated source delivery worker identity is required.',
      );
    worker = worker.toLowerCase();
    const rows = await this.source.query(
      `SELECT o.id,o.tenant_id,o.legal_entity_id,o.book_id,o.source_company_id,o.raw_body,o.raw_hash,o.signature_base64,(o.expires_at<=statement_timestamp()) AS expired,a.id AS authority_id FROM finance_source_delivery_authorities a JOIN finance_source_attestation_outbox o ON o.tenant_id=a.tenant_id AND o.legal_entity_id=a.legal_entity_id AND o.book_id=a.book_id AND o.source_company_id=a.source_company_id LEFT JOIN finance_source_delivery_receipts r ON r.outbox_id=o.id WHERE a.worker_subject_id=$1 AND a.state='ENABLED' AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND a.valid_to>statement_timestamp() AND r.id IS NULL ORDER BY COALESCE((SELECT max(t.occurred_at) FROM finance_source_delivery_attempts t WHERE t.outbox_id=o.id),o.created_at),o.id LIMIT 100`,
      [worker],
    );
    const outcomes: { outboxId: string; state: string }[] = [];
    for (const row of rows) {
      try {
        if (sourceByteHash(row.raw_body) !== row.raw_hash)
          throw new ForbiddenException('Immutable source bytes differ.');
        const receipt = await this.send({
          body: row.raw_body,
          signature: row.signature_base64,
          archiveExpired: row.expired,
        });
        await this.source.transaction(async (m) => {
          const [authority] = await m.query(
            `SELECT id FROM finance_source_delivery_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND id=$5 AND worker_subject_id=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE`,
            [
              row.tenant_id,
              row.legal_entity_id,
              row.book_id,
              row.source_company_id,
              row.authority_id,
              worker,
            ],
          );
          if (!authority)
            throw new ForbiddenException(
              'Current source delivery authority is required.',
            );
          await reconcileSourceReceipt(
            m,
            {
              tenantId: row.tenant_id,
              legalEntityId: row.legal_entity_id,
              bookId: row.book_id,
              companyId: row.source_company_id,
            },
            row.id,
            receipt.bodyBase64,
            receipt.signature,
          );
          await m.query(
            `INSERT INTO finance_source_delivery_attempts(tenant_id,legal_entity_id,book_id,source_company_id,outbox_id,authority_id,worker_subject_id,action,reason_code) VALUES($1,$2,$3,$4,$5,$6,$7,'ACKNOWLEDGED','VERIFIED_RECEIPT')`,
            [
              row.tenant_id,
              row.legal_entity_id,
              row.book_id,
              row.source_company_id,
              row.id,
              row.authority_id,
              worker,
            ],
          );
        });
        outcomes.push({ outboxId: row.id, state: 'ACKNOWLEDGED' });
      } catch (error) {
        await this.source.query(
          `INSERT INTO finance_source_delivery_attempts(tenant_id,legal_entity_id,book_id,source_company_id,outbox_id,authority_id,worker_subject_id,action,reason_code) VALUES($1,$2,$3,$4,$5,$6,$7,'HELD','DELIVERY_HELD')`,
          [
            row.tenant_id,
            row.legal_entity_id,
            row.book_id,
            row.source_company_id,
            row.id,
            row.authority_id,
            worker,
          ],
        );
        this.logger.warn(
          `Source delivery ${row.id} held: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        outcomes.push({ outboxId: row.id, state: 'HELD' });
      }
    }
    return outcomes;
  }
}
