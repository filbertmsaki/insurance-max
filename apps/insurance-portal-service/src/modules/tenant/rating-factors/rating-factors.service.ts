import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { CreateRatingFactorDto } from './dto/create-rating-factor.dto';
import { FilterRatingFactorDto } from './dto/filter-rating-factor.dto';
import { UpdateRatingFactorDto } from './dto/update-rating-factor.dto';
import { RatingFactor } from './entities/rating-factor.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';

@Injectable()
export class RatingFactorsService {
  constructor(
    @InjectRepository(RatingFactor)
    private readonly factorRepository: Repository<RatingFactor>,

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

  async requireFactor(companyId: string, id: string): Promise<RatingFactor> {
    const factor = await this.factorRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!factor) throw new NotFoundException('Rating factor not found');
    return factor;
  }

  async findByCode(
    companyId: string,
    code: string,
  ): Promise<RatingFactor | null> {
    return this.factorRepository.findOne({
      where: { code, company_id: companyId },
    });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(
    companyId: string,
    dto: CreateRatingFactorDto,
    userId: string,
  ): Promise<RatingFactor> {
    const factor = this.factorRepository.create({
      company_id: companyId,
      code: dto.code.trim().toLowerCase(),
      name: dto.name.trim(),
      data_type: dto.data_type,
      unit: dto.unit ?? null,
      options: dto.options ?? null,
      default_value: dto.default_value ?? null,
      is_required: dto.is_required ?? false,
      is_active: dto.is_active ?? true,
      created_by: userId,
      updated_by: userId,
    });

    try {
      const saved = await this.factorRepository.save(factor);
      await this.pricingRuntimeCacheService.invalidateProductConfiguration(companyId);
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A rating factor with code "${dto.code.trim().toLowerCase()}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterRatingFactorDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      data_type,
      is_active,
      is_required,
    } = query;

    const allowedSortFields = [
      'code',
      'name',
      'data_type',
      'is_active',
      'is_required',
      'created_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.factorRepository
      .createQueryBuilder('factor')
      .where('factor.company_id = :companyId', { companyId })
      .orderBy(`factor.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(factor.code ILIKE :term OR factor.name ILIKE :term)', {
        term,
      });
    }

    if (data_type) qb.andWhere('factor.data_type = :data_type', { data_type });
    if (is_active !== undefined)
      qb.andWhere('factor.is_active = :is_active', { is_active });
    if (is_required !== undefined)
      qb.andWhere('factor.is_required = :is_required', { is_required });

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

  async findOne(companyId: string, id: string): Promise<RatingFactor> {
    const factor = await this.factorRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!factor) throw new NotFoundException('Rating factor not found');
    return factor;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateRatingFactorDto,
    userId: string,
  ): Promise<RatingFactor> {
    const factor = await this.requireFactor(companyId, id);

    if (dto.code !== undefined) factor.code = dto.code.trim().toLowerCase();
    if (dto.name !== undefined) factor.name = dto.name.trim();
    if (dto.data_type !== undefined) factor.data_type = dto.data_type;
    if (dto.unit !== undefined) factor.unit = dto.unit ?? null;
    if (dto.options !== undefined) factor.options = dto.options ?? null;
    if (dto.default_value !== undefined)
      factor.default_value = dto.default_value ?? null;
    if (dto.is_required !== undefined) factor.is_required = dto.is_required;
    if (dto.is_active !== undefined) factor.is_active = dto.is_active;
    factor.updated_by = userId;

    try {
      const saved = await this.factorRepository.save(factor);
      await this.pricingRuntimeCacheService.invalidateProductConfiguration(companyId);
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A rating factor with this code or name already exists',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const factor = await this.requireFactor(companyId, id);
    await this.factorRepository.softDelete(factor.id);
    await this.pricingRuntimeCacheService.invalidateProductConfiguration(companyId);
  }
}
