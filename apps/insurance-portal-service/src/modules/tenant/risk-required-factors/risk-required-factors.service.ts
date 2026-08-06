import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { PricingRateBook } from '../pricing-rate-books/entities/pricing-rate-book.entity';
import { PricingRateBookEditabilityService } from '../pricing-rate-books/pricing-rate-book-editability.service';
import { CreateRiskRequiredFactorDto } from './dto/create-risk-required-factor.dto';
import { UpdateRiskRequiredFactorDto } from './dto/update-risk-required-factor.dto';
import { RiskRequiredFactor } from './entities/risk-required-factor.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';

@Injectable()
export class RiskRequiredFactorsService {
  constructor(
    @InjectRepository(RiskRequiredFactor)
    private readonly requiredFactorRepository: Repository<RiskRequiredFactor>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(RatingFactor)
    private readonly factorRepository: Repository<RatingFactor>,

    @InjectRepository(PricingRateBook)
    private readonly rateBookRepository: Repository<PricingRateBook>,

    private readonly editabilityService: PricingRateBookEditabilityService,

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

  async assign(
    companyId: string,
    dto: CreateRiskRequiredFactorDto,
    userId: string,
  ): Promise<RiskRequiredFactor> {
    const rateBook = await this.rateBookRepository.findOne({
      where: { id: dto.rate_book_id, company_id: companyId },
    });
    if (!rateBook) {
      throw new NotFoundException('Pricing rate book not found');
    }
    this.editabilityService.assertEditable(rateBook);

    const risk = await this.riskRepository.findOne({
      where: { id: dto.risk_id, company_id: companyId },
    });
    if (!risk)
      throw new BadRequestException(
        'Risk not found or does not belong to this company',
      );
    if (risk.product_id !== rateBook.product_id) {
      throw new BadRequestException(
        'Risk does not belong to the rate-book product.',
      );
    }

    const factor = await this.factorRepository.findOne({
      where: { id: dto.factor_id, company_id: companyId, is_active: true },
    });
    if (!factor)
      throw new BadRequestException(
        'Rating factor not found or does not belong to this company',
      );

    const factorSnapshot = {
      factorId: factor.id,
      code: factor.code,
      name: factor.name,
      dataType: factor.data_type,
      unit: factor.unit,
      options: factor.options ?? [],
      defaultValue: factor.default_value,
      validationRules: factor.validation_rules,
    };

    const rf = this.requiredFactorRepository.create({
      company_id: companyId,
      risk_id: dto.risk_id,
      factor_id: dto.factor_id,
      rate_book_id: dto.rate_book_id,
      factor_snapshot: factorSnapshot,
      is_required: dto.is_required ?? true,
      sort_order: dto.sort_order ?? 0,
      created_by: userId,
      updated_by: userId,
    });

    try {
      const saved = await this.requiredFactorRepository.save(rf);
      await this.pricingRuntimeCacheService.invalidateProductConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'This factor is already assigned to this risk within this rate book',
        );
      }
      throw error;
    }
  }

  async findByRisk(
    companyId: string,
    riskId: string,
  ): Promise<RiskRequiredFactor[]> {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, company_id: companyId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    return this.requiredFactorRepository.find({
      where: { risk_id: riskId, company_id: companyId },
      relations: { factor: true },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateRiskRequiredFactorDto,
    userId: string,
  ): Promise<RiskRequiredFactor> {
    const rf = await this.requiredFactorRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!rf) throw new NotFoundException('Risk required factor not found');

    if (dto.is_required !== undefined) rf.is_required = dto.is_required;
    if (dto.sort_order !== undefined) rf.sort_order = dto.sort_order;
    rf.updated_by = userId;

    const saved = await this.requiredFactorRepository.save(rf);
    await this.pricingRuntimeCacheService.invalidateProductConfiguration(
      companyId,
    );
    return saved;
  }

  async remove(companyId: string, id: string): Promise<void> {
    const rf = await this.requiredFactorRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!rf) throw new NotFoundException('Risk required factor not found');
    await this.requiredFactorRepository.delete(rf.id);
    await this.pricingRuntimeCacheService.invalidateProductConfiguration(
      companyId,
    );
  }
}
