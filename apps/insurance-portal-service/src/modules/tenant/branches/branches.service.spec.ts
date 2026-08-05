import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { User } from '../users/entities/user.entity';
import { BranchFeature } from './entities/branch-feature.entity';
import { BranchUser } from './entities/branch-user.entity';
import { Branch } from './entities/branch.entity';
import { CompanyFeature } from './entities/company-feature.entity';
import { BranchesService } from './branches.service';

describe('BranchesService', () => {
  const companyId = 'company-1';

  let branchRepository: jest.Mocked<Repository<Branch>>;
  let branchUserRepository: jest.Mocked<Repository<BranchUser>>;
  let auditService: jest.Mocked<AuditService>;
  let service: BranchesService;

  beforeEach(() => {
    branchRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Branch>>;

    branchUserRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    } as unknown as jest.Mocked<Repository<BranchUser>>;

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
      logCritical: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    service = new BranchesService(
      branchRepository,
      branchUserRepository,
      {} as Repository<CompanyFeature>,
      {} as Repository<BranchFeature>,
      {} as Repository<CompanyUser>,
      {} as Repository<User>,
      {} as DataSource,
      auditService,
    );
  });

  describe('createBranch — only one head office per company', () => {
    it('unsets any existing head office before saving the new one', async () => {
      await service.createBranch(companyId, {
        name: 'New HQ',
        code: 'hq2',
        is_head_office: true,
      } as any);

      expect(branchRepository.update).toHaveBeenCalledWith(
        { company_id: companyId, is_head_office: true },
        { is_head_office: false },
      );
      expect(branchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_head_office: true }),
      );
    });

    it('does not touch existing head office flags when creating a non-head-office branch', async () => {
      await service.createBranch(companyId, {
        name: 'Branch',
        code: 'br1',
        is_head_office: false,
      } as any);

      expect(branchRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateBranch — only one head office per company', () => {
    it('demotes the previous head office when promoting another branch', async () => {
      branchRepository.findOne.mockResolvedValue({
        id: 'branch-2',
        company_id: companyId,
        code: 'BR2',
        is_head_office: false,
      } as Branch);

      await service.updateBranch(companyId, 'branch-2', {
        is_head_office: true,
      } as any);

      expect(branchRepository.update).toHaveBeenCalledWith(
        { company_id: companyId, is_head_office: true },
        { is_head_office: false },
      );
    });
  });

  describe('setBranchStatus — deactivation requires replacement when active users exist', () => {
    it('rejects deactivation without a replacement_branch_id when active assignments exist', async () => {
      branchRepository.findOne.mockResolvedValue({
        id: 'branch-1',
        company_id: companyId,
        status: 'active',
      } as Branch);
      branchUserRepository.find.mockResolvedValue([
        { company_user_id: 'membership-1', is_active_branch: true } as BranchUser,
      ]);

      await expect(
        service.setBranchStatus(companyId, 'branch-1', {
          status: 'inactive',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects deactivation when the replacement branch is not active or not found', async () => {
      branchRepository.findOne
        .mockResolvedValueOnce({
          id: 'branch-1',
          company_id: companyId,
          status: 'active',
        } as Branch)
        .mockResolvedValueOnce(null);
      branchUserRepository.find.mockResolvedValue([
        { company_user_id: 'membership-1', is_active_branch: true } as BranchUser,
      ]);

      await expect(
        service.setBranchStatus(companyId, 'branch-1', {
          status: 'inactive',
          replacement_branch_id: 'branch-2',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows deactivation without a replacement branch when there are no active assignments', async () => {
      branchRepository.findOne.mockResolvedValue({
        id: 'branch-1',
        company_id: companyId,
        status: 'active',
      } as Branch);
      branchUserRepository.find.mockResolvedValue([]);

      const result = await service.setBranchStatus(companyId, 'branch-1', {
        status: 'inactive',
      } as any);

      expect(result.status).toBe('inactive');
    });
  });
});
