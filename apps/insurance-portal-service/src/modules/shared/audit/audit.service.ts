import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { RequestContextService } from '@insurance-max/shared-kernel';

import { AuditLog, AuditAction } from './entities/audit-log.entity';

export interface AuditOptions {
  userId?: string | null;
  companyId?: string | null;
  companyMembershipId?: string | null;
  branchId?: string | null;
  sessionId?: string | null;

  actorType?: 'user' | 'service' | 'system';
  actorService?: string | null;

  action: AuditAction | string;
  eventCategory?: string;

  resource?: string;
  resourceId?: string;

  ipAddress?: string;
  userAgent?: string;

  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;

  reason?: string;

  status?: 'success' | 'failure';
}

/** @deprecated use AuditOptions */
type LogOptions = AuditOptions;

/** pg advisory lock key that serializes appends to the audit hash chain. */
const AUDIT_CHAIN_LOCK_KEY = 4_820_310_771;
const VERIFY_CHAIN_BATCH_SIZE = 1000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly hashChainEnabled: boolean;

  private readonly sensitiveKeys = new Set([
    'password',
    'old_password',
    'new_password',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'authorization',
    'api_key',
    'client_key',
    'private_key',
    'two_factor_secret',
    'backup_codes',
  ]);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,

    private readonly requestContextService: RequestContextService,
  ) {
    this.hashChainEnabled =
      process.env.AUDIT_HASH_CHAIN_ENABLED !== 'false' &&
      process.env.SECURITY_AUDIT_HASH_CHAIN_ENABLED !== 'false';
  }

  /**
   * Best-effort audit write. Failures are logged but never thrown -
   * use this for non-security-critical events.
   */
  async log(options: LogOptions, manager?: EntityManager): Promise<void> {
    try {
      await this.write(options, manager);
    } catch (error) {
      this.logger.error(
        'Failed to write audit log',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Security-critical audit write. If the audit record cannot be
   * persisted, the triggering operation must fail as well.
   */
  async logCritical(
    options: AuditOptions,
    manager?: EntityManager,
  ): Promise<void> {
    try {
      await this.write(options, manager);
    } catch (error) {
      this.logger.error(
        'Failed to write critical audit log',
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException({
        code: 'AUDIT_WRITE_FAILED',
        message: 'The security-sensitive operation could not be audited.',
      });
    }
  }

  private async write(
    options: AuditOptions,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager?.getRepository(AuditLog) ?? this.auditRepo;

    const context = this.requestContextService.getContext?.();

    const beforeState = this.redact(options.beforeState);
    const afterState = this.redact(options.afterState);

    const entity = repository.create({
      user_id: options.userId ?? null,
      company_id: options.companyId ?? null,
      company_membership_id: options.companyMembershipId ?? null,
      branch_id: options.branchId ?? null,
      session_id: options.sessionId ?? null,

      request_id: context?.requestId ?? null,
      correlation_id: context?.correlationId ?? null,

      actor_type: options.actorType ?? 'user',
      actor_service: options.actorService ?? null,

      action: options.action,
      event_category: options.eventCategory ?? null,

      resource: options.resource ?? null,
      resource_id: options.resourceId ?? null,

      ip_address: options.ipAddress ?? null,
      user_agent: options.userAgent ?? null,

      metadata: this.redact(options.metadata),
      before_state: beforeState,
      after_state: afterState,
      changed_fields: this.changedFields(beforeState, afterState),

      reason: options.reason ?? null,

      status: options.status ?? 'success',
    });

    if (!this.hashChainEnabled) {
      await repository.save(entity);
      return;
    }

    // Appending to the chain is read-latest-then-insert, so concurrent writers
    // must be serialized or they claim the same event_no (and fork the chain).
    // The advisory lock is transaction-scoped: reuse the caller's open
    // transaction, otherwise open a short one just for this append.
    const append = async (chainManager: EntityManager) => {
      await chainManager.query('SELECT pg_advisory_xact_lock($1)', [
        AUDIT_CHAIN_LOCK_KEY,
      ]);
      const chainRepository = chainManager.getRepository(AuditLog);
      const previousEvent = await chainRepository.findOne({
        where: {
          event_no: Not(IsNull()),
        },
        order: { event_no: 'DESC' },
      });

      entity.event_no = String((Number(previousEvent?.event_no ?? 0) || 0) + 1);
      entity.previous_event_hash = previousEvent?.event_hash ?? null;
      entity.event_hash = this.computeEventHash(entity);

      await chainRepository.save(entity);
    };

    if (manager?.queryRunner?.isTransactionActive) {
      await append(manager);
    } else {
      await (manager ?? this.auditRepo.manager).transaction(append);
    }
  }

  async verifyChain() {
    // Walk the chain in event_no batches so memory stays flat as the audit
    // table grows; event_no is unique, so keyset paging is exact.
    let previousHash: string | null = null;
    let lastEventNo: string | null = null;
    let totalEvents = 0;

    for (;;) {
      const events = await this.auditRepo.find({
        where: {
          event_no:
            lastEventNo === null ? Not(IsNull()) : MoreThan(lastEventNo),
        },
        order: { event_no: 'ASC' },
        take: VERIFY_CHAIN_BATCH_SIZE,
      });

      for (const event of events) {
        totalEvents += 1;
        const expectedHash = this.computeEventHash(event);
        if (event.previous_event_hash !== previousHash) {
          return {
            valid: false,
            totalEvents,
            brokenEventId: event.id,
            brokenEventNo: event.event_no,
            reason: 'PREVIOUS_HASH_MISMATCH',
          };
        }

        if (event.event_hash !== expectedHash) {
          return {
            valid: false,
            totalEvents,
            brokenEventId: event.id,
            brokenEventNo: event.event_no,
            reason: 'EVENT_HASH_MISMATCH',
          };
        }

        previousHash = event.event_hash;
      }

      if (events.length < VERIFY_CHAIN_BATCH_SIZE) break;
      lastEventNo = events[events.length - 1].event_no;
    }

    return {
      valid: true,
      totalEvents,
      brokenEventId: null,
      brokenEventNo: null,
      reason: null,
    };
  }

  private redact(
    value: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (this.sensitiveKeys.has(key.toLowerCase())) {
          return [key, '[REDACTED]'];
        }

        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return [key, this.redact(item as Record<string, unknown>)];
        }

        return [key, item];
      }),
    );
  }

  private changedFields(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): string[] | null {
    if (!before || !after) {
      return null;
    }

    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    const changed = [...keys].filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );

    return changed.length ? changed : null;
  }

  async findUserLogs(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const [data, total] = await this.auditRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findAll(
    page = 1,
    limit = 50,
    filters?: { action?: string; userId?: string; status?: string },
  ): Promise<{ data: AuditLog[]; total: number }> {
    const qb = this.auditRepo
      .createQueryBuilder('al')
      .orderBy('al.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.action)
      qb.andWhere('al.action = :action', { action: filters.action });
    if (filters?.userId)
      qb.andWhere('al.user_id = :userId', { userId: filters.userId });
    if (filters?.status)
      qb.andWhere('al.status = :status', { status: filters.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async search(
    actor: {
      id: string;
      scope: string;
      companyId?: string | null;
      permissions: string[];
    },
    filters: {
      page?: number;
      limit?: number;
      action?: string;
      event_category?: string;
      resource?: string;
      user_id?: string;
      status?: 'success' | 'failure';
      request_id?: string;
      correlation_id?: string;
      start_date?: string;
      end_date?: string;
    },
  ) {
    const query = this.auditRepo
      .createQueryBuilder('audit')
      .orderBy('audit.created_at', 'DESC');

    const canReadAll =
      actor.scope === 'platform' &&
      actor.permissions.includes('audit:read-all');

    if (!canReadAll) {
      if (actor.scope !== 'company' || !actor.companyId) {
        query.andWhere('audit.user_id = :userId', { userId: actor.id });
      } else {
        query.andWhere('audit.company_id = :companyId', {
          companyId: actor.companyId,
        });
      }
    }

    if (filters.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }
    if (filters.event_category) {
      query.andWhere('audit.event_category = :eventCategory', {
        eventCategory: filters.event_category,
      });
    }
    if (filters.resource) {
      query.andWhere('audit.resource = :resource', {
        resource: filters.resource,
      });
    }
    if (filters.user_id) {
      query.andWhere('audit.user_id = :userId', { userId: filters.user_id });
    }
    if (filters.status) {
      query.andWhere('audit.status = :status', { status: filters.status });
    }
    if (filters.request_id) {
      query.andWhere('audit.request_id = :requestId', {
        requestId: filters.request_id,
      });
    }
    if (filters.correlation_id) {
      query.andWhere('audit.correlation_id = :correlationId', {
        correlationId: filters.correlation_id,
      });
    }
    if (filters.start_date) {
      query.andWhere('audit.created_at >= :startDate', {
        startDate: new Date(filters.start_date),
      });
    }
    if (filters.end_date) {
      query.andWhere('audit.created_at <= :endDate', {
        endDate: new Date(filters.end_date),
      });
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        itemCount: data.length,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  private computeEventHash(
    event: Pick<
      AuditLog,
      | 'event_no'
      | 'previous_event_hash'
      | 'user_id'
      | 'company_id'
      | 'action'
      | 'resource'
      | 'resource_id'
      | 'status'
      | 'metadata'
      | 'before_state'
      | 'after_state'
      | 'changed_fields'
      | 'request_id'
      | 'correlation_id'
      | 'actor_type'
      | 'actor_service'
      | 'event_category'
      | 'reason'
    >,
  ): string {
    const payload = this.stableStringify({
      eventNo: event.event_no ?? null,
      previousEventHash: event.previous_event_hash ?? null,
      userId: event.user_id ?? null,
      companyId: event.company_id ?? null,
      action: event.action,
      resource: event.resource ?? null,
      resourceId: event.resource_id ?? null,
      status: event.status,
      metadata: event.metadata ?? null,
      beforeState: event.before_state ?? null,
      afterState: event.after_state ?? null,
      changedFields: event.changed_fields ?? null,
      requestId: event.request_id ?? null,
      correlationId: event.correlation_id ?? null,
      actorType: event.actor_type,
      actorService: event.actor_service ?? null,
      eventCategory: event.event_category ?? null,
      reason: event.reason ?? null,
    });

    return createHash('sha256').update(payload).digest('hex');
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.canonicalize(value));
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }

    return value;
  }
}
