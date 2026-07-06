import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { FilterTiramisNotificationDto } from '../dto/filter-tiramis-notification.dto';
import { TiramisNotificationEntity } from '../entities/tiramis-notification.entity';
import { TiramisNotificationDeliveryStatus } from '../enums/tiramis-notification-delivery-status.enum';

@Injectable()
export class TiramisNotificationRepository {
  constructor(
    @InjectRepository(TiramisNotificationEntity)
    private readonly repository: Repository<TiramisNotificationEntity>,
  ) {}

  create(data: Partial<TiramisNotificationEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisNotificationEntity) {
    return this.repository.save(entity);
  }

  findById(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.id = :id', { id });

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getOne();
  }

  async findDuplicateByDedupeKey(params: {
    dedupeKey: string;
    withinMinutes: number;
  }) {
    const since = new Date(Date.now() - params.withinMinutes * 60 * 1000);

    return this.repository
      .createQueryBuilder('notification')
      .where('notification.dedupeKey = :dedupeKey', {
        dedupeKey: params.dedupeKey,
      })
      .andWhere('notification.createdAt >= :since', { since })
      .orderBy('notification.createdAt', 'DESC')
      .getOne();
  }

  async search(
    query: FilterTiramisNotificationDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);

    const qb = this.repository
      .createQueryBuilder('notification')
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.severity) {
      qb.andWhere('notification.severity = :severity', {
        severity: query.severity,
      });
    }

    if (query.deliveryStatus) {
      qb.andWhere('notification.deliveryStatus = :deliveryStatus', {
        deliveryStatus: query.deliveryStatus,
      });
    }

    if (query.requestType) {
      qb.andWhere('notification.requestType = :requestType', {
        requestType: query.requestType,
      });
    }

    if (query.isRead === 'true') {
      qb.andWhere('notification.isRead = true');
    }

    if (query.isRead === 'false') {
      qb.andWhere('notification.isRead = false');
    }

    if (query.includeDismissed !== 'true') {
      qb.andWhere('notification.dismissedAt IS NULL');
    }

    if (query.correlationId) {
      qb.andWhere('notification.correlationId = :correlationId', {
        correlationId: query.correlationId,
      });
    }

    if (query.localTrackingId) {
      qb.andWhere('notification.localTrackingId = :localTrackingId', {
        localTrackingId: query.localTrackingId,
      });
    }

    if (query.businessReference) {
      qb.andWhere('notification.businessReference = :businessReference', {
        businessReference: query.businessReference,
      });
    }

    if (query.sourceModule) {
      qb.andWhere('notification.sourceModule = :sourceModule', {
        sourceModule: query.sourceModule,
      });
    }

    if (query.sourceRecordId) {
      qb.andWhere('notification.sourceRecordId = :sourceRecordId', {
        sourceRecordId: query.sourceRecordId,
      });
    }

    if (query.startDate) {
      qb.andWhere('notification.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('notification.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  findRecent(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.dismissedAt IS NULL')
      .orderBy('notification.createdAt', 'DESC')
      .take(limit);

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  findUnread(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.isRead = false')
      .andWhere('notification.dismissedAt IS NULL')
      .orderBy('notification.createdAt', 'DESC')
      .take(limit);

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  findByTrackingId(
    localTrackingId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.localTrackingId = :localTrackingId', {
        localTrackingId,
      })
      .andWhere('notification.dismissedAt IS NULL')
      .orderBy('notification.createdAt', 'DESC');

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  findByBusinessReference(
    businessReference: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.businessReference = :businessReference', {
        businessReference,
      })
      .andWhere('notification.dismissedAt IS NULL')
      .orderBy('notification.createdAt', 'DESC');

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  async getSummary(scope?: {
    companyId?: string | null;
    canAccessAllCompanies?: boolean;
  }) {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.dismissedAt IS NULL');

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('notification.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    const rows = await qb.getMany();
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const item of rows) {
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    return {
      total: rows.length,
      unread: rows.filter((item) => !item.isRead).length,
      critical: rows.filter((item) => item.severity === 'CRITICAL').length,
      error: rows.filter((item) => item.severity === 'ERROR').length,
      warning: rows.filter((item) => item.severity === 'WARNING').length,
      info: rows.filter((item) => item.severity === 'INFO').length,
      bySeverity,
      byType,
    };
  }

  async markRead(
    id: string,
    userId?: string | null,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const existing = await this.findById(id, scope);

    if (!existing) {
      return null;
    }

    await this.repository.update(
      { id },
      {
        isRead: true,
        readAt: new Date(),
        readByUserId: userId || null,
      },
    );

    return this.findById(id, scope);
  }

  async markUnread(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const existing = await this.findById(id, scope);

    if (!existing) {
      return null;
    }

    await this.repository.update(
      { id },
      {
        isRead: false,
        readAt: null,
        readByUserId: null,
      },
    );

    return this.findById(id, scope);
  }

  async markAllRead(params?: {
    userId?: string | null;
    sourceCompanyId?: string | null;
    canAccessAllCompanies?: boolean;
  }) {
    const qb = this.repository
      .createQueryBuilder()
      .update()
      .set({
        isRead: true,
        readAt: new Date(),
        readByUserId: params?.userId || null,
      })
      .where('is_read = false')
      .andWhere('dismissed_at IS NULL');

    if (params?.sourceCompanyId && !params.canAccessAllCompanies) {
      qb.andWhere('source_company_id = :sourceCompanyId', {
        sourceCompanyId: params.sourceCompanyId,
      });
    }

    const result = await qb.execute();

    return {
      success: true,
      affected: result.affected || 0,
    };
  }

  async dismiss(
    id: string,
    userId?: string | null,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const existing = await this.findById(id, scope);

    if (!existing) {
      return null;
    }

    await this.repository.update(
      { id },
      {
        dismissedAt: new Date(),
        dismissedByUserId: userId || null,
        isRead: true,
        readAt: new Date(),
        readByUserId: userId || null,
      },
    );

    return this.findById(id, scope);
  }

  async markDeliverySent(id: string) {
    await this.repository.update(
      { id },
      {
        deliveryStatus: TiramisNotificationDeliveryStatus.SENT,
        deliveredAt: new Date(),
        lastDeliveryAttemptAt: new Date(),
        deliveryErrorMessage: null,
      },
    );

    return this.findById(id);
  }

  async markDeliverySkipped(id: string, reason?: string) {
    await this.repository.update(
      { id },
      {
        deliveryStatus: TiramisNotificationDeliveryStatus.SKIPPED,
        lastDeliveryAttemptAt: new Date(),
        deliveryErrorMessage: reason || null,
      },
    );

    return this.findById(id);
  }

  async markDeliveryFailed(id: string, error: any) {
    const current = await this.findById(id);

    await this.repository.update(
      { id },
      {
        deliveryStatus: TiramisNotificationDeliveryStatus.FAILED,
        deliveryAttempts: (current?.deliveryAttempts || 0) + 1,
        lastDeliveryAttemptAt: new Date(),
        deliveryErrorMessage:
          error?.message ||
          error?.response?.message ||
          String(error || 'Notification delivery failed'),
      },
    );

    return this.findById(id);
  }
}
