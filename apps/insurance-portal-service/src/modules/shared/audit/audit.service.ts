import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

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
  ) {}

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

    await repository.save(entity);
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
      actor.scope === 'platform' && actor.permissions.includes('audit:read-all');

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
}
