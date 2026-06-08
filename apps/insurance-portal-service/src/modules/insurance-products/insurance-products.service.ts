import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { CreateInsuranceProductDto } from './dto/create-insurance-product.dto';
import { FilterInsuranceProductDto } from './dto/filter-insurance-product.dto';
import { UpdateInsuranceProductDto } from './dto/update-insurance-product.dto';
import { InsuranceProduct } from './entities/insurance-product.entity';

@Injectable()
export class InsuranceProductsService {
  constructor(
    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(InsuranceCategory)
    private readonly categoryRepository: Repository<InsuranceCategory>,
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

  async requireProduct(
    companyId: string,
    id: string,
  ): Promise<InsuranceProduct> {
    const product = await this.productRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!product) throw new NotFoundException('Insurance product not found');
    return product;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(
    companyId: string,
    dto: CreateInsuranceProductDto,
    userId: string,
  ): Promise<InsuranceProduct> {
    const category = await this.categoryRepository.findOne({
      where: { id: dto.category_id, company_id: companyId, is_active: true },
    });
    if (!category) {
      throw new BadRequestException(
        'Category not found or does not belong to this company',
      );
    }

    const product = this.productRepository.create({
      company_id: companyId,
      category_id: dto.category_id,
      product_code: dto.product_code.trim().toUpperCase(),
      product_name: dto.product_name.trim(),
      description: dto.description ?? null,
      is_active: dto.is_active ?? true,
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.productRepository.save(product);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A product with code "${dto.product_code.trim().toUpperCase()}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterInsuranceProductDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      category_id,
      is_active,
    } = query;

    const allowedSortFields = [
      'product_code',
      'product_name',
      'is_active',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.company_id = :companyId', { companyId })
      .orderBy(`product.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(product.product_code ILIKE :term OR product.product_name ILIKE :term OR product.description ILIKE :term)',
        { term },
      );
    }

    if (category_id) {
      qb.andWhere('product.category_id = :category_id', { category_id });
    }

    if (is_active !== undefined) {
      qb.andWhere('product.is_active = :is_active', { is_active });
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

  async findOne(companyId: string, id: string): Promise<InsuranceProduct> {
    const product = await this.productRepository.findOne({
      where: { id, company_id: companyId },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException('Insurance product not found');
    return product;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateInsuranceProductDto,
    userId: string,
  ): Promise<InsuranceProduct> {
    const product = await this.requireProduct(companyId, id);

    if (dto.category_id !== undefined) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.category_id, company_id: companyId },
      });
      if (!category)
        throw new BadRequestException(
          'Category not found or does not belong to this company',
        );
      product.category_id = dto.category_id;
    }

    if (dto.product_code !== undefined)
      product.product_code = dto.product_code.trim().toUpperCase();
    if (dto.product_name !== undefined)
      product.product_name = dto.product_name.trim();
    if (dto.description !== undefined)
      product.description = dto.description ?? null;
    if (dto.is_active !== undefined) product.is_active = dto.is_active;
    product.updated_by = userId;

    try {
      return await this.productRepository.save(product);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A product with this code or name already exists',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const product = await this.requireProduct(companyId, id);
    await this.productRepository.softDelete(product.id);
  }
}
