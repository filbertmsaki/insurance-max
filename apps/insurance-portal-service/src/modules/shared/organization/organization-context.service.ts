import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type { OrganizationContext } from '@insurance-max/contracts';

import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { BranchUser } from '../../tenant/branches/entities/branch-user.entity';
import { DepartmentUser } from '../../tenant/departments/entities/department-user.entity';
import { TiramisCompanyConfigurationEntity } from '../../tiramis/entities/tiramis-company-configuration.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';

@Injectable()
export class OrganizationContextService {
  constructor(
    @InjectRepository(CompanyUser)
    private readonly membershipRepository: Repository<CompanyUser>,

    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>,

    @InjectRepository(DepartmentUser)
    private readonly departmentUserRepository: Repository<DepartmentUser>,

    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,

    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly configurationRepository: Repository<TiramisCompanyConfigurationEntity>,

    private readonly configService: ConfigService,
  ) {}

  async resolve(
    userId: string,
    companyId: string,
  ): Promise<OrganizationContext> {
    const membership = await this.membershipRepository.findOne({
      where: {
        user_id: userId,
        company_id: companyId,
        status: 'active',
      },
      relations: { company: true },
    });

    if (!membership || membership.company.status !== 'active') {
      throw new NotFoundException('Active company membership was not found.');
    }

    const branchAssignments = await this.branchUserRepository.find({
      where: {
        company_user_id: membership.id,
        branch: {
          company_id: companyId,
          status: 'active',
        },
      },
      relations: { branch: true },
      order: {
        is_active_branch: 'DESC',
        is_primary: 'DESC',
        created_at: 'ASC',
      },
    });

    const validBranches = branchAssignments.filter(
      (assignment) => !assignment.branch.deleted_at,
    );

    const activeBranchAssignment =
      validBranches.find((assignment) => assignment.is_active_branch) ??
      validBranches.find((assignment) => assignment.is_primary) ??
      validBranches[0];

    const activeBranch = activeBranchAssignment?.branch ?? null;

    const departmentAssignments = await this.departmentUserRepository.find({
      where: {
        company_user_id: membership.id,
        company_id: companyId,
        department: { status: 'active' },
      },
      relations: { department: true },
      order: {
        is_active_department: 'DESC',
        is_primary: 'DESC',
        created_at: 'ASC',
      },
    });

    const compatibleDepartments = departmentAssignments.filter(
      (assignment) =>
        assignment.department.branch_id === null ||
        assignment.department.branch_id === activeBranch?.id,
    );

    const activeDepartmentAssignment =
      compatibleDepartments.find(
        (assignment) => assignment.is_active_department,
      ) ??
      compatibleDepartments.find((assignment) => assignment.is_primary) ??
      compatibleDepartments[0];

    const activeDepartment = activeDepartmentAssignment?.department ?? null;

    const defaultSalePoint = activeBranch
      ? await this.salePointRepository.findOne({
          where: {
            companyId,
            branchId: activeBranch.id,
            isActive: true,
            isDefault: true,
            deletedAt: IsNull(),
          },
        })
      : null;

    const environment = this.resolveTiramisEnvironment();

    const configuration = await this.configurationRepository.findOne({
      where: {
        companyId,
        environment,
        isActive: true,
      },
    });

    const missingRequirements: string[] = [];

    if (!activeBranch) {
      missingRequirements.push('ACTIVE_BRANCH');
    }

    if (activeBranch && !defaultSalePoint) {
      missingRequirements.push('DEFAULT_SALE_POINT');
    }

    if (membership.company.tira_integration_enabled && !configuration) {
      missingRequirements.push('TIRAMIS_COMPANY_CONFIGURATION');
    }

    if (configuration && configuration.validationStatus !== 'VALID') {
      missingRequirements.push('VALIDATED_TIRAMIS_CONFIGURATION');
    }

    return {
      companyMembershipId: membership.id,

      company: {
        id: membership.company.id,
        name: membership.company.name,
        slug: membership.company.slug,
        companyType: membership.company.company_type,
        timezone: membership.company.operating_timezone,
        currency: membership.company.default_currency,
      },

      activeBranch: activeBranch
        ? {
            id: activeBranch.id,
            code: activeBranch.code,
            name: activeBranch.name,
            isHeadOffice: activeBranch.is_head_office,
          }
        : null,

      assignedBranches: validBranches.map((assignment) => ({
        id: assignment.branch.id,
        code: assignment.branch.code,
        name: assignment.branch.name,
        isHeadOffice: assignment.branch.is_head_office,
      })),

      activeDepartment: activeDepartment
        ? {
            id: activeDepartment.id,
            code: activeDepartment.code,
            name: activeDepartment.name,
            branchId: activeDepartment.branch_id,
          }
        : null,

      assignedDepartments: compatibleDepartments.map((assignment) => ({
        id: assignment.department.id,
        code: assignment.department.code,
        name: assignment.department.name,
        branchId: assignment.department.branch_id,
      })),

      defaultSalePoint: defaultSalePoint
        ? {
            id: defaultSalePoint.id,
            code: defaultSalePoint.salePointCode,
            name: defaultSalePoint.salePointName,
            branchId: defaultSalePoint.branchId as string,
          }
        : null,

      tiramis: {
        enabled: membership.company.tira_integration_enabled,
        environment,
        configured: Boolean(configuration),
        validated: configuration?.validationStatus === 'VALID',
        ready: missingRequirements.length === 0,
        companyCode: configuration?.companyCode ?? null,
        insurerCompanyCode: configuration?.insurerCompanyCode ?? null,
        clientCode: configuration?.clientCode ?? null,
        systemCode: configuration?.systemCode ?? null,
        systemName: configuration?.systemName ?? null,
        missingRequirements,
      },
    };
  }

  async requireTiramisReady(
    userId: string,
    companyId: string,
  ): Promise<OrganizationContext> {
    const context = await this.resolve(userId, companyId);

    if (!context.tiramis.ready) {
      throw new BadRequestException({
        code: 'ORGANIZATION_NOT_TIRAMIS_READY',
        message:
          'The current organizational context is not ready for TIRA submission.',
        details: {
          missingRequirements: context.tiramis.missingRequirements,
        },
      });
    }

    return context;
  }

  private resolveTiramisEnvironment(): 'test' | 'live' {
    const configured = this.configService.get<string>('TIRAMIS_TARGET_ENV');

    if (configured === 'live') {
      return 'live';
    }

    return 'test';
  }
}
