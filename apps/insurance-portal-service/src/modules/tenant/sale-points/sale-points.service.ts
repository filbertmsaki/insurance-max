import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { Branch } from '../branches/entities/branch.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { CreateSalePointDto } from './dto/create-sale-point.dto';
import { UpdateSalePointDto } from './dto/update-sale-point.dto';

@Injectable()
export class SalePointsService {
  constructor(
    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  private async requireActiveBranch(
    companyId: string,
    branchId: string,
  ): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, company_id: companyId, status: 'active' },
    });
    if (!branch) {
      throw new NotFoundException('Active branch was not found.');
    }
    return branch;
  }

  async findAll(companyId: string, branchId?: string) {
    if (branchId) {
      await this.requireActiveBranch(companyId, branchId);
    }

    return this.salePointRepository.find({
      where: branchId
        ? { companyId, branchId, deletedAt: IsNull() }
        : { companyId, deletedAt: IsNull() },
      order: {
        branchName: 'ASC',
        isDefault: 'DESC',
        isActive: 'DESC',
        salePointName: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findForBranch(companyId: string, branchId: string) {
    await this.requireActiveBranch(companyId, branchId);
    return this.salePointRepository.find({
      where: { companyId, branchId, deletedAt: IsNull() },
      order: { isDefault: 'DESC', isActive: 'DESC', salePointName: 'ASC' },
    });
  }

  async create(
    companyId: string,
    branchId: string,
    dto: CreateSalePointDto,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const branchRepository = manager.getRepository(Branch);
      const repository = manager.getRepository(TiramisSalePointEntity);

      const branch = await branchRepository.findOne({
        where: { id: branchId, company_id: companyId, status: 'active' },
      });
      if (!branch) {
        throw new NotFoundException('Active branch was not found.');
      }

      const code = dto.sale_point_code.trim().toUpperCase();

      const duplicate = await repository.findOne({
        where: { companyId, salePointCode: code },
        withDeleted: true,
      });
      if (duplicate && duplicate.deletedAt === null) {
        throw new ConflictException(
          'Sales-point code already exists in this company.',
        );
      }

      const existingActive = await repository.count({
        where: { companyId, branchId, isActive: true, deletedAt: IsNull() },
      });

      const makeDefault = dto.is_default === true || existingActive === 0;

      if (makeDefault) {
        await repository.update(
          { companyId, branchId, isDefault: true },
          { isDefault: false, updatedBy: actorId },
        );
      }

      const salePoint = repository.create({
        companyId,
        branchId,
        branchCode: branch.code,
        branchName: branch.name,
        salePointCode: code,
        salePointName: dto.sale_point_name.trim(),
        isDefault: makeDefault,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
        metadata: null,
      });

      const saved = await repository.save(salePoint);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          branchId,
          action: 'sale_point.created',
          eventCategory: 'organization',
          resource: 'sale_point',
          resourceId: saved.id,
          afterState: {
            branchId,
            salePointCode: saved.salePointCode,
            salePointName: saved.salePointName,
            isDefault: saved.isDefault,
          },
        },
        manager,
      );

      return saved;
    });
  }

  async update(
    companyId: string,
    branchId: string,
    id: string,
    dto: UpdateSalePointDto,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TiramisSalePointEntity);

      const salePoint = await repository.findOne({
        where: { id, companyId, branchId, deletedAt: IsNull() },
      });
      if (!salePoint) {
        throw new NotFoundException('Sales point was not found.');
      }

      const beforeState = {
        salePointCode: salePoint.salePointCode,
        salePointName: salePoint.salePointName,
        isDefault: salePoint.isDefault,
        isActive: salePoint.isActive,
      };

      if (dto.sale_point_code !== undefined) {
        const code = dto.sale_point_code.trim().toUpperCase();
        const duplicate = await repository
          .createQueryBuilder('salePoint')
          .where('salePoint.companyId = :companyId', { companyId })
          .andWhere('salePoint.salePointCode = :code', { code })
          .andWhere('salePoint.id != :id', { id })
          .andWhere('salePoint.deletedAt IS NULL')
          .getOne();

        if (duplicate) {
          throw new ConflictException('Sales-point code already exists.');
        }

        salePoint.salePointCode = code;
      }

      if (dto.sale_point_name !== undefined) {
        salePoint.salePointName = dto.sale_point_name.trim();
      }

      if (dto.is_default === true) {
        if (!salePoint.isActive) {
          throw new BadRequestException(
            'An inactive sales point cannot be made default.',
          );
        }

        await repository.update(
          { companyId, branchId, isDefault: true },
          { isDefault: false, updatedBy: actorId },
        );

        salePoint.isDefault = true;
      } else if (dto.is_default === false) {
        salePoint.isDefault = false;
      }

      salePoint.updatedBy = actorId;

      const saved = await repository.save(salePoint);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          branchId,
          action: 'sale_point.updated',
          eventCategory: 'organization',
          resource: 'sale_point',
          resourceId: saved.id,
          beforeState,
          afterState: {
            salePointCode: saved.salePointCode,
            salePointName: saved.salePointName,
            isDefault: saved.isDefault,
            isActive: saved.isActive,
          },
        },
        manager,
      );

      return saved;
    });
  }

  async setStatus(
    companyId: string,
    branchId: string,
    id: string,
    isActive: boolean,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TiramisSalePointEntity);

      const salePoint = await repository.findOne({
        where: { id, companyId, branchId, deletedAt: IsNull() },
      });
      if (!salePoint) {
        throw new NotFoundException('Sales point was not found.');
      }

      const beforeState = {
        isActive: salePoint.isActive,
        isDefault: salePoint.isDefault,
      };

      if (!isActive && salePoint.isDefault) {
        salePoint.isDefault = false;
      }
      salePoint.isActive = isActive;
      salePoint.updatedBy = actorId;

      const saved = await repository.save(salePoint);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          branchId,
          action: 'sale_point.status_changed',
          eventCategory: 'organization',
          resource: 'sale_point',
          resourceId: saved.id,
          beforeState,
          afterState: { isActive: saved.isActive, isDefault: saved.isDefault },
        },
        manager,
      );

      return saved;
    });
  }

  async setDefault(
    companyId: string,
    branchId: string,
    id: string,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TiramisSalePointEntity);

      const salePoint = await repository.findOne({
        where: { id, companyId, branchId, deletedAt: IsNull() },
      });
      if (!salePoint) {
        throw new NotFoundException('Sales point was not found.');
      }
      if (!salePoint.isActive) {
        throw new BadRequestException(
          'Only an active sales point can be made default.',
        );
      }

      await repository.update(
        { companyId, branchId, isDefault: true },
        { isDefault: false, updatedBy: actorId },
      );

      salePoint.isDefault = true;
      salePoint.updatedBy = actorId;
      const saved = await repository.save(salePoint);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          branchId,
          action: 'sale_point.default_changed',
          eventCategory: 'organization',
          resource: 'sale_point',
          resourceId: saved.id,
          afterState: { isDefault: true },
        },
        manager,
      );

      return saved;
    });
  }

  async remove(
    companyId: string,
    branchId: string,
    id: string,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TiramisSalePointEntity);

      const salePoint = await repository.findOne({
        where: { id, companyId, branchId, deletedAt: IsNull() },
      });
      if (!salePoint) {
        throw new NotFoundException('Sales point was not found.');
      }
      if (salePoint.isDefault) {
        throw new ConflictException(
          'Set another sales point as default before deleting this sales point.',
        );
      }

      salePoint.updatedBy = actorId;
      await repository.save(salePoint);
      await repository.softDelete(id);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          branchId,
          action: 'sale_point.deleted',
          eventCategory: 'organization',
          resource: 'sale_point',
          resourceId: id,
        },
        manager,
      );

      return { message: 'Sales point deleted successfully' };
    });
  }
}
