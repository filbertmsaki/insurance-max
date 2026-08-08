import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import {
  ProductLifecycleStatus,
  ProductReviewStatus,
  ProductVersionStatus,
} from '@insurance-max/contracts';
import { InsuranceBusinessLine } from '../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { CreateInsuranceProductDto } from './dto/create-insurance-product.dto';
import { FilterInsuranceProductDto } from './dto/filter-insurance-product.dto';
import { UpdateInsuranceProductDto } from './dto/update-insurance-product.dto';
import { InsuranceProduct } from './entities/insurance-product.entity';
import { InsuranceProductVersion } from './entities/insurance-product-version.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';

@Injectable()
export class InsuranceProductsService {
  constructor(
    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(InsuranceCategory)
    private readonly categoryRepository: Repository<InsuranceCategory>,

    private readonly dataSource: DataSource,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
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

  /**
   * Creates the stable product identity and its version-1 draft in one
   * transaction. Product terms (wording, coverages, add-ons, documents,
   * subclasses) are configured on the draft via ProductDefinitionService
   * and only take effect once published.
   */
  async create(
    companyId: string,
    dto: CreateInsuranceProductDto,
    userId: string,
  ): Promise<InsuranceProduct & { draft_version: InsuranceProductVersion }> {
    return this.dataSource.transaction(async (manager) => {
      const category = await manager.getRepository(InsuranceCategory).findOne({
        where: { id: dto.category_id, company_id: companyId, is_active: true },
      });
      if (!category) {
        throw new BadRequestException(
          'Active category was not found in this company',
        );
      }

      if (
        category.business_line !== InsuranceBusinessLine.MOTOR &&
        dto.supports_fleet
      ) {
        throw new BadRequestException(
          'Only motor products can support fleet quotations',
        );
      }

      const productRepository = manager.getRepository(InsuranceProduct);
      const versionRepository = manager.getRepository(InsuranceProductVersion);

      const productCode = dto.product_code.trim().toUpperCase();
      const resolvedTiramisCode = dto.tiramis_product_code?.trim()
        ? dto.tiramis_product_code.trim().toUpperCase()
        : productCode;
      const supportsFleet =
        category.business_line === InsuranceBusinessLine.MOTOR
          ? (dto.supports_fleet ?? false)
          : false;

      let product: InsuranceProduct;
      try {
        product = await productRepository.save(
          productRepository.create({
            company_id: companyId,
            category_id: category.id,
            product_code: productCode,
            product_name: dto.product_name.trim(),
            description: dto.description ?? null,
            business_line: category.business_line,
            supports_fleet: supportsFleet,
            tiramis_product_code: resolvedTiramisCode,
            is_active: false,
            lifecycle_status: ProductLifecycleStatus.DRAFT,
            latest_version_number: 1,
            current_version_id: null,
            code_locked_at: null,
            created_by: userId,
            updated_by: userId,
          }),
        );
      } catch (error) {
        if (this.isDuplicateEntryError(error)) {
          throw new ConflictException(
            `A product with code "${productCode}" already exists`,
          );
        }
        throw error;
      }

      const draft = await versionRepository.save(
        versionRepository.create({
          company_id: companyId,
          product_id: product.id,
          version_number: 1,
          status: ProductVersionStatus.DRAFT,
          review_status: ProductReviewStatus.DRAFT,
          product_name: dto.product_name.trim(),
          description: dto.description ?? null,
          business_line: category.business_line,
          supports_fleet: supportsFleet,
          tiramis_product_code: resolvedTiramisCode,
          cover_note_type:
            dto.cover_note_type ??
            (category.business_line === InsuranceBusinessLine.MOTOR ? 3 : 1),
          default_cover_duration_days: dto.default_cover_duration_days ?? 365,
          currency_code: dto.currency_code ?? 'TZS',
          cover_note_description:
            dto.description?.trim() || dto.product_name.trim(),
          operative_clause: '',
          policy_operative_clause: '',
          special_conditions: '',
          exclusions: '',
          allows_cover_text_override: false,
          effective_from: null,
          effective_to: null,
          is_submission_ready: false,
          created_by: userId,
          updated_by: userId,
        }),
      );

      await this.pricingRuntimeCacheService.invalidateProductConfiguration(
        companyId,
      );

      return { ...product, draft_version: draft };
    });
  }

  async findAll(
    companyId: string,
    query: FilterInsuranceProductDto,
    accessibleProductIds?: string[],
    accessibleCategoryIds?: string[],
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      category_id,
      business_line,
      supports_fleet,
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
      .leftJoinAndSelect('product.current_version', 'current_version')
      .where('product.company_id = :companyId', { companyId })
      .orderBy(`product.${safeSortBy}`, direction);

    if (accessibleProductIds) {
      if (!accessibleProductIds.length) {
        return {
          data: [],
          meta: {
            totalItems: 0,
            itemCount: 0,
            itemsPerPage: limit,
            totalPages: 0,
            currentPage: page,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          },
        };
      }

      qb.andWhere('product.id IN (:...accessibleProductIds)', {
        accessibleProductIds,
      });
    }

    if (accessibleCategoryIds) {
      if (!accessibleCategoryIds.length) {
        return {
          data: [],
          meta: {
            totalItems: 0,
            itemCount: 0,
            itemsPerPage: limit,
            totalPages: 0,
            currentPage: page,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          },
        };
      }

      qb.andWhere('product.category_id IN (:...accessibleCategoryIds)', {
        accessibleCategoryIds,
      });
    }

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

    if (business_line) {
      qb.andWhere('product.business_line = :business_line', { business_line });
    }

    if (supports_fleet !== undefined) {
      qb.andWhere('product.supports_fleet = :supports_fleet', {
        supports_fleet,
      });
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
      relations: { category: true, current_version: true },
    });
    if (!product) throw new NotFoundException('Insurance product not found');
    return product;
  }

  /**
   * Identity-only update. Product terms are changed through product
   * versions (see ProductDefinitionService) and lifecycle endpoints.
   */
  async update(
    companyId: string,
    id: string,
    dto: UpdateInsuranceProductDto,
    userId: string,
  ): Promise<InsuranceProduct> {
    const product = await this.requireProduct(companyId, id);

    if (dto.product_code !== undefined && product.code_locked_at) {
      throw new ConflictException(
        'The product code is locked because the product has been published',
      );
    }

    if (dto.category_id !== undefined && product.current_version_id) {
      throw new ConflictException(
        'The product category cannot be changed after publication',
      );
    }

    if (dto.category_id !== undefined) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.category_id, company_id: companyId },
      });
      if (!category) {
        throw new BadRequestException(
          'Category not found or does not belong to this company',
        );
      }
      product.category_id = dto.category_id;
      product.business_line = category.business_line;
      if (category.business_line !== InsuranceBusinessLine.MOTOR) {
        product.supports_fleet = false;
      }
    }

    if (dto.product_code !== undefined) {
      product.product_code = dto.product_code.trim().toUpperCase();
    }

    product.updated_by = userId;

    try {
      const saved = await this.productRepository.save(product);
      await this.pricingRuntimeCacheService.invalidateProductConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException('A product with this code already exists');
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const product = await this.requireProduct(companyId, id);

    if (product.latest_version_number > 1 || product.current_version_id) {
      throw new ConflictException(
        'A product with version history cannot be deleted; retire it instead',
      );
    }

    await this.productRepository.softDelete(product.id);
    await this.pricingRuntimeCacheService.invalidateProductConfiguration(
      companyId,
    );
  }
}
