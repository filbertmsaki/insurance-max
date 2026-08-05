import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { ProductVersionStatus } from '@insurance-max/contracts';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { ProductVersionSubClass } from '../insurance-products/entities/product-version-sub-class.entity';
import { CreateInsuranceSubClassDto } from './dto/create-insurance-sub-class.dto';
import { FilterInsuranceSubClassDto } from './dto/filter-insurance-sub-class.dto';
import { UpdateInsuranceSubClassDto } from './dto/update-insurance-sub-class.dto';
import { InsuranceSubClass } from './entities/insurance-sub-class.entity';

@Injectable()
export class InsuranceSubClassesService {
  constructor(
    @InjectRepository(InsuranceSubClass)
    private readonly subClassRepository: Repository<InsuranceSubClass>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(ProductVersionSubClass)
    private readonly productVersionSubClassRepository: Repository<ProductVersionSubClass>,
  ) {}

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    return (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  async requireSubClass(
    companyId: string,
    id: string,
  ): Promise<InsuranceSubClass> {
    const sc = await this.subClassRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!sc) throw new NotFoundException('Insurance sub-class not found');
    return sc;
  }

  async create(
    companyId: string,
    dto: CreateInsuranceSubClassDto,
    userId: string,
  ): Promise<InsuranceSubClass> {
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, company_id: companyId },
    });
    if (!product) {
      throw new BadRequestException(
        'Product not found or does not belong to this company',
      );
    }

    const sc = this.subClassRepository.create({
      company_id: companyId,
      product_id: dto.product_id,
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description ?? null,
      is_active: dto.is_active ?? true,
      tiramis_sub_class_code: dto.tiramis_sub_class_code?.trim()
        ? dto.tiramis_sub_class_code.trim().toUpperCase()
        : null,
      cover_type_code: dto.cover_type_code?.trim()
        ? dto.cover_type_code.trim().toUpperCase()
        : null,
      sort_order: dto.sort_order ?? 100,
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.subClassRepository.save(sc);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A sub-class with code "${dto.code.trim().toUpperCase()}" already exists in this product`,
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterInsuranceSubClassDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      product_id,
      is_active,
    } = query;

    const allowedSortFields = [
      'code',
      'name',
      'is_active',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.subClassRepository
      .createQueryBuilder('sc')
      .leftJoinAndSelect('sc.product', 'product')
      .where('sc.company_id = :companyId', { companyId })
      .orderBy(`sc.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(sc.code ILIKE :term OR sc.name ILIKE :term)', { term });
    }

    if (product_id) qb.andWhere('sc.product_id = :product_id', { product_id });
    if (is_active !== undefined)
      qb.andWhere('sc.is_active = :is_active', { is_active });

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(companyId: string, id: string): Promise<InsuranceSubClass> {
    const sc = await this.subClassRepository.findOne({
      where: { id, company_id: companyId },
      relations: { product: true },
    });
    if (!sc) throw new NotFoundException('Insurance sub-class not found');
    return sc;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateInsuranceSubClassDto,
    userId: string,
  ): Promise<InsuranceSubClass> {
    const sc = await this.requireSubClass(companyId, id);

    if (dto.product_id !== undefined) {
      const product = await this.productRepository.findOne({
        where: { id: dto.product_id, company_id: companyId },
      });
      if (!product)
        throw new BadRequestException(
          'Product not found or does not belong to this company',
        );
      sc.product_id = dto.product_id;
    }

    if (dto.code !== undefined) {
      const newCode = dto.code.trim().toUpperCase();
      if (newCode !== sc.code && (await this.hasPublishedUsage(sc.id))) {
        throw new ConflictException(
          'The code of a sub-class already used by a published product version cannot be changed',
        );
      }
      sc.code = newCode;
    }
    if (dto.name !== undefined) sc.name = dto.name.trim();
    if (dto.description !== undefined) sc.description = dto.description ?? null;
    if (dto.is_active !== undefined) sc.is_active = dto.is_active;
    if (dto.tiramis_sub_class_code !== undefined) {
      sc.tiramis_sub_class_code = dto.tiramis_sub_class_code?.trim()
        ? dto.tiramis_sub_class_code.trim().toUpperCase()
        : null;
    }
    if (dto.cover_type_code !== undefined) {
      sc.cover_type_code = dto.cover_type_code?.trim()
        ? dto.cover_type_code.trim().toUpperCase()
        : null;
    }
    if (dto.sort_order !== undefined) sc.sort_order = dto.sort_order;
    sc.updated_by = userId;

    try {
      return await this.subClassRepository.save(sc);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A sub-class with this code or name already exists',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const sc = await this.requireSubClass(companyId, id);

    if (await this.hasPublishedUsage(sc.id)) {
      throw new ConflictException(
        'A sub-class used by a published product version cannot be deleted',
      );
    }

    await this.subClassRepository.softDelete(sc.id);
  }

  private async hasPublishedUsage(subClassId: string): Promise<boolean> {
    const count = await this.productVersionSubClassRepository
      .createQueryBuilder('assignment')
      .innerJoin('assignment.product_version', 'version')
      .where('assignment.sub_class_id = :subClassId', { subClassId })
      .andWhere('version.status = :status', {
        status: ProductVersionStatus.PUBLISHED,
      })
      .getCount();

    return count > 0;
  }
}
