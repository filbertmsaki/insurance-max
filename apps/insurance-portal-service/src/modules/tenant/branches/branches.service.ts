import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import {
  PaginationDto,
  SortDirection,
} from '@insurance-max/portal-shared/dto/pagination.dto';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { User } from '../users/entities/user.entity';
import { AssignBranchUserDto } from './dto/assign-branch-user.dto';
import {
  SetBranchFeatureDto,
  UpsertCompanyFeatureDto,
} from './dto/branch-feature.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import {
  UpdateBranchDto,
  UpdateBranchStatusDto,
} from './dto/update-branch.dto';
import { BranchFeature } from './entities/branch-feature.entity';
import { BranchUser } from './entities/branch-user.entity';
import { Branch } from './entities/branch.entity';
import { CompanyFeature } from './entities/company-feature.entity';
import { AuditService } from '../../shared/audit/audit.service';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>,

    @InjectRepository(CompanyFeature)
    private readonly companyFeatureRepository: Repository<CompanyFeature>,

    @InjectRepository(BranchFeature)
    private readonly branchFeatureRepository: Repository<BranchFeature>,

    @InjectRepository(CompanyUser)
    private readonly companyUserRepository: Repository<CompanyUser>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    return (
      driverError?.code === '23505' ||
      driverError?.code === 'ER_DUP_ENTRY' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private async requireBranch(
    companyId: string,
    branchId: string,
  ): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, company_id: companyId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async requireCompanyFeature(
    companyId: string,
    featureId: string,
  ): Promise<CompanyFeature> {
    const feature = await this.companyFeatureRepository.findOne({
      where: { id: featureId, company_id: companyId },
    });
    if (!feature) {
      throw new NotFoundException('Company feature not found');
    }
    return feature;
  }

  // ─── Branch CRUD ─────────────────────────────────────────────────────────────

  async createBranch(companyId: string, dto: CreateBranchDto): Promise<Branch> {
    if (dto.manager_id) {
      await this.validateManagerBelongsToCompany(dto.manager_id, companyId);
    }

    const branch = this.branchRepository.create({
      company_id: companyId,
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      sale_point_code: dto.sale_point_code ?? null,
      sale_point_name: dto.sale_point_name ?? null,
      status: 'active',
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      manager_id: dto.manager_id ?? null,
    });

    try {
      return await this.branchRepository.save(branch);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A branch with code "${dto.code.trim().toUpperCase()}" already exists in this company`,
        );
      }
      throw error;
    }
  }

  async findAllBranches(companyId: string, query: PaginationDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
    } = query;

    const allowedSortFields = [
      'name',
      'code',
      'status',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.manager', 'manager')
      .where('branch.company_id = :companyId', { companyId })
      .orderBy(`branch.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(branch.name ILIKE :term OR branch.code ILIKE :term OR branch.email ILIKE :term OR branch.phone ILIKE :term)',
        { term },
      );
    }

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: items.map((b) => this.mapBranchSummary(b)),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findBranchById(companyId: string, branchId: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, company_id: companyId },
      relations: { manager: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async updateBranch(
    companyId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.requireBranch(companyId, branchId);

    if (dto.manager_id !== undefined && dto.manager_id !== null) {
      await this.validateManagerBelongsToCompany(dto.manager_id, companyId);
    }

    if (dto.name !== undefined) branch.name = dto.name.trim();
    if (dto.code !== undefined) branch.code = dto.code.trim().toUpperCase();
    if (dto.sale_point_code !== undefined)
      branch.sale_point_code = dto.sale_point_code ?? null;
    if (dto.sale_point_name !== undefined)
      branch.sale_point_name = dto.sale_point_name ?? null;
    if (dto.address !== undefined) branch.address = dto.address ?? null;
    if (dto.phone !== undefined) branch.phone = dto.phone ?? null;
    if (dto.email !== undefined) branch.email = dto.email ?? null;
    if (dto.manager_id !== undefined)
      branch.manager_id = dto.manager_id ?? null;

    try {
      return await this.branchRepository.save(branch);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A branch with code "${branch.code}" already exists in this company`,
        );
      }
      throw error;
    }
  }

  async setBranchStatus(
    companyId: string,
    branchId: string,
    dto: UpdateBranchStatusDto,
  ): Promise<Branch> {
    const branch = await this.requireBranch(companyId, branchId);
    branch.status = dto.status;
    return this.branchRepository.save(branch);
  }

  async deleteBranch(companyId: string, branchId: string): Promise<void> {
    const branch = await this.requireBranch(companyId, branchId);
    await this.branchRepository.softDelete(branch.id);
  }

  // ─── Branch User Management ──────────────────────────────────────────────────

  async assignUserToBranch(
    companyId: string,
    branchId: string,
    dto: AssignBranchUserDto,
  ): Promise<BranchUser> {
    const result = await this.assignUsersToBranch(
      companyId,
      branchId,
      dto,
      undefined,
    );
    return result.assignments[0];
  }

  async assignUsersToBranch(
    companyId: string,
    branchId: string,
    dto: AssignBranchUserDto,
    actorId?: string,
  ) {
    const companyUserIds = dto.company_user_ids?.length
      ? dto.company_user_ids
      : [dto.company_user_id];
    const makeActive = dto.make_active ?? dto.is_primary ?? false;

    return this.dataSource.transaction(async (manager) => {
      const branchRepo = manager.getRepository(Branch);
      const branchUserRepo = manager.getRepository(BranchUser);
      const membershipRepo = manager.getRepository(CompanyUser);
      const branch = await branchRepo.findOne({
        where: { id: branchId, company_id: companyId, status: 'active' },
      });
      if (!branch) throw new NotFoundException('Active branch not found');

      const memberships = await membershipRepo.find({
        where: {
          id: In(companyUserIds),
          company_id: companyId,
          status: 'active',
        },
      });
      if (memberships.length !== companyUserIds.length) {
        throw new NotFoundException(
          'One or more users do not belong to this company',
        );
      }

      const assignments: BranchUser[] = [];
      for (const membership of memberships) {
        const existing = await branchUserRepo.findOne({
          where: { branch_id: branchId, company_user_id: membership.id },
        });
        if (existing) {
          throw new ConflictException(
            'User is already assigned to this branch',
          );
        }

        const hasActive = await branchUserRepo.findOne({
          where: { company_user_id: membership.id, is_active_branch: true },
        });
        const shouldActivate = makeActive || !hasActive;
        if (shouldActivate) {
          await branchUserRepo.update(
            { company_user_id: membership.id },
            { is_active_branch: false },
          );
        }

        const assignment = branchUserRepo.create({
          branch_id: branchId,
          company_user_id: membership.id,
          is_primary: shouldActivate,
          is_active_branch: shouldActivate,
          assigned_by: actorId ?? null,
          activated_at: shouldActivate ? new Date() : null,
          activated_by: shouldActivate ? (actorId ?? null) : null,
        });
        assignments.push(await branchUserRepo.save(assignment));
      }
      return { branch, assignments };
    });
  }

  async getEligibleBranchUsers(
    companyId: string,
    branchId: string,
    search?: string,
  ) {
    await this.requireBranch(companyId, branchId);
    const qb = this.companyUserRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.company_id = :companyId', { companyId })
      .andWhere('membership.status = :status', { status: 'active' })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM branch_users bu WHERE bu.company_user_id = membership.id AND bu.branch_id = :branchId)`,
        { branchId },
      )
      .orderBy('user.first_name', 'ASC');
    if (search?.trim()) {
      qb.andWhere(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search OR user.user_no ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }
    const memberships = await qb.getMany();
    return memberships.map((membership) => ({
      company_user_id: membership.id,
      user: {
        id: membership.user.id,
        user_no: membership.user.user_no,
        first_name: membership.user.first_name,
        last_name: membership.user.last_name,
        email: membership.user.email,
        officer_title: membership.user.officer_title,
      },
    }));
  }

  async removeUserFromBranch(
    companyId: string,
    branchId: string,
    companyUserId: string,
  ): Promise<{ message: string }> {
    return this.removeUsersFromBranch(companyId, branchId, [companyUserId]);
  }

  async removeUsersFromBranch(
    companyId: string,
    branchId: string,
    companyUserIds: string[],
    replacementBranchId?: string,
    actorId?: string,
  ): Promise<{ message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const branchUserRepo = manager.getRepository(BranchUser);
      const branchRepo = manager.getRepository(Branch);
      const branch = await branchRepo.findOne({
        where: { id: branchId, company_id: companyId },
      });
      if (!branch) throw new NotFoundException('Branch not found');

      for (const companyUserId of companyUserIds) {
        const assignment = await branchUserRepo.findOne({
          where: { branch_id: branchId, company_user_id: companyUserId },
        });
        if (!assignment)
          throw new NotFoundException('User is not assigned to this branch');

        const otherAssignments = await branchUserRepo.find({
          where: { company_user_id: companyUserId },
          relations: { branch: true },
        });
        if (assignment.is_active_branch) {
          const others = otherAssignments.filter(
            (item) => item.id !== assignment.id,
          );
          if (!others.length) {
            throw new ConflictException(
              'Cannot remove the user’s only active branch assignment',
            );
          }
          const replacement = replacementBranchId
            ? others.find((item) => item.branch_id === replacementBranchId)
            : undefined;
          if (!replacement) {
            throw new ConflictException(
              'Select another assigned branch before removing the active branch',
            );
          }
          await branchUserRepo.update(
            { company_user_id: companyUserId },
            { is_active_branch: false },
          );
          await branchUserRepo.update(replacement.id, {
            is_active_branch: true,
            is_primary: true,
            activated_at: new Date(),
            activated_by: actorId ?? null,
          });
        }
        await branchUserRepo.delete(assignment.id);
      }
      return { message: 'User branch assignment(s) removed successfully' };
    });
  }

  async setUserActiveBranch(
    companyId: string,
    companyUserId: string,
    branchId: string,
    actorId?: string,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const branchUserRepo = manager.getRepository(BranchUser);
      const membershipRepo = manager.getRepository(CompanyUser);
      const membership = await membershipRepo.findOne({
        where: { id: companyUserId, company_id: companyId, status: 'active' },
      });
      if (!membership) throw new NotFoundException('Company user not found');
      const assignment = await branchUserRepo.findOne({
        where: { company_user_id: companyUserId, branch_id: branchId },
        relations: { branch: true },
      });
      if (
        !assignment ||
        assignment.branch.company_id !== companyId ||
        assignment.branch.status !== 'active'
      ) {
        throw new ForbiddenException(
          'User is not assigned to this active branch',
        );
      }
      await branchUserRepo.update(
        { company_user_id: companyUserId },
        { is_active_branch: false },
      );
      assignment.is_active_branch = true;
      assignment.is_primary = true;
      assignment.activated_at = new Date();
      assignment.activated_by = actorId ?? null;
      return branchUserRepo.save(assignment);
    });
    await this.auditService.log({
      userId: actorId,
      companyId,
      action: 'branch.active_changed',
      resource: 'branch_user',
      resourceId: result.id,
      metadata: { companyUserId, branchId },
    });
    return result;
  }

  async getBranchUsers(companyId: string, branchId: string) {
    await this.requireBranch(companyId, branchId);

    const assignments = await this.branchUserRepository.find({
      where: { branch_id: branchId },
      relations: {
        company_user: {
          user: true,
        },
      },
      order: { created_at: 'ASC' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      company_user_id: assignment.company_user_id,
      is_primary: assignment.is_primary,
      is_active_branch: assignment.is_active_branch,
      assigned_at: assignment.created_at,
      user: {
        id: assignment.company_user.user.id,
        user_no: assignment.company_user.user.user_no,
        first_name: assignment.company_user.user.first_name,
        last_name: assignment.company_user.user.last_name,
        email: assignment.company_user.user.email,
        phone: assignment.company_user.user.phone,
        status: assignment.company_user.user.status,
        officer_title: assignment.company_user.user.officer_title,
      },
    }));
  }

  async getUserBranches(companyId: string, companyUserId: string) {
    const membership = await this.companyUserRepository.findOne({
      where: { id: companyUserId, company_id: companyId },
    });
    if (!membership) {
      throw new NotFoundException('Company user not found');
    }

    const assignments = await this.branchUserRepository.find({
      where: { company_user_id: companyUserId },
      relations: { branch: true },
      order: { is_primary: 'DESC', created_at: 'ASC' },
    });

    return assignments
      .filter((a) => a.branch.company_id === companyId && !a.branch.deleted_at)
      .map((a) => ({
        id: a.id,
        is_primary: a.is_primary,
        is_active_branch: a.is_active_branch,
        branch: this.mapBranchSummary(a.branch),
      }));
  }

  // ─── Company Feature Management ──────────────────────────────────────────────

  async upsertCompanyFeature(
    companyId: string,
    dto: UpsertCompanyFeatureDto,
  ): Promise<CompanyFeature> {
    const featureKey = dto.feature_key.trim().toLowerCase();

    let feature = await this.companyFeatureRepository.findOne({
      where: { company_id: companyId, feature_key: featureKey },
    });

    if (!feature) {
      feature = this.companyFeatureRepository.create({
        company_id: companyId,
        feature_key: featureKey,
        display_name: dto.display_name.trim(),
        description: dto.description ?? null,
        is_enabled: dto.is_enabled ?? true,
        metadata: dto.metadata ?? null,
      });
    } else {
      feature.display_name = dto.display_name.trim();
      if (dto.description !== undefined)
        feature.description = dto.description ?? null;
      if (dto.is_enabled !== undefined) feature.is_enabled = dto.is_enabled;
      if (dto.metadata !== undefined) feature.metadata = dto.metadata ?? null;
    }

    return this.companyFeatureRepository.save(feature);
  }

  async getCompanyFeatures(companyId: string): Promise<CompanyFeature[]> {
    return this.companyFeatureRepository.find({
      where: { company_id: companyId },
      order: { feature_key: 'ASC' },
    });
  }

  async deleteCompanyFeature(
    companyId: string,
    featureId: string,
  ): Promise<void> {
    const feature = await this.requireCompanyFeature(companyId, featureId);
    await this.companyFeatureRepository.delete(feature.id);
  }

  // ─── Branch Feature Management ───────────────────────────────────────────────

  async getEffectiveBranchFeatures(companyId: string, branchId: string) {
    await this.requireBranch(companyId, branchId);

    const companyFeatures = await this.companyFeatureRepository.find({
      where: { company_id: companyId },
      order: { feature_key: 'ASC' },
    });

    const branchOverrides = await this.branchFeatureRepository.find({
      where: { branch_id: branchId },
    });

    const overrideMap = new Map(
      branchOverrides.map((o) => [o.company_feature_id, o]),
    );

    return companyFeatures.map((cf) => {
      const override = overrideMap.get(cf.id);
      const branchEnabled = cf.is_enabled
        ? (override?.is_enabled ?? true)
        : false;

      return {
        company_feature_id: cf.id,
        feature_key: cf.feature_key,
        display_name: cf.display_name,
        description: cf.description,
        company_enabled: cf.is_enabled,
        branch_enabled: branchEnabled,
        has_branch_override: !!override,
        branch_feature_id: override?.id ?? null,
      };
    });
  }

  async setBranchFeature(
    companyId: string,
    branchId: string,
    companyFeatureId: string,
    dto: SetBranchFeatureDto,
  ): Promise<BranchFeature> {
    await this.requireBranch(companyId, branchId);

    const companyFeature = await this.requireCompanyFeature(
      companyId,
      companyFeatureId,
    );

    if (!companyFeature.is_enabled && dto.is_enabled) {
      throw new ForbiddenException(
        'Cannot enable a feature that is disabled at the company level',
      );
    }

    let override = await this.branchFeatureRepository.findOne({
      where: { branch_id: branchId, company_feature_id: companyFeatureId },
    });

    if (!override) {
      override = this.branchFeatureRepository.create({
        branch_id: branchId,
        company_feature_id: companyFeatureId,
        is_enabled: dto.is_enabled,
      });
    } else {
      override.is_enabled = dto.is_enabled;
    }

    return this.branchFeatureRepository.save(override);
  }

  async deleteBranchFeatureOverride(
    companyId: string,
    branchId: string,
    companyFeatureId: string,
  ): Promise<void> {
    await this.requireBranch(companyId, branchId);
    await this.requireCompanyFeature(companyId, companyFeatureId);

    await this.branchFeatureRepository.delete({
      branch_id: branchId,
      company_feature_id: companyFeatureId,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async validateManagerBelongsToCompany(
    userId: string,
    companyId: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Manager user not found');

    const membership = await this.companyUserRepository.findOne({
      where: { user_id: userId, company_id: companyId, status: 'active' },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException(
        'The specified manager is not an active member of this company',
      );
    }
  }

  private mapBranchSummary(branch: Branch) {
    return {
      id: branch.id,
      company_id: branch.company_id,
      name: branch.name,
      code: branch.code,
      sale_point_code: branch.sale_point_code,
      sale_point_name: branch.sale_point_name,
      status: branch.status,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      manager_id: branch.manager_id,
      manager: branch.manager
        ? {
            id: branch.manager.id,
            first_name: branch.manager.first_name,
            last_name: branch.manager.last_name,
            email: branch.manager.email,
          }
        : null,
      created_at: branch.created_at,
      updated_at: branch.updated_at,
    };
  }
}
