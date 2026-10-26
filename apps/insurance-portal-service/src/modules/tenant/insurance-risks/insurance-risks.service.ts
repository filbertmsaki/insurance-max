import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { RiskRequiredFactor } from '../risk-required-factors/entities/risk-required-factor.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { PricingRateBookStatus } from '../pricing-rate-books/enums/pricing-rate-book-status.enum';
import { isMotorProductCode } from '../pricing/domain/motor-rating.config';
import { CreateInsuranceRiskDto } from './dto/create-insurance-risk.dto';
import { FilterInsuranceRiskDto } from './dto/filter-insurance-risk.dto';
import { UpdateInsuranceRiskDto } from './dto/update-insurance-risk.dto';
import { InsuranceRisk } from './entities/insurance-risk.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';

@Injectable()
export class InsuranceRisksService {
  constructor(
    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(InsuranceSubClass)
    private readonly subClassRepository: Repository<InsuranceSubClass>,

    @InjectRepository(RiskRequiredFactor)
    private readonly requiredFactorRepository: Repository<RiskRequiredFactor>,

    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

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

  async requireRisk(companyId: string, id: string): Promise<InsuranceRisk> {
    const risk = await this.riskRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!risk) throw new NotFoundException('Insurance risk not found');
    return risk;
  }

  async getRatingRequirements(companyId: string, riskId: string) {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, company_id: companyId, is_active: true },
      relations: { product: true },
    });
    if (!risk) throw new NotFoundException('Insurance risk not found');

    const requiredFactors = await this.requiredFactorRepository.find({
      where: {
        company_id: companyId,
        risk_id: riskId,
      },
      relations: { factor: true },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });

    return {
      risk_id: risk.id,
      risk_code: risk.risk_code,
      risk_name: risk.risk_name,
      product_id: risk.product_id,
      product_code: risk.product?.product_code ?? null,
      product_name: risk.product?.product_name ?? null,
      pricing_available: isMotorProductCode(risk.product?.product_code ?? null),
      required_factors: requiredFactors.filter(
        (item) => item.factor?.is_active,
      ),
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(
    companyId: string,
    dto: CreateInsuranceRiskDto,
    userId: string,
  ): Promise<InsuranceRisk> {
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, company_id: companyId },
    });
    if (!product) {
      throw new BadRequestException(
        'Product not found or does not belong to this company',
      );
    }

    if (dto.sub_class_id) {
      const sc = await this.subClassRepository.findOne({
        where: {
          id: dto.sub_class_id,
          company_id: companyId,
          product_id: dto.product_id,
        },
      });
      if (!sc) {
        throw new BadRequestException(
          'Sub-class not found or does not belong to this product',
        );
      }
    }

    const risk = this.riskRepository.create({
      company_id: companyId,
      product_id: dto.product_id,
      sub_class_id: dto.sub_class_id ?? null,
      risk_code: dto.risk_code.trim().toUpperCase(),
      risk_name: dto.risk_name.trim(),
      description: dto.description ?? null,
      cover_class: dto.cover_class ?? null,
      is_active: dto.is_active ?? true,
      created_by: userId,
      updated_by: userId,
    });

    try {
      const saved = await this.riskRepository.save(risk);
      await this.pricingRuntimeCacheService.invalidateProductConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A risk with code "${dto.risk_code.trim().toUpperCase()}" already exists in this company`,
        );
      }
      throw error;
    }
  }

  async findAll(
    companyId: string,
    query: FilterInsuranceRiskDto,
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
      product_id,
      sub_class_id,
      is_active,
    } = query;

    const allowedSortFields = [
      'risk_code',
      'risk_name',
      'is_active',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.riskRepository
      .createQueryBuilder('risk')
      .leftJoinAndSelect('risk.product', 'product')
      .leftJoinAndSelect('risk.sub_class', 'sub_class')
      .where('risk.company_id = :companyId', { companyId })
      .orderBy(`risk.${safeSortBy}`, direction)
      .addOrderBy('risk.id', direction);

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

      qb.andWhere('risk.product_id IN (:...accessibleProductIds)', {
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
        '(risk.risk_code ILIKE :term OR risk.risk_name ILIKE :term OR risk.description ILIKE :term)',
        { term },
      );
    }

    if (category_id)
      qb.andWhere('product.category_id = :category_id', { category_id });
    if (product_id)
      qb.andWhere('risk.product_id = :product_id', { product_id });
    if (sub_class_id)
      qb.andWhere('risk.sub_class_id = :sub_class_id', { sub_class_id });
    if (is_active !== undefined)
      qb.andWhere('risk.is_active = :is_active', { is_active });

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

  async findOne(companyId: string, id: string): Promise<InsuranceRisk> {
    const risk = await this.riskRepository.findOne({
      where: { id, company_id: companyId },
      relations: { product: true, sub_class: true },
    });
    if (!risk) throw new NotFoundException('Insurance risk not found');
    return risk;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateInsuranceRiskDto,
    userId: string,
  ): Promise<InsuranceRisk> {
    const risk = await this.requireRisk(companyId, id);

    if (dto.product_id !== undefined) {
      const product = await this.productRepository.findOne({
        where: { id: dto.product_id, company_id: companyId },
      });
      if (!product)
        throw new BadRequestException(
          'Product not found or does not belong to this company',
        );
      risk.product_id = dto.product_id;
    }

    if (dto.sub_class_id !== undefined) {
      if (dto.sub_class_id !== null) {
        const sc = await this.subClassRepository.findOne({
          where: { id: dto.sub_class_id, company_id: companyId },
        });
        if (!sc) throw new BadRequestException('Sub-class not found');
      }
      risk.sub_class_id = dto.sub_class_id ?? null;
    }

    if (dto.risk_code !== undefined)
      risk.risk_code = dto.risk_code.trim().toUpperCase();
    if (dto.risk_name !== undefined) risk.risk_name = dto.risk_name.trim();
    if (dto.description !== undefined)
      risk.description = dto.description ?? null;
    if (dto.is_active !== undefined) risk.is_active = dto.is_active;
    if (dto.cover_class !== undefined)
      risk.cover_class = dto.cover_class ?? null;
    risk.updated_by = userId;

    try {
      const saved = await this.riskRepository.save(risk);
      await this.pricingRuntimeCacheService.invalidateProductConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A risk with this code or name already exists',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const risk = await this.requireRisk(companyId, id);

    const activeUsage = await this.ruleRepository
      .createQueryBuilder('rule')
      .leftJoin(
        'pricing_rate_books',
        'rate_book',
        'rate_book.id = rule.rate_book_id',
      )
      .where('rule.company_id = :companyId', { companyId })
      .andWhere('rule.risk_id = :id', { id })
      .andWhere('rule.is_active = true')
      .andWhere('rule.deleted_at IS NULL')
      .andWhere(
        '(rule.rate_book_id IS NULL OR rate_book.status = :published)',
        { published: PricingRateBookStatus.PUBLISHED },
      )
      .getCount();

    if (activeUsage > 0) {
      throw new ConflictException(
        'This risk is used by an active rating rule in a published rate book and cannot be deleted.',
      );
    }

    await this.riskRepository.softDelete(risk.id);
    await this.pricingRuntimeCacheService.invalidateProductConfiguration(
      companyId,
    );
  }
}
