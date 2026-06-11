import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessStatus } from '@insurance-max/portal-shared/enums/access-status.enum';
import { Branch } from '../branches/entities/branch.entity';
import { Department } from '../departments/entities/department.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import {
  ResolveAccessDto,
  UpsertBranchCategoryAccessDto,
  UpsertDepartmentCategoryAccessDto,
  UpsertUserCategoryAccessDto,
} from './dto/upsert-category-access.dto';
import { BranchCategoryAccess } from './entities/branch-category-access.entity';
import { DepartmentCategoryAccess } from './entities/department-category-access.entity';
import { UserCategoryAccess } from './entities/user-category-access.entity';

export interface AccessResolution {
  can_view: boolean;
  can_create_policy: boolean;
  resolved_via: 'user' | 'department' | 'branch' | 'default';
}

@Injectable()
export class CategoryAccessService {
  constructor(
    @InjectRepository(BranchCategoryAccess)
    private readonly branchAccessRepo: Repository<BranchCategoryAccess>,

    @InjectRepository(DepartmentCategoryAccess)
    private readonly deptAccessRepo: Repository<DepartmentCategoryAccess>,

    @InjectRepository(UserCategoryAccess)
    private readonly userAccessRepo: Repository<UserCategoryAccess>,

    @InjectRepository(InsuranceCategory)
    private readonly categoryRepository: Repository<InsuranceCategory>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,

    @InjectRepository(CompanyUser)
    private readonly companyUserRepository: Repository<CompanyUser>,
  ) {}

  // ─── Branch Access ────────────────────────────────────────────────────────────

  async upsertBranchAccess(
    companyId: string,
    dto: UpsertBranchCategoryAccessDto,
    userId: string,
  ): Promise<BranchCategoryAccess> {
    await this.validateBranch(companyId, dto.branch_id);
    await this.validateCategory(companyId, dto.category_id);

    let record = await this.branchAccessRepo.findOne({
      where: {
        company_id: companyId,
        branch_id: dto.branch_id,
        category_id: dto.category_id,
      },
      withDeleted: true,
    });

    if (!record) {
      record = this.branchAccessRepo.create({
        company_id: companyId,
        branch_id: dto.branch_id,
        category_id: dto.category_id,
        created_by: userId,
      });
    } else if (record.deleted_at) {
      record.deleted_at = null;
    }

    record.can_view = dto.can_view ?? true;
    record.can_create_policy = dto.can_create_policy ?? false;
    record.access_status = dto.access_status ?? AccessStatus.ALLOW;
    record.is_active = dto.is_active ?? true;
    record.updated_by = userId;

    return this.branchAccessRepo.save(record);
  }

