import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

interface LogOptions {
  userId?: string;
  companyId?: string;
  action: AuditAction | string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  status?: 'success' | 'failure';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(options: LogOptions): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        user_id: options.userId ?? null,
        company_id: options.companyId ?? null,
        action: options.action,
        resource: options.resource ?? null,
        resource_id: options.resourceId ?? null,
        ip_address: options.ipAddress ?? null,
        user_agent: options.userAgent ?? null,
        metadata: options.metadata ?? null,
        status: options.status ?? 'success',
      });
      await this.auditRepo.save(entry);
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
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
}
