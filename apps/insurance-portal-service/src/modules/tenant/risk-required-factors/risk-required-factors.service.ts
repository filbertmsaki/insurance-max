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
import { CreateRiskRequiredFactorDto } from './dto/create-risk-required-factor.dto';
import { UpdateRiskRequiredFactorDto } from './dto/update-risk-required-factor.dto';
import { RiskRequiredFactor } from './entities/risk-required-factor.entity';

@Injectable()
export class RiskRequiredFactorsService {
  constructor(
    @InjectRepository(RiskRequiredFactor)
    private readonly requiredFactorRepository: Repository<RiskRequiredFactor>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(RatingFactor)
    private readonly factorRepository: Repository<RatingFactor>,
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
    const risk = await this.riskRepository.findOne({
      where: { id: dto.risk_id, company_id: companyId },
    });
    if (!risk)
      throw new BadRequestException(
        'Risk not found or does not belong to this company',
      );

    const factor = await this.factorRepository.findOne({
      where: { id: dto.factor_id, company_id: companyId },
    });
    if (!factor)
      throw new BadRequestException(
        'Rating factor not found or does not belong to this company',
      );

    const rf = this.requiredFactorRepository.create({
      company_id: companyId,
      risk_id: dto.risk_id,
      factor_id: dto.factor_id,
      is_required: dto.is_required ?? true,
      sort_order: dto.sort_order ?? 0,
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.requiredFactorRepository.save(rf);
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'This factor is already assigned to this risk',
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

    return this.requiredFactorRepository.save(rf);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const rf = await this.requiredFactorRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!rf) throw new NotFoundException('Risk required factor not found');
    await this.requiredFactorRepository.delete(rf.id);
  }
}
