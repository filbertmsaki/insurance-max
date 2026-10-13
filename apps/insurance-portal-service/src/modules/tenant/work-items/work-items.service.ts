import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, DataSource, Repository } from 'typeorm';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import type { FindWorkItemsQueryDto } from './dto/work-item-list-query.dto';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import {
  AssignWorkItemDto,
  CancelWorkItemDto,
  WorkItemCommentDto,
} from './dto/work-item-actions.dto';
import { WorkItemEvent } from './entities/work-item-event.entity';
import { WorkItem } from './entities/work-item.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';

@Injectable()
export class WorkItemsService {
  constructor(
    @InjectRepository(WorkItem)
    private readonly workItemRepository: Repository<WorkItem>,
    @InjectRepository(WorkItemEvent)
    private readonly workItemEventRepository: Repository<WorkItemEvent>,
    private readonly scopeService: DataAccessScopeService,
    private readonly dataSource: DataSource,
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
    if (params.title.trim().length > 180) {
      throw new ConflictException('Work item title exceeds 180 characters.');
    }
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

    let item: WorkItem;
    try {
      item = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(WorkItem);
        const created = await repository.save(
          repository.create({
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
        await manager.getRepository(WorkItemEvent).save(
          manager.getRepository(WorkItemEvent).create({
            company_id: created.company_id,
            work_item_id: created.id,
            event_type: 'CREATED',
            actor_id: params.createdBy ?? null,
            actor_type: 'USER',
            comment: null,
            metadata: {
              priority: created.priority,
              queueCode: created.queue_code,
            },
          }),
        );
        return created;
      });
    } catch (error) {
      if (stableKey) {
        const existing = await this.workItemRepository.findOne({
          where: { company_id: params.companyId, idempotency_key: stableKey },
        });
        if (existing) return existing;
      }
      throw error;
    }

    return item;
  }

  async listForUser(
    user: AuthenticatedUser,
    view = 'all',
  ): Promise<WorkItem[]> {
    return this.scopedListQuery(user, view)
      .orderBy('item.due_at', 'ASC', 'NULLS LAST')
      .addOrderBy('item.created_at', 'DESC')
      .getMany();
  }

  /** Server-side table: view + branch/assignment scope applied before paging and counting. */
  findPage(user: AuthenticatedUser, query: FindWorkItemsQueryDto) {
    const qb = this.scopedListQuery(user, query.view || 'all');
    if (query.status) {
      qb.andWhere('item.status = :statusFilter', {
        statusFilter: query.status,
      });
    }
    if (query.priority) {
      qb.andWhere('item.priority = :priorityFilter', {
        priorityFilter: query.priority,
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        work_item_no: 'item.work_item_no',
        priority: 'item.priority',
        status: 'item.status',
        due_at: 'item.due_at',
        created_at: 'item.created_at',
      },
      defaultSort: 'due_at',
      defaultOrder: 'ASC',
      searchable: ['item.work_item_no', 'item.title', 'item.queue_code'],
      tieBreaker: 'item.id',
    });
  }

  private scopedListQuery(user: AuthenticatedUser, view: string) {
    const scope = this.scopeService.resolve(user);
    const supportedViews = new Set([
      'my',
      'unassigned',
      'team',
      'due-today',
      'overdue',
      'high-priority',
      'completed',
      'delegated',
      'all',
    ]);
    if (!supportedViews.has(view)) {
      throw new ConflictException('Unsupported work item view.');
    }

    const queryBuilder = this.workItemRepository
      .createQueryBuilder('item')
      .where('item.company_id = :companyId', {
        companyId: scope.companyId,
      });

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
        queryBuilder.andWhere(
          new Brackets((personalScope) => {
            personalScope
              .where('item.assigned_user_id = :userId', { userId: user.id })
              .orWhere('item.assigned_role IN (:...viewerRoles)', {
                viewerRoles: user.roles?.length ? user.roles : ['NO_ROLE'],
              });
          }),
        );
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

    // Branch-limited users never see colleagues' personally assigned items,
    // whichever view they pick; "my" and "team" already restrict further.
    if (!scope.canViewAllBranches && view !== 'my' && view !== 'team') {
      queryBuilder.andWhere(
        new Brackets((assignmentScope) => {
          assignmentScope
            .where('item.assigned_user_id = :viewerId', {
              viewerId: user.id,
            })
            .orWhere('item.assigned_user_id IS NULL')
            .orWhere('item.assigned_role IN (:...viewerRoles)', {
              viewerRoles: user.roles?.length ? user.roles : ['NO_ROLE'],
            });
        }),
      );
    }

    return queryBuilder;
  }

  async listQueues(user: AuthenticatedUser) {
    const scope = this.scopeService.resolve(user);
    const query = this.workItemRepository
      .createQueryBuilder('item')
      .select('item.queue_code', 'queue_code')
      .addSelect(`COUNT(*) FILTER (WHERE item.status = 'OPEN')`, 'open_count')
      .addSelect(
        `COUNT(*) FILTER (WHERE item.status = 'IN_PROGRESS')`,
        'in_progress_count',
      )
      .where('item.company_id = :companyId', { companyId: scope.companyId })
      .andWhere(`item.status IN ('OPEN', 'IN_PROGRESS')`)
      .groupBy('item.queue_code');
    if (user.roles?.length) {
      query.andWhere(
        '(item.assigned_role IN (:...roles) OR item.assigned_user_id = :userId OR item.assigned_user_id IS NULL)',
        { roles: user.roles, userId: user.id },
      );
    } else {
      query.andWhere(
        '(item.assigned_user_id = :userId OR item.assigned_user_id IS NULL)',
        { userId: user.id },
      );
    }
    if (!scope.canViewAllBranches) {
      query.andWhere(
        '(item.branch_id IS NULL OR item.branch_id IN (:...branchIds))',
        {
          branchIds: scope.allowedBranchIds.length
            ? scope.allowedBranchIds
            : ['00000000-0000-0000-0000-000000000000'],
        },
      );
    }
    const rows = await query.getRawMany<{
      queue_code: string | null;
      open_count: string;
      in_progress_count: string;
    }>();
    return rows.map((row) => ({
      queue_code: row.queue_code ?? 'general',
      open_count: Number(row.open_count),
      in_progress_count: Number(row.in_progress_count),
    }));
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    const item = await this.workItemRepository.findOne({
      where: {
        id,
        company_id: user.companyId!,
      },
    });

    return this.assertVisible(user, item);
  }

  private assertVisible(user: AuthenticatedUser, item: WorkItem | null) {
    const scope = this.scopeService.resolve(user);

    if (!item) {
      throw new NotFoundException('Work item not found');
    }
    if (
      !scope.canViewAllBranches &&
      item.branch_id &&
      !scope.allowedBranchIds.includes(item.branch_id)
    ) {
      throw new NotFoundException('Work item not found');
    }

    return item;
  }

  /**
   * Status changes lock the row and re-check state under the lock, so two
   * users acting on the same item at once cannot both succeed (for example
   * both claiming it, the second silently overwriting the first).
   */
  private transition(
    user: AuthenticatedUser,
    id: string,
    apply: (item: WorkItem) => { eventType: string; comment?: string },
  ): Promise<WorkItem> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(WorkItem)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.id = :id', { id })
        .andWhere('item.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();
      const item = this.assertVisible(user, locked);

      const event = apply(item);
      await manager.getRepository(WorkItem).save(item);
      await this.addEvent(
        item,
        { actorId: user.id, ...event },
        manager.getRepository(WorkItemEvent),
      );
      return item;
    });
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

