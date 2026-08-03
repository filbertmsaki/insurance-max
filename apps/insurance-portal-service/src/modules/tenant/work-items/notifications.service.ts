import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, Repository } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { TenantNotification } from './entities/tenant-notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(TenantNotification)
    private readonly notificationRepository: Repository<TenantNotification>,
    private readonly scopeService: DataAccessScopeService,
  ) {}

  async create(params: {
    companyId: string;
    branchId?: string | null;
    recipientUserId?: string | null;
    recipientRole?: string | null;
    type: string;
    severity?: string;
    title: string;
    message: string;
    resourceType?: string | null;
    resourceId?: string | null;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.notificationRepository.save(
      this.notificationRepository.create({
        company_id: params.companyId,
        branch_id: params.branchId ?? null,
        recipient_user_id: params.recipientUserId ?? null,
        recipient_role: params.recipientRole ?? null,
        type: params.type,
        severity: params.severity ?? 'INFO',
        title: params.title,
        message: params.message,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        action_url: params.actionUrl ?? null,
        metadata: params.metadata ?? null,
        read_at: null,
      }),
    );
  }

  async listForUser(user: AuthenticatedUser) {
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
            .orWhere('notification.recipient_user_id IS NULL')
            .orWhere('notification.recipient_role IN (:...roles)', {
              roles: user.roles.length ? user.roles : ['NO_ROLE'],
            });
        }),
      )
      .orderBy('notification.created_at', 'DESC');

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

    return queryBuilder.getMany();
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const notification = await this.notificationRepository.findOne({
      where: {
        id,
        company_id: user.companyId!,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read_at = new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(TenantNotification)
      .set({ read_at: new Date() })
      .where('company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere(
        new Brackets((visibility) => {
          visibility
            .where('recipient_user_id = :userId', {
              userId: user.id,
            })
            .orWhere('recipient_user_id IS NULL')
            .orWhere('recipient_role IN (:...roles)', {
              roles: user.roles.length ? user.roles : ['NO_ROLE'],
            });
        }),
      )
      .execute();

    return { success: true };
  }
}
