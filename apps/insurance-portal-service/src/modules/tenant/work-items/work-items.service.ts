import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, Repository } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import {
  AssignWorkItemDto,
  CancelWorkItemDto,
  WorkItemCommentDto,
} from './dto/work-item-actions.dto';
import { WorkItemEvent } from './entities/work-item-event.entity';
import { WorkItem } from './entities/work-item.entity';

@Injectable()
export class WorkItemsService {
  constructor(
    @InjectRepository(WorkItem)
    private readonly workItemRepository: Repository<WorkItem>,
    @InjectRepository(WorkItemEvent)
    private readonly workItemEventRepository: Repository<WorkItemEvent>,
    private readonly scopeService: DataAccessScopeService,
  ) {}

  async create(params: {
    companyId: string;
    branchId?: string | null;
    domain: string;
    resourceType: string;
    resourceId: string;
    title: string;
    description?: string;
    priority?: string;
    assignedUserId?: string;
    assignedRole?: string;
    assignedTeam?: string;
    queueCode?: string;
    dueAt?: Date;
    dedupeKey?: string;
    idempotencyKey?: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
    deepLink?: string;
  }): Promise<WorkItem> {
    const stableKey = params.idempotencyKey ?? params.dedupeKey ?? null;

    if (stableKey) {
      const existing = await this.workItemRepository.findOne({
        where: {
          company_id: params.companyId,
          idempotency_key: stableKey,
        },
      });

      if (existing) {
        return existing;
      }
    }

    const item = await this.workItemRepository.save(
      this.workItemRepository.create({
        company_id: params.companyId,
        work_item_no: `WIT-${randomUUID().slice(0, 8).toUpperCase()}`,
        branch_id: params.branchId ?? null,
        domain: params.domain,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        work_item_type: params.resourceType.toUpperCase(),
        assignment_type: params.assignedUserId ? 'USER' : 'QUEUE',
        assigned_team: params.assignedTeam ?? null,
        queue_code: params.queueCode ?? params.domain,
        source_module: params.domain,
        source_record_id: params.resourceId,
        source_record_version: null,
        idempotency_key: stableKey,
        title: params.title,
        description: params.description ?? null,
        priority: params.priority ?? 'MEDIUM',
        status: 'OPEN',
        sla_status: 'ON_TRACK',
        assigned_user_id: params.assignedUserId ?? null,
        assigned_role: params.assignedRole ?? null,
        deep_link: params.deepLink ?? null,
        due_at: params.dueAt ?? null,
        dedupe_key: params.dedupeKey ?? null,
        metadata: params.metadata ?? null,
        created_by: params.createdBy ?? null,
        claimed_at: null,
        started_at: null,
        completed_by: null,
        completed_at: null,
        cancelled_by: null,
        cancelled_at: null,
        cancellation_reason: null,
        delegated_by: null,
        delegated_at: null,
        warning_sent_at: null,
        escalated_at: null,
      }),
    );

    await this.addEvent(item, {
      actorId: params.createdBy ?? null,
      eventType: 'CREATED',
      metadata: {
        priority: item.priority,
        queueCode: item.queue_code,
      },
    });

    return item;
  }

  async listForUser(
    user: AuthenticatedUser,
    view = 'all',
  ): Promise<WorkItem[]> {
    const scope = this.scopeService.resolve(user);

    const queryBuilder = this.workItemRepository
      .createQueryBuilder('item')
      .where('item.company_id = :companyId', {
        companyId: scope.companyId,
      })
      .orderBy('item.due_at', 'ASC', 'NULLS LAST')
      .addOrderBy('item.created_at', 'DESC');

    if (!scope.canViewAllBranches) {
      queryBuilder.andWhere(
        new Brackets((branchScope) => {
          branchScope
            .where('item.branch_id IS NULL')
            .orWhere('item.branch_id IN (:...branchIds)', {
              branchIds: scope.allowedBranchIds.length
                ? scope.allowedBranchIds
                : ['00000000-0000-0000-0000-000000000000'],
            });
        }),
      );
    }

    switch (view) {
      case 'my':
        queryBuilder.andWhere('item.assigned_user_id = :userId', {
          userId: user.id,
        });
        queryBuilder.andWhere(
          `item.status IN ('OPEN', 'IN_PROGRESS', 'BLOCKED')`,
        );
        break;
      case 'unassigned':
        queryBuilder.andWhere('item.assigned_user_id IS NULL');
        queryBuilder.andWhere(`item.status IN ('OPEN', 'IN_PROGRESS')`);
        break;
      case 'team':
        queryBuilder.andWhere(
          new Brackets((teamScope) => {
            teamScope.where('item.assigned_role IN (:...roles)', {
              roles: user.roles.length ? user.roles : ['NO_ROLE'],
            });
          }),
        );
        queryBuilder.andWhere(
          `item.status IN ('OPEN', 'IN_PROGRESS', 'BLOCKED')`,
        );
        break;
      case 'due-today':
        queryBuilder.andWhere(`item.due_at::date = CURRENT_DATE`);
        queryBuilder.andWhere(
          `item.status IN ('OPEN', 'IN_PROGRESS', 'BLOCKED')`,
        );
        break;
      case 'overdue':
        queryBuilder.andWhere(`item.due_at < NOW()`);
        queryBuilder.andWhere(
          `item.status IN ('OPEN', 'IN_PROGRESS', 'BLOCKED')`,
        );
        break;
      case 'high-priority':
        queryBuilder.andWhere(`item.priority IN ('HIGH', 'CRITICAL')`);
        queryBuilder.andWhere(
          `item.status IN ('OPEN', 'IN_PROGRESS', 'BLOCKED')`,
        );
        break;
      case 'completed':
        queryBuilder.andWhere(`item.status = 'COMPLETED'`);
        break;
      case 'delegated':
        queryBuilder.andWhere(`item.delegated_by IS NOT NULL`);
        break;
      default:
        queryBuilder.andWhere(`item.status <> 'CANCELLED'`);
        break;
    }

    return queryBuilder.getMany();
  }

