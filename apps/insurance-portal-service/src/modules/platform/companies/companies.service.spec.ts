import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthorizationVersionService } from '../../shared/authorization/authorization-version.service';
import { User } from '../../tenant/users/entities/user.entity';
import { BranchUser } from '../../tenant/branches/entities/branch-user.entity';
import { Branch } from '../../tenant/branches/entities/branch.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { DepartmentUser } from '../../tenant/departments/entities/department-user.entity';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { Company } from './entities/company.entity';
import { CompanyUser } from './entities/company-user.entity';
import { CompanyUserRole } from './entities/company-user-role.entity';
import { CompanyUserPermission } from './entities/company-user-permission.entity';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  const companyId = 'company-1';
  const userId = 'user-1';

  let companyRepository: jest.Mocked<Partial<Repository<Company>>>;
  let companyUserRepository: jest.Mocked<Partial<Repository<CompanyUser>>>;
  let branchUserRepository: jest.Mocked<Partial<Repository<BranchUser>>>;
  let branchRepository: jest.Mocked<Partial<Repository<Branch>>>;
  let roleRepository: jest.Mocked<Partial<Repository<Role>>>;
  let userRepository: jest.Mocked<Partial<Repository<User>>>;
  let companyUserRoleRepository: jest.Mocked<Partial<Repository<CompanyUserRole>>>;
  let service: CompaniesService;

  beforeEach(() => {
    companyRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: companyId,
        status: 'active',
      }),
    };

    companyUserRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((value) => value) as any,
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'membership-1',
        ...value,
      })) as any,
      update: jest.fn().mockResolvedValue(undefined) as any,
    };

    branchUserRepository = {
      update: jest.fn().mockResolvedValue(undefined) as any,
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value) as any,
      save: jest.fn().mockImplementation(async (value) => value) as any,
    };

    branchRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'branch-1',
        company_id: companyId,
        status: 'active',
      }),
    };

    roleRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'role-viewer', name: 'VIEWER', company_id: null } as Role,
        ]),
    };

    userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: userId, user_type: 'COMPANY_USER' }),
    };

    companyUserRoleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value) as any,
      save: jest.fn().mockImplementation(async (value) => value) as any,
    };

    service = new CompaniesService(
      companyRepository as unknown as Repository<Company>,
      companyUserRepository as unknown as Repository<CompanyUser>,
      companyUserRoleRepository as unknown as Repository<CompanyUserRole>,
      {} as Repository<CompanyUserPermission>,
      userRepository as unknown as Repository<User>,
      roleRepository as unknown as Repository<Role>,
      {} as Repository<Permission>,
      branchUserRepository as unknown as Repository<BranchUser>,
      branchRepository as unknown as Repository<Branch>,
      {} as Repository<TiramisSalePointEntity>,
      {} as Repository<DepartmentUser>,
      {} as IdentifierGeneratorService,
      {} as any,
      { log: jest.fn(), logCritical: jest.fn() } as unknown as AuditService,
      {} as AuthorizationVersionService,
    );

    // getMembershipContext is exercised indirectly through other tests in this
    // suite; stub it out here so addUserToCompany assertions stay focused on
    // the default-membership invariant rather than the full context lookup.
    jest.spyOn(service, 'getMembershipContext').mockResolvedValue({
      membershipId: 'membership-1',
      companyId,
      companyName: 'Alliance',
      companySlug: 'alliance',
      companyType: 'INSURANCE_COMPANY' as any,
      isDefault: true,
      roles: [],
      permissions: [],
      status: 'active',
      authorizationVersion: 1,
    });
  });

  describe('addUserToCompany — only one default company membership per user', () => {
    const mockViewerRoleQueryBuilder = () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ id: 'role-viewer', name: 'VIEWER' }),
      };
      roleRepository.createQueryBuilder = jest.fn().mockReturnValue(qb) as any;
    };

    it('unsets is_default on the user’s other memberships when the new one is default', async () => {
      companyUserRepository.count = jest.fn().mockResolvedValue(0) as any;
      mockViewerRoleQueryBuilder();

      await service.addUserToCompany(userId, companyId, { isDefault: true });

      expect(companyUserRepository.update).toHaveBeenCalledWith(
        { user_id: userId },
        { is_default: false },
      );
    });

    it('defaults is_default to true only when the user has no other active memberships', async () => {
      companyUserRepository.count = jest.fn().mockResolvedValue(1) as any;
      mockViewerRoleQueryBuilder();

      await service.addUserToCompany(userId, companyId, {});

      // membership.is_default resolves to false because hasOtherMemberships is true,
      // so the "clear other defaults" branch must not run.
      expect(companyUserRepository.update).not.toHaveBeenCalledWith(
        { user_id: userId },
        { is_default: false },
      );
    });
  });

  describe('assignCompanyUserToBranch — only one active+primary branch per membership', () => {
    it('clears is_primary/is_active_branch on all other branch assignments before setting the new primary branch', async () => {
      companyUserRepository.findOne = jest.fn().mockResolvedValue({
        id: 'membership-1',
        company_id: companyId,
        user_id: userId,
        status: 'active',
      });

      await service.assignCompanyUserToBranch(
        companyId,
        'membership-1',
        'branch-1',
        true,
      );

      expect(branchUserRepository.update).toHaveBeenCalledWith(
        { company_user_id: 'membership-1' },
        { is_primary: false, is_active_branch: false },
      );
    });

    it('rejects assignment to a branch that does not belong to (or is inactive in) this company', async () => {
      branchRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.assignCompanyUserToBranch(
          companyId,
          'membership-1',
          'other-company-branch',
          true,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects assignment for a company user that is not an active member of this company', async () => {
      companyUserRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.assignCompanyUserToBranch(
          companyId,
          'membership-1',
          'branch-1',
          true,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