  async getBranchAccess(
    companyId: string,
    branchId: string,
  ): Promise<BranchCategoryAccess[]> {
    await this.validateBranch(companyId, branchId);
    return this.branchAccessRepo.find({
      where: { company_id: companyId, branch_id: branchId, is_active: true },
      relations: { category: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteBranchAccess(companyId: string, id: string): Promise<void> {
    const record = await this.branchAccessRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!record)
      throw new NotFoundException('Branch category access record not found');
    await this.branchAccessRepo.softDelete(record.id);
  }

  // ─── Department Access ────────────────────────────────────────────────────────

  async upsertDepartmentAccess(
    companyId: string,
    dto: UpsertDepartmentCategoryAccessDto,
    userId: string,
  ): Promise<DepartmentCategoryAccess> {
    await this.validateDepartment(companyId, dto.department_id);
    await this.validateCategory(companyId, dto.category_id);

    let record = await this.deptAccessRepo.findOne({
      where: {
        company_id: companyId,
        department_id: dto.department_id,
        category_id: dto.category_id,
      },
      withDeleted: true,
    });

    if (!record) {
      record = this.deptAccessRepo.create({
        company_id: companyId,
        department_id: dto.department_id,
        category_id: dto.category_id,
        created_by: userId,
      });
    } else if (record.deleted_at) {
      record.deleted_at = null;
    }

    record.can_view = dto.can_view ?? true;
    record.can_create_policy = dto.can_create_policy ?? false;
    record.access_status = dto.access_status ?? AccessStatus.ALLOW;
    record.is_active = dto.is_active ?? true;
    record.updated_by = userId;

    return this.deptAccessRepo.save(record);
  }

  async getDepartmentAccess(
    companyId: string,
    departmentId: string,
  ): Promise<DepartmentCategoryAccess[]> {
    await this.validateDepartment(companyId, departmentId);
    return this.deptAccessRepo.find({
      where: {
        company_id: companyId,
        department_id: departmentId,
        is_active: true,
      },
      relations: { category: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteDepartmentAccess(companyId: string, id: string): Promise<void> {
    const record = await this.deptAccessRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!record)
      throw new NotFoundException(
        'Department category access record not found',
      );
    await this.deptAccessRepo.softDelete(record.id);
  }

  // ─── User Access ──────────────────────────────────────────────────────────────

  async upsertUserAccess(
    companyId: string,
    dto: UpsertUserCategoryAccessDto,
    userId: string,
  ): Promise<UserCategoryAccess> {
    await this.validateCompanyUser(companyId, dto.company_user_id);
    await this.validateCategory(companyId, dto.category_id);

    let record = await this.userAccessRepo.findOne({
      where: {
        company_id: companyId,
        company_user_id: dto.company_user_id,
        category_id: dto.category_id,
      },
      withDeleted: true,
    });

    if (!record) {
      record = this.userAccessRepo.create({
        company_id: companyId,
        company_user_id: dto.company_user_id,
        category_id: dto.category_id,
        created_by: userId,
      });
    } else if (record.deleted_at) {
      record.deleted_at = null;
    }

    record.can_view = dto.can_view ?? true;
    record.can_create_policy = dto.can_create_policy ?? false;
    record.access_status = dto.access_status ?? AccessStatus.ALLOW;
    record.is_active = dto.is_active ?? true;
    record.updated_by = userId;

    return this.userAccessRepo.save(record);
  }

  async getUserAccess(
    companyId: string,
    companyUserId: string,
  ): Promise<UserCategoryAccess[]> {
    await this.validateCompanyUser(companyId, companyUserId);
    return this.userAccessRepo.find({
      where: {
        company_id: companyId,
        company_user_id: companyUserId,
        is_active: true,
      },
      relations: { category: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteUserAccess(companyId: string, id: string): Promise<void> {
    const record = await this.userAccessRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!record)
      throw new NotFoundException('User category access record not found');
    await this.userAccessRepo.softDelete(record.id);
  }

  // ─── Access Resolution (Priority-based) ──────────────────────────────────────

  async resolveAccess(
    companyId: string,
    dto: ResolveAccessDto,
  ): Promise<AccessResolution> {
    // 1. User-level rule (highest priority)
    const userRule = await this.userAccessRepo.findOne({
      where: {
        company_id: companyId,
        company_user_id: dto.company_user_id,
        category_id: dto.category_id,
        is_active: true,
      },
    });

    if (userRule) {
      return {
        can_view:
          userRule.access_status === AccessStatus.ALLOW
            ? userRule.can_view
            : false,
        can_create_policy:
          userRule.access_status === AccessStatus.ALLOW
            ? userRule.can_create_policy
            : false,
        resolved_via: 'user',
      };
    }

    // 2. Department-level rule
    if (dto.department_id) {
      const deptRule = await this.deptAccessRepo.findOne({
        where: {
          company_id: companyId,
          department_id: dto.department_id,
          category_id: dto.category_id,
          is_active: true,
        },
      });

      if (deptRule) {
        return {
          can_view:
            deptRule.access_status === AccessStatus.ALLOW
              ? deptRule.can_view
              : false,
          can_create_policy:
            deptRule.access_status === AccessStatus.ALLOW
              ? deptRule.can_create_policy
              : false,
          resolved_via: 'department',
        };
      }
    }

    // 3. Branch-level rule
    if (dto.branch_id) {
      const branchRule = await this.branchAccessRepo.findOne({
        where: {
          company_id: companyId,
          branch_id: dto.branch_id,
          category_id: dto.category_id,
          is_active: true,
        },
      });

      if (branchRule) {
        return {
          can_view:
            branchRule.access_status === AccessStatus.ALLOW
              ? branchRule.can_view
              : false,
          can_create_policy:
            branchRule.access_status === AccessStatus.ALLOW
              ? branchRule.can_create_policy
              : false,
          resolved_via: 'branch',
        };
      }
    }

    // 4. Default: no access rule found
    return {
      can_view: false,
      can_create_policy: false,
      resolved_via: 'default',
    };
  }

  async getAccessibleCategories(
    companyId: string,
    companyUserId: string,
    branchId?: string,
    departmentId?: string,
  ) {
    const allCategories = await this.categoryRepository.find({
      where: { company_id: companyId, is_active: true },
      order: { name: 'ASC' },
    });

    const results = await Promise.all(
      allCategories.map(async (category) => {
        const access = await this.resolveAccess(companyId, {
          category_id: category.id,
          company_user_id: companyUserId,
          branch_id: branchId,
          department_id: departmentId,
        });
        return { ...category, access };
      }),
    );

    return results.filter((c) => c.access.can_view);
  }

  // ─── Validators ───────────────────────────────────────────────────────────────

  private async validateBranch(
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, company_id: companyId },
    });
    if (!branch)
      throw new BadRequestException(
        'Branch not found or does not belong to this company',
      );
  }

  private async validateDepartment(
    companyId: string,
    departmentId: string,
  ): Promise<void> {
    const dept = await this.departmentRepository.findOne({
      where: { id: departmentId, company_id: companyId },
    });
    if (!dept)
      throw new BadRequestException(
        'Department not found or does not belong to this company',
      );
  }

  private async validateCompanyUser(
    companyId: string,
    companyUserId: string,
  ): Promise<void> {
    const cu = await this.companyUserRepository.findOne({
      where: { id: companyUserId, company_id: companyId },
    });
    if (!cu)
      throw new BadRequestException(
        'Company user not found or does not belong to this company',
      );
  }

  private async validateCategory(
    companyId: string,
    categoryId: string,
  ): Promise<void> {
    const cat = await this.categoryRepository.findOne({
      where: { id: categoryId, company_id: companyId },
    });
    if (!cat)
      throw new BadRequestException(
        'Category not found or does not belong to this company',
      );
  }
}
