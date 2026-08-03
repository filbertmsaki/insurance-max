import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, Repository } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { WorkItem } from './entities/work-item.entity';

@Injectable()
export class WorkItemsService {
  constructor(
    @InjectRepository(WorkItem)
    private readonly workItemRepository: Repository<WorkItem>,
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
    dueAt?: Date;
    dedupeKey?: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<WorkItem> {
    if (params.dedupeKey) {
      const existing = await this.workItemRepository.findOne({
        where: {
          company_id: params.companyId,
          dedupe_key: params.dedupeKey,
          status: 'OPEN',
        },
      });

      if (existing) {
        return existing;
      }
    }

    return this.workItemRepository.save(
      this.workItemRepository.create({
        company_id: params.companyId,
        branch_id: params.branchId ?? null,
        domain: params.domain,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        title: params.title,
        description: params.description ?? null,
        priority: params.priority ?? 'MEDIUM',
        status: 'OPEN',
        assigned_user_id: params.assignedUserId ?? null,
        assigned_role: params.assignedRole ?? null,
        due_at: params.dueAt ?? null,
        dedupe_key: params.dedupeKey ?? null,
        metadata: params.metadata ?? null,
        created_by: params.createdBy ?? null,
        completed_by: null,
        completed_at: null,
      }),
    );
  }

  async listForUser(user: AuthenticatedUser): Promise<WorkItem[]> {
    const scope = this.scopeService.resolve(user);

    const queryBuilder = this.workItemRepository
      .createQueryBuilder('item')
      .where('item.company_id = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere(
        new Brackets((visibility) => {
          visibility
            .where('item.assigned_user_id = :userId', {
              userId: user.id,
            })
            .orWhere('item.assigned_user_id IS NULL');
        }),
      )
      .andWhere(`item.status IN ('OPEN', 'IN_PROGRESS')`)
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

    return queryBuilder.getMany();
  }

  async complete(user: AuthenticatedUser, id: string): Promise<WorkItem> {
    const item = await this.workItemRepository.findOne({
      where: {
        id,
        company_id: user.companyId!,
      },
    });

    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    item.status = 'COMPLETED';
    item.completed_by = user.id;
    item.completed_at = new Date();

    return this.workItemRepository.save(item);
  }
}
