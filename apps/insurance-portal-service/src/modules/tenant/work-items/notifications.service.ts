import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, Repository } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { UpdateNotificationPreferencesDto } from './dto/work-item-actions.dto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { TenantNotification } from './entities/tenant-notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(TenantNotification)
    private readonly notificationRepository: Repository<TenantNotification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    private readonly scopeService: DataAccessScopeService,
  ) {}

  async create(params: {
    companyId: string;
    branchId?: string | null;
    recipientUserId?: string | null;
    recipientRole?: string | null;
    type: string;
    severity?: string;
    priority?: string;
    title: string;
    message: string;
    resourceType?: string | null;
    resourceId?: string | null;
    actionUrl?: string | null;
    deepLink?: string | null;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string | null;
    expiresAt?: Date | null;
  }) {
    if (params.idempotencyKey) {
      const existing = await this.notificationRepository.findOne({
        where: {
          company_id: params.companyId,
          idempotency_key: params.idempotencyKey,
        },
      });

      if (existing) {
        return existing;
      }
    }

    return this.notificationRepository.save(
      this.notificationRepository.create({
        company_id: params.companyId,
        notification_no: `NTF-${randomUUID().slice(0, 8).toUpperCase()}`,
        branch_id: params.branchId ?? null,
        recipient_user_id: params.recipientUserId ?? null,
        recipient_role: params.recipientRole ?? null,
        type: params.type,
        channel: 'IN_APP',
        priority: params.priority ?? 'NORMAL',
        severity: params.severity ?? 'INFO',
        status: 'DELIVERED',
        title: params.title,
        message: params.message,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        action_url: params.actionUrl ?? null,
        deep_link: params.deepLink ?? params.actionUrl ?? null,
        idempotency_key: params.idempotencyKey ?? null,
        metadata: params.metadata ?? null,
        read_at: null,
        dismissed_at: null,
        expires_at: params.expiresAt ?? null,
      }),
    );
  }

  async listForUser(user: AuthenticatedUser) {
    return this.visibleTo(user)
      .orderBy('notification.created_at', 'DESC')
      .getMany();
  }

  /**
   * The single visibility rule for reading and acting on notifications: a
   * notification addressed to a user is theirs alone; an unaddressed one is
   * for everyone, or only for holders of its recipient role; and branch
   * notifications stay inside the caller's branch scope.
   */
  private visibleTo(user: AuthenticatedUser) {
    const scope = this.scopeService.resolve(user);

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.company_id = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere(
        new Brackets((visibility) => {
          visibility
            .where('notification.recipient_user_id = :userId', {
              userId: user.id,
            })
            .orWhere(
              new Brackets((unaddressed) => {
                unaddressed
                  .where('notification.recipient_user_id IS NULL')
                  .andWhere(
                    new Brackets((role) => {
                      role
                        .where('notification.recipient_role IS NULL')
                        .orWhere('notification.recipient_role IN (:...roles)', {
                          roles: user.roles.length ? user.roles : ['NO_ROLE'],
                        });
                    }),
                  );
              }),
            );
        }),
      );

    if (!scope.canViewAllBranches) {
      queryBuilder.andWhere(
        new Brackets((branchScope) => {
          branchScope
            .where('notification.branch_id IS NULL')
            .orWhere('notification.branch_id IN (:...branchIds)', {
              branchIds: scope.allowedBranchIds.length
                ? scope.allowedBranchIds
                : ['00000000-0000-0000-0000-000000000000'],
            });
        }),
      );
    }

    return queryBuilder;
  }

  async latestForUser(user: AuthenticatedUser, limit = 5) {
    const notifications = await this.listForUser(user);
    return notifications.slice(0, limit);
  }

  async unreadCount(user: AuthenticatedUser) {
    const notifications = await this.listForUser(user);
    return notifications.filter(
      (notification) =>
        !notification.read_at &&
        !notification.dismissed_at &&
        (!notification.expires_at ||
          notification.expires_at.getTime() >= Date.now()),
    ).length;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const notification = await this.visibleTo(user)
      .andWhere('notification.id = :id', { id })
      .getOne();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const notification = await this.findOne(user, id);
    notification.read_at = new Date();
    return this.notificationRepository.save(notification);
  }

  async markUnread(user: AuthenticatedUser, id: string) {
    const notification = await this.findOne(user, id);
    notification.read_at = null;
    return this.notificationRepository.save(notification);
  }

  async dismiss(user: AuthenticatedUser, id: string) {
    const notification = await this.findOne(user, id);
    notification.dismissed_at = new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllRead(user: AuthenticatedUser) {
    const notifications = await this.listForUser(user);
    for (const notification of notifications) {
      notification.read_at = new Date();
      await this.notificationRepository.save(notification);
    }

    return { success: true };
  }

  async listPreferences(user: AuthenticatedUser) {
    return this.preferenceRepository.find({
      where: {
        company_id: user.companyId!,
        user_id: user.id,
      },
      order: {
        event_code: 'ASC',
        channel: 'ASC',
      },
    });
  }

  async updatePreferences(
    user: AuthenticatedUser,
    dto: UpdateNotificationPreferencesDto,
  ) {
    await this.preferenceRepository.delete({
      company_id: user.companyId!,
      user_id: user.id,
    });

    if (!dto.items.length) {
      return [];
    }

    return this.preferenceRepository.save(
      dto.items.map((item) =>
        this.preferenceRepository.create({
          company_id: user.companyId!,
          user_id: user.id,
          event_code: item.event_code,
          channel: item.channel,
          mode: item.mode,
          quiet_hours_from: item.quiet_hours_from ?? null,
          quiet_hours_to: item.quiet_hours_to ?? null,
          marketing_consent: item.marketing_consent ?? false,
          transactional_required: item.transactional_required ?? false,
        }),
      ),
    );
  }
}
