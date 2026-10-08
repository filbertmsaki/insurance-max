import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessStatus } from '@insurance-max/portal-shared/enums/access-status.enum';
import {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from '@insurance-max/contracts';
import { Branch } from '../branches/entities/branch.entity';
import { Department } from '../departments/entities/department.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import {
  ResolveProductAccessDto,
  UpsertBranchProductAccessDto,
  UpsertDepartmentProductAccessDto,
  UpsertUserProductAccessDto,
} from './dto/upsert-product-access.dto';
import { BranchProductAccess } from './entities/branch-product-access.entity';
import { DepartmentProductAccess } from './entities/department-product-access.entity';
import { UserProductAccess } from './entities/user-product-access.entity';

export interface ProductAccessResolution {
  can_view: boolean;
  can_create_policy: boolean;
  resolved_via: 'user' | 'department' | 'branch' | 'default';
}

@Injectable()
export class ProductAccessService {
  constructor(
    @InjectRepository(BranchProductAccess)
    private readonly branchAccessRepo: Repository<BranchProductAccess>,

    @InjectRepository(DepartmentProductAccess)
    private readonly deptAccessRepo: Repository<DepartmentProductAccess>,

    @InjectRepository(UserProductAccess)
    private readonly userAccessRepo: Repository<UserProductAccess>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

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
    dto: UpsertBranchProductAccessDto,
    userId: string,
  ): Promise<BranchProductAccess> {
    await this.validateBranch(companyId, dto.branch_id);
    await this.validateProduct(companyId, dto.product_id);

    let record = await this.branchAccessRepo.findOne({
      where: {
        company_id: companyId,
        branch_id: dto.branch_id,
        product_id: dto.product_id,
      },
      withDeleted: true,
    });

    if (!record) {
      record = this.branchAccessRepo.create({
        company_id: companyId,
        branch_id: dto.branch_id,
        product_id: dto.product_id,
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
  ): Promise<BranchProductAccess[]> {
    await this.validateBranch(companyId, branchId);
    return this.branchAccessRepo.find({
      where: { company_id: companyId, branch_id: branchId, is_active: true },
      relations: { product: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteBranchAccess(companyId: string, id: string): Promise<void> {
    const record = await this.branchAccessRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!record)
      throw new NotFoundException('Branch product access record not found');
    await this.branchAccessRepo.softDelete(record.id);
  }

  // ─── Department Access ────────────────────────────────────────────────────────

  async upsertDepartmentAccess(
    companyId: string,
    dto: UpsertDepartmentProductAccessDto,
    userId: string,
  ): Promise<DepartmentProductAccess> {
    await this.validateDepartment(companyId, dto.department_id);
    await this.validateProduct(companyId, dto.product_id);

    let record = await this.deptAccessRepo.findOne({
      where: {
        company_id: companyId,
        department_id: dto.department_id,
        product_id: dto.product_id,
      },
      withDeleted: true,
    });

    if (!record) {
      record = this.deptAccessRepo.create({
        company_id: companyId,
        department_id: dto.department_id,
        product_id: dto.product_id,
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
  ): Promise<DepartmentProductAccess[]> {
    await this.validateDepartment(companyId, departmentId);
    return this.deptAccessRepo.find({
      where: {
        company_id: companyId,
        department_id: departmentId,
        is_active: true,
      },
      relations: { product: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteDepartmentAccess(companyId: string, id: string): Promise<void> {
    const record = await this.deptAccessRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!record)
      throw new NotFoundException('Department product access record not found');
    await this.deptAccessRepo.softDelete(record.id);
  }

  // ─── User Access ──────────────────────────────────────────────────────────────

  async upsertUserAccess(
    companyId: string,
    dto: UpsertUserProductAccessDto,
    userId: string,
  ): Promise<UserProductAccess> {
    await this.validateCompanyUser(companyId, dto.company_user_id);
    await this.validateProduct(companyId, dto.product_id);

    let record = await this.userAccessRepo.findOne({
      where: {
        company_id: companyId,
        company_user_id: dto.company_user_id,
        product_id: dto.product_id,
      },
      withDeleted: true,
    });

    if (!record) {
      record = this.userAccessRepo.create({
        company_id: companyId,
        company_user_id: dto.company_user_id,
        product_id: dto.product_id,
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
  ): Promise<UserProductAccess[]> {
    await this.validateCompanyUser(companyId, companyUserId);
    return this.userAccessRepo.find({
      where: {
        company_id: companyId,
        company_user_id: companyUserId,
        is_active: true,
      },
      relations: { product: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteUserAccess(companyId: string, id: string): Promise<void> {
    const record = await this.userAccessRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!record)
      throw new NotFoundException('User product access record not found');
    await this.userAccessRepo.softDelete(record.id);
  }

  // ─── Access Resolution ────────────────────────────────────────────────────────

  async resolveAccess(
    companyId: string,
    dto: ResolveProductAccessDto,
  ): Promise<ProductAccessResolution> {
    await this.validateCompanyUser(companyId, dto.company_user_id);
    if (dto.branch_id) await this.validateBranch(companyId, dto.branch_id);
    if (dto.department_id) {
      const department = await this.validateDepartment(
        companyId,
        dto.department_id,
      );
      if (
        dto.branch_id &&
        department.branch_id &&
        department.branch_id !== dto.branch_id
      ) {
        throw new BadRequestException(
          'Department does not belong to the selected branch',
        );
      }
    }
    await this.validateProduct(companyId, dto.product_id);
    const userRule = await this.userAccessRepo.findOne({
      where: {
        company_id: companyId,
        company_user_id: dto.company_user_id,
        product_id: dto.product_id,
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

    if (dto.department_id) {
      const deptRule = await this.deptAccessRepo.findOne({
        where: {
          company_id: companyId,
          department_id: dto.department_id,
          product_id: dto.product_id,
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

    if (dto.branch_id) {
      const branchRule = await this.branchAccessRepo.findOne({
        where: {
          company_id: companyId,
          branch_id: dto.branch_id,
          product_id: dto.product_id,
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

    return {
      can_view: false,
      can_create_policy: false,
      resolved_via: 'default',
    };
  }

  async getAccessibleProducts(
    companyId: string,
    companyUserId: string,
    branchId?: string,
    departmentId?: string,
    categoryId?: string,
  ) {
    await this.validateCompanyUser(companyId, companyUserId);
    if (branchId) await this.validateBranch(companyId, branchId);
    if (departmentId) await this.validateDepartment(companyId, departmentId);
    const whereClause: any = { company_id: companyId, is_active: true };
    if (categoryId) whereClause.category_id = categoryId;

    const allProducts = await this.productRepository.find({
      where: whereClause,
      relations: { category: true },
      order: { product_name: 'ASC' },
    });

    const results = await Promise.all(
      allProducts.map(async (product) => {
        const access = await this.resolveAccess(companyId, {
          product_id: product.id,
          company_user_id: companyUserId,
          branch_id: branchId,
          department_id: departmentId,
        });
        return { ...product, access };
      }),
    );

    return results.filter((p) => p.access.can_view);
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
  ): Promise<Department> {
    const dept = await this.departmentRepository.findOne({
      where: { id: departmentId, company_id: companyId },
    });
    if (!dept)
      throw new BadRequestException(
        'Department not found or does not belong to this company',
      );
    return dept;
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

  private async validateProduct(
    companyId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        company_id: companyId,
        lifecycle_status: ProductLifecycleStatus.ACTIVE,
        is_active: true,
      },
      relations: { current_version: true },
    });

    if (
      !product ||
      !product.current_version ||
      product.current_version.status !== ProductVersionStatus.PUBLISHED ||
      !product.current_version.is_submission_ready
    ) {
      throw new BadRequestException(
        'Only an active product with an approved published definition can receive access rules',
      );
    }
  }
}
