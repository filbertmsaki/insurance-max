import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { Branch } from '../branches/entities/branch.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { SalePointsService } from './sale-points.service';

describe('SalePointsService', () => {
  const companyId = 'company-1';
  const branchId = 'branch-1';

  let salePointRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let branchRepository: { findOne: jest.Mock };
  let auditService: jest.Mocked<AuditService>;
  let service: SalePointsService;

  const branch = {
    id: branchId,
    company_id: companyId,
    status: 'active',
    code: 'BR1',
    name: 'Branch One',
  } as Branch;

  const buildTransactionManager = () => ({
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Branch) return branchRepository;
      if (entity === TiramisSalePointEntity) return salePointRepository;
      throw new Error('Unexpected repository requested in transaction');
    }),
  });

  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    salePointRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      count: jest.fn().mockResolvedValue(0),
      softDelete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    branchRepository = {
      findOne: jest.fn().mockResolvedValue(branch),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
      logCritical: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (callback: (manager: unknown) => unknown) =>
          callback(buildTransactionManager()),
        ),
    };

    service = new SalePointsService(
      salePointRepository as unknown as Repository<TiramisSalePointEntity>,
      branchRepository as unknown as Repository<Branch>,
      dataSource as unknown as DataSource,
      auditService,
    );
  });

  describe('create — sale_point_code uniqueness per company', () => {
    it('rejects creation when an active sale point with the same code already exists', async () => {
      salePointRepository.findOne.mockResolvedValueOnce({
        companyId,
        salePointCode: 'SP1',
        deletedAt: null,
      });

      await expect(
        service.create(
          companyId,
          branchId,
          { sale_point_code: 'sp1', sale_point_name: 'Point 1' } as any,
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows creation when the duplicate code belongs to a soft-deleted sale point', async () => {
      salePointRepository.findOne
        .mockResolvedValueOnce({
          companyId,
          salePointCode: 'SP1',
          deletedAt: new Date(),
        })
        .mockResolvedValueOnce(null);
      salePointRepository.count.mockResolvedValue(1);

      const saved = await service.create(
        companyId,
        branchId,
        { sale_point_code: 'sp1', sale_point_name: 'Point 1' },
        'actor-1',
      );

      expect(saved).toBeDefined();
      expect(salePointRepository.save).toHaveBeenCalled();
    });

    it('makes the first sale point for a branch the default automatically', async () => {
      salePointRepository.findOne.mockResolvedValueOnce(null);
      salePointRepository.count.mockResolvedValue(0);

      const saved = await service.create(
        companyId,
        branchId,
        { sale_point_code: 'sp1', sale_point_name: 'Point 1' },
        'actor-1',
      );

      expect(saved.isDefault).toBe(true);
    });
  });

  describe('remove — default sales point cannot be deleted', () => {
    it('rejects deletion of the default sale point', async () => {
      salePointRepository.findOne.mockResolvedValue({
        id: 'sp-1',
        companyId,
        branchId,
        isDefault: true,
        deletedAt: null,
      });

      await expect(
        service.remove(companyId, branchId, 'sp-1', 'actor-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(salePointRepository.softDelete).not.toHaveBeenCalled();
    });

    it('allows deletion of a non-default sale point', async () => {
      salePointRepository.findOne.mockResolvedValue({
        id: 'sp-2',
        companyId,
        branchId,
        isDefault: false,
        deletedAt: null,
      });

      await service.remove(companyId, branchId, 'sp-2', 'actor-1');

      expect(salePointRepository.softDelete).toHaveBeenCalledWith('sp-2');
    });
  });

  describe('setStatus — default sales point cannot be deactivated while remaining default', () => {
    it('clears the default flag automatically when deactivating the default sale point', async () => {
      salePointRepository.findOne.mockResolvedValue({
        id: 'sp-1',
        companyId,
        branchId,
        isDefault: true,
        isActive: true,
        deletedAt: null,
      });

      const saved = await service.setStatus(
        companyId,
        branchId,
        'sp-1',
        false,
        'actor-1',
      );

      expect(saved.isActive).toBe(false);
      expect(saved.isDefault).toBe(false);
    });
  });

  describe('setDefault', () => {
    it('rejects making an inactive sale point the default', async () => {
      salePointRepository.findOne.mockResolvedValue({
        id: 'sp-1',
        companyId,
        branchId,
        isActive: false,
        deletedAt: null,
      });

      await expect(
        service.setDefault(companyId, branchId, 'sp-1', 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('requireActiveBranch guard', () => {
    it('rejects operations against a branch that is not active in this company', async () => {
      branchRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findForBranch(companyId, 'other-branch'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