  async listQueues(user: AuthenticatedUser) {
    const items = await this.listForUser(user, 'all');
    const grouped = new Map<
      string,
      { queue_code: string; open_count: number; in_progress_count: number }
    >();

    for (const item of items) {
      const queueCode = item.queue_code ?? 'general';
      const current = grouped.get(queueCode) ?? {
        queue_code: queueCode,
        open_count: 0,
        in_progress_count: 0,
      };

      if (item.status === 'OPEN') {
        current.open_count += 1;
      }

      if (item.status === 'IN_PROGRESS') {
        current.in_progress_count += 1;
      }

      grouped.set(queueCode, current);
    }

    return Array.from(grouped.values()).sort((left, right) =>
      left.queue_code.localeCompare(right.queue_code),
    );
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    const item = await this.workItemRepository.findOne({
      where: {
        id,
        company_id: user.companyId!,
      },
    });

    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    return item;
  }

  async timeline(user: AuthenticatedUser, id: string) {
    await this.findOne(user, id);
    return this.workItemEventRepository.find({
      where: {
        company_id: user.companyId!,
        work_item_id: id,
      },
      order: {
        created_at: 'ASC',
      },
    });
  }

  async claim(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    const item = await this.findOne(user, id);
    item.assigned_user_id = user.id;
    item.claimed_at = new Date();
    await this.workItemRepository.save(item);
    await this.addEvent(item, {
      actorId: user.id,
      eventType: 'CLAIMED',
    });
    return item;
  }

  async assign(
    user: AuthenticatedUser,
    id: string,
    dto: AssignWorkItemDto,
    eventType = 'ASSIGNED',
  ): Promise<WorkItem> {
    const item = await this.findOne(user, id);
    item.assigned_user_id = dto.assigned_user_id ?? null;
    item.assigned_role = dto.assigned_role ?? null;
    item.assigned_team = dto.assigned_team ?? null;
    item.assignment_type = dto.assigned_user_id ? 'USER' : 'TEAM';
    await this.workItemRepository.save(item);
    await this.addEvent(item, {
      actorId: user.id,
      eventType,
      metadata: {
        assigned_user_id: item.assigned_user_id,
        assigned_role: item.assigned_role,
        assigned_team: item.assigned_team,
      },
    });
    return item;
  }

  async start(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    const item = await this.findOne(user, id);
    item.status = 'IN_PROGRESS';
    item.started_at = new Date();
    if (!item.assigned_user_id) {
      item.assigned_user_id = user.id;
      item.claimed_at = item.claimed_at ?? new Date();
    }
    await this.workItemRepository.save(item);
    await this.addEvent(item, {
      actorId: user.id,
      eventType: 'STARTED',
    });
    return item;
  }

  async comment(
    user: AuthenticatedUser,
    id: string,
    dto: WorkItemCommentDto,
  ): Promise<{ success: true }> {
    const item = await this.findOne(user, id);
    await this.addEvent(item, {
      actorId: user.id,
      eventType: 'COMMENTED',
      comment: dto.comment,
    });
    return { success: true };
  }

  async execute(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    const item = await this.findOne(user, id);
    item.status = 'COMPLETED';
    item.completed_by = user.id;
    item.completed_at = new Date();
    await this.workItemRepository.save(item);
    await this.addEvent(item, {
      actorId: user.id,
      eventType: 'EXECUTED',
    });
    return item;
  }

  async cancel(
    user: AuthenticatedUser,
    id: string,
    dto: CancelWorkItemDto,
  ): Promise<WorkItem> {
    const item = await this.findOne(user, id);
    item.status = 'CANCELLED';
    item.cancelled_by = user.id;
    item.cancelled_at = new Date();
    item.cancellation_reason = dto.reason;
    await this.workItemRepository.save(item);
    await this.addEvent(item, {
      actorId: user.id,
      eventType: 'CANCELLED',
      comment: dto.reason,
    });
    return item;
  }

  async complete(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    return this.execute(user, id);
  }

  private async addEvent(
    item: WorkItem,
    params: {
      actorId: string | null;
      eventType: string;
      actorType?: string;
      comment?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.workItemEventRepository.save(
      this.workItemEventRepository.create({
        company_id: item.company_id,
        work_item_id: item.id,
        event_type: params.eventType,
        actor_id: params.actorId,
        actor_type: params.actorType ?? 'USER',
        comment: params.comment ?? null,
        metadata: params.metadata ?? null,
      }),
    );
  }
}
