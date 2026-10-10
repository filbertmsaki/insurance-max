import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type { OrganizationContext } from '@insurance-max/contracts';

import { Company } from '../../platform/companies/entities/company.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { BranchUser } from '../../tenant/branches/entities/branch-user.entity';
import { DepartmentUser } from '../../tenant/departments/entities/department-user.entity';
import { TiramisCompanyLinkStatus } from '../../tiramis/entities/tiramis-company-link.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { TiramisPlatformAccessService } from './tiramis-platform-access.service';

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

    private readonly platformAccess: TiramisPlatformAccessService,

    private readonly configService: ConfigService,
  ) {}

  /**
   * @param environment Pin the TIRAMIS environment (e.g. a submission's own
   * environment for a status sync or retry) instead of the platform's active
   * environment.
   * @param options.followUp A follow-up of an existing submission (status
   * sync, retry): company access and environment validation don't apply, so
   * results already in flight are never stranded by a revoke or a switch.
   */
  async resolve(
    userId: string,
    companyId: string,
    environment?: 'test' | 'live',
    options: { followUp?: boolean } = {},
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

    // Platform-level integration: the platform's active environment and the
    // company's link status; companies have no TIRAMIS settings of their own.
    const tiramisEnvironment =
      environment ?? (await this.platformAccess.getActiveEnvironment());
    const link = await this.platformAccess.getLink(companyId);
    const environmentValidated =
      await this.platformAccess.isEnvironmentValidated(tiramisEnvironment);

    const missingRequirements: string[] = [];

    if (!activeBranch) {
      missingRequirements.push('ACTIVE_BRANCH');
    }

    if (activeBranch && !defaultSalePoint) {
      missingRequirements.push('DEFAULT_SALE_POINT');
    }

    if (!options.followUp) {
      if (!link) {
        missingRequirements.push('TIRAMIS_ACCESS_NOT_LINKED');
      } else if (link.status === TiramisCompanyLinkStatus.REVOKED) {
        missingRequirements.push('TIRAMIS_ACCESS_REVOKED');
      } else if (link.status !== TiramisCompanyLinkStatus.ACTIVE) {
        missingRequirements.push('TIRAMIS_ACCESS_NOT_ACTIVE');
      }

      if (!environmentValidated) {
        missingRequirements.push('PLATFORM_ENVIRONMENT_NOT_VALIDATED');
      }
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
        enabled: link?.status === TiramisCompanyLinkStatus.ACTIVE,
        environment: tiramisEnvironment,
        configured: Boolean(link),
        validated: environmentValidated,
        ready: missingRequirements.length === 0,
        companyCode: link?.insurerCompanyCode ?? null,
        insurerCompanyCode: link?.insurerCompanyCode ?? null,
        missingRequirements,
      },
    };
  }

  async requireTiramisReady(
    userId: string,
    companyId: string,
    environment?: 'test' | 'live',
    options: { followUp?: boolean } = {},
  ): Promise<OrganizationContext> {
    const context = await this.resolve(userId, companyId, environment, options);

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

  /**
   * The TIRAMIS environment new submissions use. It is platform-wide: every
   * linked company uses the environment the platform owner activated.
   */
  async resolveCompanyTiramisEnvironment(
    _companyId?: string,
  ): Promise<'test' | 'live'> {
    return this.platformAccess.getActiveEnvironment();
  }
}
