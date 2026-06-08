import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  PaginationDto,
  SortDirection,
} from '@insurance-max/portal-shared/dto/pagination.dto';
import { CompanyUser } from '../companies/entities/company-user.entity';
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
    await this.requireBranch(companyId, branchId);

    const membership = await this.companyUserRepository.findOne({
      where: {
        id: dto.company_user_id,
        company_id: companyId,
        status: 'active',
      },
    });
    if (!membership) {
      throw new NotFoundException(
        'Company user not found or does not belong to this company',
      );
    }

    const existing = await this.branchUserRepository.findOne({
      where: { branch_id: branchId, company_user_id: dto.company_user_id },
    });
    if (existing) {
      throw new ConflictException('User is already assigned to this branch');
    }

    const branchUser = this.branchUserRepository.create({
      branch_id: branchId,
      company_user_id: dto.company_user_id,
      is_primary: dto.is_primary ?? false,
    });

    return this.branchUserRepository.save(branchUser);
  }

  async removeUserFromBranch(
    companyId: string,
    branchId: string,
    companyUserId: string,
  ): Promise<{ message: string }> {
    await this.requireBranch(companyId, branchId);

    const branchUser = await this.branchUserRepository.findOne({
      where: { branch_id: branchId, company_user_id: companyUserId },
    });
    if (!branchUser) {
      throw new NotFoundException('User is not assigned to this branch');
    }

    await this.branchUserRepository.delete(branchUser.id);
    return { message: 'User removed from branch successfully' };
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
      assigned_at: assignment.created_at,
      user: {
        id: assignment.company_user.user.id,
        user_no: assignment.company_user.user.user_no,
        first_name: assignment.company_user.user.first_name,
        last_name: assignment.company_user.user.last_name,
        email: assignment.company_user.user.email,
        phone: assignment.company_user.user.phone,
        status: assignment.company_user.user.status,
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
