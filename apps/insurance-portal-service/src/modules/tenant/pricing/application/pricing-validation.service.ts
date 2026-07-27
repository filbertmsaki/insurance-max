import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import type { PricingSingleRiskInput } from '../domain/pricing.types';

@Injectable()
export class PricingValidationService {
  constructor(
    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

  async requireActiveRisk(
    companyId: string,
    riskId: string,
  ): Promise<InsuranceRisk> {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, company_id: companyId, is_active: true },
      relations: { product: true },
    });

    if (!risk) {
      throw new NotFoundException(`Risk not found or inactive: ${riskId}`);
    }

    return risk;
  }

  assertMultiRiskRequest(risks: PricingSingleRiskInput[] | undefined): void {
    if (!risks || risks.length === 0) {
      throw new BadRequestException('At least one risk must be provided');
    }
  }
}
