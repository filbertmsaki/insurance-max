import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisAccessAuditEntity } from '../entities/tiramis-access-audit.entity';

export interface TiramisAccessAuditRecord {
  requestId?: string | null;
  correlationId?: string | null;
  callingService?: string | null;
  actorUserId?: string | null;
  tenantCompanyId?: string | null;
  serviceScopes?: string[] | null;
  method: string;
  path: string;
  statusCode: number;
  allowed: boolean;
  denialReason?: string | null;
}

@Injectable()
export class TiramisAccessAuditService {
  private readonly logger = new Logger(TiramisAccessAuditService.name);

  constructor(
    @InjectRepository(TiramisAccessAuditEntity)
    private readonly repository: Repository<TiramisAccessAuditEntity>,
  ) {}

  async record(record: TiramisAccessAuditRecord): Promise<void> {
    try {
      await this.repository.save(this.toEntity(record));
    } catch (error) {
      this.logger.error(
        'Failed to persist TIRAMIS access audit record',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'TIRAMIS access audit is unavailable',
      );
    }
  }

  async begin(
    record: Omit<TiramisAccessAuditRecord, 'statusCode' | 'allowed'>,
  ) {
    try {
      const pending = await this.repository.save(
        this.toEntity({ ...record, statusCode: 102, allowed: true }),
      );
      return pending.id;
    } catch (error) {
      this.logger.error(
        'Failed to persist TIRAMIS access audit intent',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'TIRAMIS access audit is unavailable',
      );
    }
  }

  async complete(
    id: string,
    result: Pick<
      TiramisAccessAuditRecord,
      'statusCode' | 'allowed' | 'denialReason'
    >,
  ) {
    try {
      await this.repository.update(id, {
        statusCode: result.statusCode,
        allowed: result.allowed,
        denialReason: this.limit(result.denialReason, 100),
      });
    } catch (error) {
      this.logger.error(
        'Failed to complete TIRAMIS access audit record',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'TIRAMIS access audit is unavailable',
      );
    }
  }

  private toEntity(record: TiramisAccessAuditRecord) {
    return this.repository.create({
      requestId: this.limit(record.requestId, 128),
      correlationId: this.limit(record.correlationId, 128),
      callingService: this.limit(record.callingService, 100) ?? 'unknown',
      actorUserId: this.limit(record.actorUserId, 100),
      tenantCompanyId: this.limit(record.tenantCompanyId, 100),
      serviceScopes: record.serviceScopes?.slice(0, 30) ?? null,
      method: this.limit(record.method, 20) ?? 'UNKNOWN',
      path: this.limit(record.path, 255) ?? 'unknown',
      statusCode: record.statusCode,
      allowed: record.allowed,
      // Persist only a stable exception category, never raw error text,
      // which may contain customer data or upstream credentials.
      denialReason: this.limit(record.denialReason, 100),
    });
  }

  private limit(value: string | null | undefined, maxLength: number) {
    if (!value) return null;
    const safe = [...value]
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('');
    return safe.slice(0, maxLength);
  }
}
