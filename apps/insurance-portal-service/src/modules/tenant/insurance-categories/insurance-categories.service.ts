import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { ProductLifecycleStatus } from '@insurance-max/contracts';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { CreateInsuranceCategoryDto } from './dto/create-insurance-category.dto';
import { FilterInsuranceCategoryDto } from './dto/filter-insurance-category.dto';
import { UpdateInsuranceCategoryDto } from './dto/update-insurance-category.dto';
import { InsuranceCategory } from './entities/insurance-category.entity';

@Injectable()
export class InsuranceCategoriesService {
  constructor(
    @InjectRepository(InsuranceCategory)
    private readonly categoryRepository: Repository<InsuranceCategory>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,
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

  async requireCategory(
    companyId: string,
    id: string,
  ): Promise<InsuranceCategory> {
    const cat = await this.categoryRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!cat) throw new NotFoundException('Insurance category not found');
    return cat;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(
    companyId: string,
    dto: CreateInsuranceCategoryDto,
    userId: string,
  ): Promise<InsuranceCategory> {
    const category = this.categoryRepository.create({
      company_id: companyId,
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description ?? null,
      business_line: dto.business_line,
      is_active: dto.is_active ?? true,
      tiramis_category_code: dto.tiramis_category_code?.trim()
        ? dto.tiramis_category_code.trim().toUpperCase()
        : null,
      sort_order: dto.sort_order ?? 100,
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A category with code "${dto.code.trim().toUpperCase()}" or name "${dto.name.trim()}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterInsuranceCategoryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      is_active,
      business_line,
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

    const qb = this.categoryRepository
      .createQueryBuilder('cat')
      .where('cat.company_id = :companyId', { companyId })
      .orderBy(`cat.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(cat.code ILIKE :term OR cat.name ILIKE :term OR cat.description ILIKE :term)',
        { term },
      );
    }

    if (is_active !== undefined) {
      qb.andWhere('cat.is_active = :is_active', { is_active });
    }

    if (business_line) {
      qb.andWhere('cat.business_line = :business_line', { business_line });
    }

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

  async findOne(companyId: string, id: string): Promise<InsuranceCategory> {
    const cat = await this.categoryRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!cat) throw new NotFoundException('Insurance category not found');
    return cat;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateInsuranceCategoryDto,
    userId: string,
  ): Promise<InsuranceCategory> {
    const cat = await this.requireCategory(companyId, id);

    if (dto.code !== undefined) cat.code = dto.code.trim().toUpperCase();
    if (dto.name !== undefined) cat.name = dto.name.trim();
    if (dto.description !== undefined)
      cat.description = dto.description ?? null;
    if (dto.business_line !== undefined) cat.business_line = dto.business_line;
    if (dto.is_active !== undefined) cat.is_active = dto.is_active;
    if (dto.tiramis_category_code !== undefined) {
      cat.tiramis_category_code = dto.tiramis_category_code?.trim()
        ? dto.tiramis_category_code.trim().toUpperCase()
        : null;
    }
    if (dto.sort_order !== undefined) cat.sort_order = dto.sort_order;

    if (dto.is_active === false && cat.is_active) {
      const activeProducts = await this.productRepository.count({
        where: {
          company_id: companyId,
          category_id: cat.id,
          lifecycle_status: ProductLifecycleStatus.ACTIVE,
        },
      });
      if (activeProducts > 0) {
        throw new ConflictException(
          'Retire all active products before deactivating this category',
        );
      }
    }

    cat.updated_by = userId;

    try {
      return await this.categoryRepository.save(cat);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A category with this code or name already exists in this company`,
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const cat = await this.requireCategory(companyId, id);

    const hasProductHistory = await this.productRepository.exists({
      where: { category_id: cat.id },
      withDeleted: true,
    });
    if (hasProductHistory) {
      throw new ConflictException(
        'A category with product history cannot be deleted',
      );
    }

    await this.categoryRepository.softDelete(cat.id);
  }
}
