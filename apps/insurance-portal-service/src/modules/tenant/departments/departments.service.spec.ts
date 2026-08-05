import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';

import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { Department } from './entities/department.entity';
import { DepartmentUser } from './entities/department-user.entity';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  const companyId = 'company-1';
  const departmentId = 'dept-1';
  const companyUserId = 'membership-1';

  let departmentRepository: { findOne: jest.Mock };
  let departmentUserRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let service: DepartmentsService;

  const buildTransactionManager = (overrides: {
    department?: Department | null;
    memberships?: CompanyUser[];
    departmentUserRepo?: Partial<Record<string, jest.Mock>>;
  }) => {
    const departmentRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.department ?? null),
    };
    const membershipRepo = {
      find: jest.fn().mockResolvedValue(overrides.memberships ?? []),
      findOne: jest
        .fn()
        .mockResolvedValue((overrides.memberships ?? [])[0] ?? null),
    };
    const departmentUserRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides.departmentUserRepo,
    };
    return {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Department) return departmentRepo;
        if (entity === CompanyUser) return membershipRepo;
        if (entity === DepartmentUser) return departmentUserRepo;
        throw new Error('Unexpected repository requested in transaction');
      }),
      departmentUserRepo,
    };
  };

  beforeEach(() => {
    departmentRepository = { findOne: jest.fn() };
    departmentUserRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (value) => value),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };
    dataSource = { transaction: jest.fn() };

    service = new DepartmentsService(
      departmentRepository as unknown as Repository<Department>,
      departmentUserRepository as unknown as Repository<DepartmentUser>,
      {} as Repository<Branch>,
      {} as Repository<BranchUser>,
      {} as Repository<CompanyUser>,
      dataSource as unknown as DataSource,
    );
  });

  describe('setActiveDepartment — only one active department per membership', () => {
    it('rejects activating a department that is not active or does not belong to this company', async () => {
      const manager = buildTransactionManager({
        memberships: [
          {
            id: companyUserId,
            company_id: companyId,
            status: 'active',
          } as CompanyUser,
        ],
        departmentUserRepo: {
          findOne: jest.fn().mockResolvedValue({
            company_user_id: companyUserId,
            department_id: departmentId,
            department: {
              company_id: 'other-company',
              status: 'active',
              branch_id: 'branch-A',
            },
          }),
        },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.setActiveDepartment(companyId, companyUserId, departmentId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('demotes any other active department assignment before activating this one', async () => {
      const manager = buildTransactionManager({
        memberships: [
          {
            id: companyUserId,
            company_id: companyId,
            status: 'active',
          } as CompanyUser,
        ],
        departmentUserRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: 'du-1',
            company_user_id: companyUserId,
            department_id: departmentId,
            department: {
              company_id: companyId,
              status: 'active',
              branch_id: null,
            },
          }),
          save: jest.fn().mockImplementation(async (value) => value),
        },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.setActiveDepartment(
        companyId,
        companyUserId,
        departmentId,
      );

      expect(result.is_active_department).toBe(true);
    });

    it('rejects when the membership does not exist', async () => {
      const manager = buildTransactionManager({ memberships: [] });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.setActiveDepartment(companyId, companyUserId, departmentId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reconcileActiveDepartmentForBranch — demotes stale branch-scoped active department', () => {
    it('demotes the active department when it no longer matches the new active branch', async () => {
      departmentUserRepository.findOne.mockResolvedValue({
        id: 'du-1',
        department: { branch_id: 'branch-A' },
      });
      const qb = departmentUserRepository.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);

      await service.reconcileActiveDepartmentForBranch(
        companyId,
        companyUserId,
        'branch-B',
      );

      expect(departmentUserRepository.update).toHaveBeenCalledWith('du-1', {
        is_active_department: false,
      });
    });

    it('leaves a company-wide active department (branch_id null) untouched', async () => {
      departmentUserRepository.findOne.mockResolvedValue({
        id: 'du-1',
        department: { branch_id: null },
      });

      await service.reconcileActiveDepartmentForBranch(
        companyId,
        companyUserId,
        'branch-B',
      );

      expect(departmentUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('assignUsers — cross-company membership rejection', () => {
    it('rejects when a requested user does not belong to this company', async () => {
      const manager = buildTransactionManager({
        department: {
          id: departmentId,
          company_id: companyId,
          status: 'active',
        } as Department,
        memberships: [],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.assignUsers(companyId, departmentId, {
          company_user_ids: ['membership-x'],
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
