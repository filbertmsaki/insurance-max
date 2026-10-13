import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import type { PortalNotificationsQueryDto } from '../dto/portal-query.dto';

import { PortalNotification } from '../entities/portal-notification.entity';
import { PortalNotificationSeverity } from '../enums/portal.enums';

@Injectable()
export class PortalNotificationService {
  constructor(
    @InjectRepository(PortalNotification)
    private readonly notificationRepository: Repository<PortalNotification>,
  ) {}

  create(params: {
    companyId: string;
    userId: string;
    type: string;
    severity?: PortalNotificationSeverity;
    title: string;
    message: string;
    resourceType?: string | null;
    resourceId?: string | null;
    actionUrl?: string | null;
  }) {
    return this.notificationRepository.save(
      this.notificationRepository.create({
        company_id: params.companyId,
        user_id: params.userId,
        type: params.type,
        severity: params.severity ?? PortalNotificationSeverity.INFO,
        title: params.title,
        message: params.message,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        action_url: params.actionUrl ?? null,
        read_at: null,
      }),
    );
  }

  async findMine(companyId: string, userId: string, unreadOnly = false) {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.company_id = :companyId', { companyId })
      .andWhere('notification.user_id = :userId', { userId })
      .orderBy('notification.created_at', 'DESC')
      .take(100);

    if (unreadOnly) {
      query.andWhere('notification.read_at IS NULL');
    }

    return query.getMany();
  }

  /** Server-side table: always restricted to the caller's own notifications before paging. */
  findMinePage(
    companyId: string,
    userId: string,
    query: PortalNotificationsQueryDto,
  ) {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.company_id = :companyId', { companyId })
      .andWhere('notification.user_id = :userId', { userId });
    if (query.unread_only) qb.andWhere('notification.read_at IS NULL');
    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        title: 'notification.title',
        type: 'notification.type',
        severity: 'notification.severity',
        created_at: 'notification.created_at',
      },
      defaultSort: 'created_at',
      searchable: ['notification.title', 'notification.message'],
      tieBreaker: 'notification.id',
    });
  }

  async markRead(companyId: string, userId: string, id: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id, company_id: companyId, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundException('Portal notification not found');
    }

    notification.read_at = notification.read_at ?? new Date();

    return this.notificationRepository.save(notification);
  }
}