  claim(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    return this.transition(user, id, (item) => {
      if (item.assigned_user_id && item.assigned_user_id !== user.id) {
        throw new ConflictException(
          'Work item is already assigned to another user.',
        );
      }
      if (item.status !== 'OPEN') {
        throw new ConflictException('Only open work items can be claimed.');
      }
      item.assigned_user_id = user.id;
      item.claimed_at = new Date();
      return { eventType: 'CLAIMED' };
    });
  }

  async assign(
    user: AuthenticatedUser,
    id: string,
    dto: AssignWorkItemDto,
    eventType = 'ASSIGNED',
  ): Promise<WorkItem> {
    const item = await this.findOne(user, id);
    if (item.status === 'COMPLETED' || item.status === 'CANCELLED') {
      throw new ConflictException('Closed work items cannot be reassigned.');
    }
    if (dto.assigned_user_id) {
      const membership = await this.workItemRepository.manager
        .getRepository(CompanyUser)
        .findOne({
          where: {
            user_id: dto.assigned_user_id,
            company_id: item.company_id,
            status: 'active',
          },
        });
      if (!membership)
        throw new NotFoundException('Assignee not found in this organization.');
    }
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

  start(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    return this.transition(user, id, (item) => {
      if (item.assigned_user_id && item.assigned_user_id !== user.id) {
        throw new ForbiddenException('Work item is assigned to another user.');
      }
      if (!['OPEN', 'BLOCKED'].includes(item.status)) {
        throw new ConflictException(
          'Work item cannot be started from its current state.',
        );
      }
      item.status = 'IN_PROGRESS';
      item.started_at = new Date();
      if (!item.assigned_user_id) {
        item.assigned_user_id = user.id;
        item.claimed_at = item.claimed_at ?? new Date();
      }
      return { eventType: 'STARTED' };
    });
  }

  async comment(
    user: AuthenticatedUser,
    id: string,
    dto: WorkItemCommentDto,
  ): Promise<{ success: true }> {
    const item = await this.findOne(user, id);
    if (!['OPEN', 'IN_PROGRESS', 'BLOCKED'].includes(item.status)) {
      throw new ConflictException('Closed work items cannot receive comments.');
    }
    await this.addEvent(item, {
      actorId: user.id,
      eventType: 'COMMENTED',
      comment: dto.comment,
    });
    return { success: true };
  }

  execute(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    return this.transition(user, id, (item) => {
      if (item.assigned_user_id && item.assigned_user_id !== user.id) {
        throw new ForbiddenException('Work item is assigned to another user.');
      }
      if (item.status !== 'IN_PROGRESS') {
        throw new ConflictException(
          'Only in-progress work items can be completed.',
        );
      }
      item.status = 'COMPLETED';
      item.completed_by = user.id;
      item.completed_at = new Date();
      return { eventType: 'EXECUTED' };
    });
  }

  cancel(
    user: AuthenticatedUser,
    id: string,
    dto: CancelWorkItemDto,
  ): Promise<WorkItem> {
    return this.transition(user, id, (item) => {
      if (item.status === 'COMPLETED' || item.status === 'CANCELLED') {
        throw new ConflictException('Closed work items cannot be cancelled.');
      }
      item.status = 'CANCELLED';
      item.cancelled_by = user.id;
      item.cancelled_at = new Date();
      item.cancellation_reason = dto.reason;
      return { eventType: 'CANCELLED', comment: dto.reason };
    });
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
    repository: Repository<WorkItemEvent> = this.workItemEventRepository,
  ) {
    await repository.save(
      repository.create({
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
