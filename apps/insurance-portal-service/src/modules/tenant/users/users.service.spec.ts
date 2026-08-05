import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';

import { CompaniesService } from '../../platform/companies/companies.service';
import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import { Department } from '../departments/entities/department.entity';
import { DepartmentUser } from '../departments/entities/department-user.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService.createForCompany — user creation transaction validation', () => {
  const companyId = 'company-1';

  let userRepository: { findOne: jest.Mock };
  let companiesService: jest.Mocked<Partial<CompaniesService>>;
  let dataSource: { transaction: jest.Mock };
  let service: UsersService;

  const baseDto = {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    phone: '+255700000000',
    password: 'Sup3rSecret!',
    branch_ids: ['branch-1'],
    active_branch_id: 'branch-1',
    department_ids: [] as string[],
    role_ids: [] as string[],
  };

  const buildTransactionManager = (
    branches: Branch[],
    departments: Department[] = [],
  ) => ({
    getRepository: jest.fn((entity: unknown) => {
      if (entity === User) {
        return {
          findOne: jest.fn().mockImplementation(async (options: any) => {
            if (options?.where?.id) {
              return { id: options.where.id, roles: [], permissions: [] };
            }
            return null;
          }),
          create: jest.fn().mockImplementation((value) => value),
          save: jest.fn().mockImplementation(async (value) => ({
            id: 'user-new',
            ...value,
          })),
          createQueryBuilder: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
          }),
        };
      }
      if (entity === Branch) {
        return { find: jest.fn().mockResolvedValue(branches) };
      }
      if (entity === Department) {
        return { find: jest.fn().mockResolvedValue(departments) };
      }
      if (entity === BranchUser) {
        return {};
      }
      if (entity === DepartmentUser) {
        return {
          create: jest.fn().mockImplementation((value) => value),
          save: jest.fn().mockImplementation(async (value) => value),
        };
      }
      throw new Error('Unexpected repository requested in transaction');
    }),
  });

  beforeEach(() => {
    userRepository = { findOne: jest.fn() };
    companiesService = {
      findCompanyUserContext: jest.fn().mockRejectedValue(new Error('none')),
      addUserToCompany: jest
        .fn()
        .mockResolvedValue({ membershipId: 'membership-1' }),
      assignCompanyUserToBranch: jest.fn().mockResolvedValue(undefined),
      getMembershipContext: jest.fn().mockResolvedValue({
        membershipId: 'membership-1',
        companyId,
        roles: [],
        permissions: [],
      }),
    };
    dataSource = { transaction: jest.fn() };

    service = new UsersService(
      userRepository as unknown as Repository<User>,
      companiesService as unknown as CompaniesService,
      dataSource as unknown as DataSource,
    );
  });

  it('rejects when active_branch_id is not included in branch_ids', async () => {
    await expect(
      service.createForCompany(companyId, {
        ...baseDto,
        branch_ids: ['branch-1', 'branch-2'],
        active_branch_id: 'branch-3',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when active_department_id is not included in department_ids', async () => {
    await expect(
      service.createForCompany(companyId, {
        ...baseDto,
        department_ids: ['dept-1'],
        active_department_id: 'dept-2',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when a branch_id does not belong to the current company (or is inactive)', async () => {
    dataSource.transaction.mockImplementation(async (cb) =>
      cb(buildTransactionManager([])),
    );

    await expect(
      service.createForCompany(companyId, {
        ...baseDto,
        branch_ids: ['cross-company-branch'],
        active_branch_id: 'cross-company-branch',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when a department_id does not belong to the current company (or is inactive)', async () => {
    dataSource.transaction.mockImplementation(async (cb) =>
      cb(
        buildTransactionManager(
          [
            {
              id: 'branch-1',
              company_id: companyId,
              status: 'active',
            } as Branch,
          ],
          [],
        ),
      ),
    );

    await expect(
      service.createForCompany(companyId, {
        ...baseDto,
        department_ids: ['cross-company-dept'],
        active_department_id: 'cross-company-dept',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates the user and assigns branches/departments when all ids are valid and consistent', async () => {
    dataSource.transaction.mockImplementation(async (cb) =>
      cb(
        buildTransactionManager(
          [
            {
              id: 'branch-1',
              company_id: companyId,
              status: 'active',
            } as Branch,
          ],
          [
            {
              id: 'dept-1',
              company_id: companyId,
              status: 'active',
            } as Department,
          ],
        ),
      ),
    );

    await service.createForCompany(companyId, {
      ...baseDto,
      department_ids: ['dept-1'],
      active_department_id: 'dept-1',
    } as any);

    expect(companiesService.assignCompanyUserToBranch).toHaveBeenCalledWith(
      companyId,
      'membership-1',
      'branch-1',
      true,
      expect.anything(),
    );
  });
});
