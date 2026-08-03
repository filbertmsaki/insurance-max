import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { DateTime } from 'luxon';
import { Repository } from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { CompanyRegulatoryProfile } from '../entities/company-regulatory-profile.entity';
import { RegulatoryObligationTemplate } from '../entities/regulatory-obligation-template.entity';
import { RegulatoryObligation } from '../entities/regulatory-obligation.entity';
import { RegulatoryReturnDefinition } from '../entities/regulatory-return-definition.entity';
import { RegulatoryReturn } from '../entities/regulatory-return.entity';
import {
  RegulatoryDueRuleType,
  RegulatoryFrequency,
  RegulatoryObligationStatus,
  RegulatoryReturnStatus,
} from '../enums/regulatory.enums';
import { RegulatoryDueDateService } from './regulatory-due-date.service';

@Injectable()
export class RegulatoryCalendarService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyRegulatoryProfile)
    private readonly profileRepository: Repository<CompanyRegulatoryProfile>,
    @InjectRepository(RegulatoryObligationTemplate)
    private readonly templateRepository: Repository<RegulatoryObligationTemplate>,
    @InjectRepository(RegulatoryObligation)
    private readonly obligationRepository: Repository<RegulatoryObligation>,
    @InjectRepository(RegulatoryReturnDefinition)
    private readonly returnDefinitionRepository: Repository<RegulatoryReturnDefinition>,
    @InjectRepository(RegulatoryReturn)
    private readonly returnRepository: Repository<RegulatoryReturn>,
    private readonly dueDateService: RegulatoryDueDateService,
    private readonly configService: ConfigService,
  ) {}

  async getProfile(companyId: string) {
    return this.ensureProfile(companyId);
  }

  async updateProfile(
    companyId: string,
    dto: Partial<CompanyRegulatoryProfile>,
    userId?: string | null,
  ) {
    const profile = await this.ensureProfile(companyId);
    Object.assign(profile, {
      financial_year_start_month:
        dto.financial_year_start_month ?? profile.financial_year_start_month,
      regulator_name: dto.regulator_name ?? profile.regulator_name,
      regulator_code: dto.regulator_code ?? profile.regulator_code,
      timezone: dto.timezone ?? profile.timezone,
      levy_frequency: dto.levy_frequency ?? profile.levy_frequency,
      levy_rate: dto.levy_rate ?? profile.levy_rate,
      metadata: dto.metadata ?? profile.metadata,
      updated_by: userId ?? profile.updated_by,
    });

    return this.profileRepository.save(profile);
  }

  async listCalendar(companyId: string) {
    return this.obligationRepository.find({
      where: { company_id: companyId },
      order: {
        due_at: 'ASC',
      },
      take: 500,
    });
  }

  async listReturns(companyId: string) {
    return this.returnRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      take: 500,
    });
  }

  async getReturn(companyId: string, returnId: string) {
    const record = await this.returnRepository.findOne({
      where: { id: returnId, company_id: companyId },
    });

    if (!record) {
      throw new NotFoundException('Regulatory return was not found');
    }

    return record;
  }

  async generateForCompany(companyId: string, year: number) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company was not found');
    }

    const profile = await this.ensureProfile(companyId);
    const templates = await this.ensureDefaultTemplates();
    const definition = await this.ensurePremiumLevyDefinition();
    const timezone =
      profile.timezone ??
      this.configService.get<string>('REGULATORY_DEFAULT_TIMEZONE') ??
      'Africa/Dar_es_Salaam';

    const generated: Array<RegulatoryObligation | RegulatoryReturn> = [];

    for (const template of templates) {
      if (
        template.applicable_company_types.length > 0 &&
        !template.applicable_company_types.includes(
          company.company_type ?? CompanyType.INSURANCE_COMPANY,
        )
      ) {
        continue;
      }

      const periods = this.buildPeriods(year, template.frequency, timezone);
      for (const period of periods) {
        const obligationCode = `${template.code}:${period.start.toFormat('yyyyLLdd')}`;

        let obligation = await this.obligationRepository.findOne({
          where: {
            company_id: companyId,
            code: obligationCode,
          },
        });

        if (!obligation) {
          obligation = await this.obligationRepository.save(
            this.obligationRepository.create({
              company_id: companyId,
              template_id: template.id,
              return_definition_id: definition.id,
              code: obligationCode,
              name: template.name,
              period_start: period.start.toISODate() ?? '',
              period_end: period.end.toISODate() ?? '',
              due_at: this.dueDateService.calculateDueDate(
                template,
                period.end,
                timezone,
              ),
              status: RegulatoryObligationStatus.UPCOMING,
            }),
          );
        }

        let regulatoryReturn = await this.returnRepository.findOne({
          where: {
            company_id: companyId,
            obligation_id: obligation.id,
          },
        });

        if (!regulatoryReturn) {
          regulatoryReturn = await this.returnRepository.save(
            this.returnRepository.create({
              company_id: companyId,
              definition_id: definition.id,
              obligation_id: obligation.id,
              return_no: `RET-${year}-${period.start.toFormat('LLdd')}-${companyId.slice(0, 6).toUpperCase()}`,
              status: RegulatoryReturnStatus.DRAFT,
              period_start: obligation.period_start,
              period_end: obligation.period_end,
              due_at: obligation.due_at,
              currency: definition.currency,
            }),
          );

          obligation.return_id = regulatoryReturn.id;
          await this.obligationRepository.save(obligation);
        }

        generated.push(obligation, regulatoryReturn);
      }
    }

    return {
      company_id: companyId,
      year,
      generated_count: generated.length,
    };
  }

  private async ensureProfile(companyId: string) {
    let profile = await this.profileRepository.findOne({
      where: { company_id: companyId },
    });

    if (!profile) {
      profile = await this.profileRepository.save(
        this.profileRepository.create({
          company_id: companyId,
          financial_year_start_month: 1,
          regulator_name: 'TIRA',
          timezone:
            this.configService.get<string>('REGULATORY_DEFAULT_TIMEZONE') ??
            'Africa/Dar_es_Salaam',
          levy_frequency: RegulatoryFrequency.MONTHLY,
          levy_rate: String(
            this.configService.get<string>('PREMIUM_LEVY_DEFAULT_RATE') ??
              '1.5',
          ),
        }),
      );
    }

    return profile;
  }

  private async ensureDefaultTemplates() {
    const definitions: Array<Partial<RegulatoryObligationTemplate>> = [
      {
        code: 'PREMIUM_LEVY_MONTHLY',
        name: 'Monthly premium levy return',
        obligation_type: 'PREMIUM_LEVY',
        applicable_company_types: [
          CompanyType.INSURANCE_COMPANY,
          CompanyType.REINSURANCE_COMPANY,
        ],
        frequency: RegulatoryFrequency.MONTHLY,
        due_rule_type: RegulatoryDueRuleType.PERIOD_END_OFFSET,
        offset_value: 30,
      },
      {
        code: 'REGULATORY_RETURN_QUARTERLY',
        name: 'Quarterly regulatory return',
        obligation_type: 'REGULATORY_RETURN',
        applicable_company_types: [
          CompanyType.INSURANCE_COMPANY,
          CompanyType.BROKER,
        ],
        frequency: RegulatoryFrequency.QUARTERLY,
        due_rule_type: RegulatoryDueRuleType.PERIOD_END_OFFSET,
        offset_value: 30,
      },
    ];

    const templates: RegulatoryObligationTemplate[] = [];
    for (const definition of definitions) {
      let template = await this.templateRepository.findOne({
        where: { code: definition.code },
      });

      if (!template) {
        template = this.templateRepository.create(definition);
      } else {
        Object.assign(template, definition);
      }

      templates.push(await this.templateRepository.save(template));
    }

    return templates;
  }

  private async ensurePremiumLevyDefinition() {
    let definition = await this.returnDefinitionRepository.findOne({
      where: { code: 'PREMIUM_LEVY' },
    });

    if (!definition) {
      definition = this.returnDefinitionRepository.create({
        code: 'PREMIUM_LEVY',
        name: 'Premium levy return',
        generator_key: 'premium-levy',
        applicable_company_types: [
          CompanyType.INSURANCE_COMPANY,
          CompanyType.REINSURANCE_COMPANY,
        ],
        frequency: RegulatoryFrequency.MONTHLY,
        currency: 'TZS',
        is_premium_levy: true,
      });
    }

    return this.returnDefinitionRepository.save(definition);
  }

  private buildPeriods(
    year: number,
    frequency: RegulatoryFrequency,
    timezone: string,
  ) {
    if (frequency === RegulatoryFrequency.QUARTERLY) {
      return [0, 1, 2, 3].map((index) => {
        const start = DateTime.fromObject(
          { year, month: index * 3 + 1, day: 1 },
          { zone: timezone },
        ).startOf('day');
        const end = start.plus({ month: 3 }).minus({ day: 1 }).endOf('day');
        return { start, end };
      });
    }

    return Array.from({ length: 12 }, (_, index) => {
      const start = DateTime.fromObject(
        { year, month: index + 1, day: 1 },
        { zone: timezone },
      ).startOf('day');
      const end = start.endOf('month');
      return { start, end };
    });
  }
}
