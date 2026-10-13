import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Tax } from './entities/tax.entity';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';
import { FindTaxesQueryDto } from './dto/find-taxes-query.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(Tax) private readonly repository: Repository<Tax>,
  ) {}

  list(companyId: string, activeOnly = false) {
    return this.repository.find({
      where: {
        company_id: companyId,
        ...(activeOnly ? { is_active: true } : {}),
      },
      order: { is_default: 'DESC', tax_code: 'ASC' },
    });
  }

  /** Server-side table page; company scope applied before filters/paging. */
  findPage(companyId: string, query: FindTaxesQueryDto) {
    const qb = this.repository
      .createQueryBuilder('tax')
      .where('tax.company_id = :companyId', { companyId });
    if (query.is_active) {
      qb.andWhere('tax.is_active = :isActive', {
        isActive: query.is_active === 'true',
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        tax_code: 'tax.tax_code',
        tax_name: 'tax.tax_name',
        tax_rate: 'tax.tax_rate',
        is_default: 'tax.is_default',
        is_active: 'tax.is_active',
        created_at: 'tax.created_at',
      },
      defaultSort: 'tax_code',
      defaultOrder: 'ASC',
      searchable: ['tax.tax_code', 'tax.tax_name'],
      tieBreaker: 'tax.id',
    });
  }

  async getDefault(companyId: string): Promise<Tax | null> {
    return this.repository.findOne({
      where: { company_id: companyId, is_active: true, is_default: true },
      order: { tax_code: 'ASC' },
    });
  }

  async findOne(companyId: string, id: string) {
    const tax = await this.repository.findOne({
      where: { id, company_id: companyId },
    });
    if (!tax) throw new NotFoundException('Tax not found');
    return tax;
  }

  async create(companyId: string, dto: CreateTaxDto) {
    if (dto.is_default && !dto.is_active) {
      throw new ConflictException('The default tax must be active.');
    }

    return this.repository.manager.transaction(async (manager) => {
      if (dto.is_default) {
        await manager.getRepository(Tax).update(
          { company_id: companyId, is_default: true },
          {
            is_default: false,
          },
        );
      }

      return this.save(
        manager.getRepository(Tax).create({
          ...dto,
          company_id: companyId,
          tax_rate: dto.tax_rate.toFixed(10),
          is_default: dto.is_default ?? false,
        }),
        manager.getRepository(Tax),
      );
    });
  }

  async update(companyId: string, id: string, dto: UpdateTaxDto) {
    const tax = await this.findOne(companyId, id);
    if (dto.tax_code !== undefined && dto.tax_code !== tax.tax_code) {
      // Saved quotations refer to the code. Keep it stable while allowing name,
      // rate and availability to change for subsequent calculations.
      throw new ConflictException(
        'Tax code cannot be changed. Create a new tax instead.',
      );
    }
    if (dto.is_default && dto.is_active === false) {
      throw new ConflictException('The default tax must be active.');
    }
    if (dto.is_active === false && tax.is_default && dto.is_default !== false) {
      throw new ConflictException(
        'Set another default tax before deactivating this tax.',
      );
    }

    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Tax);
      if (dto.is_default === true) {
        await repository.update(
          { company_id: companyId, is_default: true },
          {
            is_default: false,
          },
        );
      }

      const current = await repository.findOne({
        where: { id, company_id: companyId },
      });
      if (!current) throw new NotFoundException('Tax not found');

      if (dto.tax_name !== undefined) current.tax_name = dto.tax_name;
      if (dto.tax_rate !== undefined)
        current.tax_rate = dto.tax_rate.toFixed(10);
      if (dto.is_active !== undefined) current.is_active = dto.is_active;
      if (dto.is_default !== undefined) current.is_default = dto.is_default;

      return this.save(current, repository);
    });
  }

  async remove(companyId: string, id: string) {
    const tax = await this.findOne(companyId, id);
    if (tax.is_default) {
      throw new ConflictException(
        'Set another default tax before deleting this tax.',
      );
    }
    await this.repository.softDelete({ id: tax.id, company_id: companyId });
  }

  private async save(tax: Tax, repository = this.repository) {
    try {
      return await repository.save(tax);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'This tax code already exists, including deleted taxes. Use a different code.',
        );
      }
      throw error;
    }
  }
}
