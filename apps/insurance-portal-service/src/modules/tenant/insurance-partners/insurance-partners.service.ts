import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { normalizeRateForStorage } from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { InsuranceCompanyPartner } from './entities/insurance-company-partner.entity';
import { CreateInsurancePartnerDto } from './dto/create-insurance-partner.dto';
import { PartnerType } from './enums/partner-type.enum';
import { PartnerRelationshipStatus } from './enums/partner-relationship-status.enum';

@Injectable()
export class InsurancePartnersService {
  constructor(
    @InjectRepository(InsuranceCompanyPartner)
    private readonly partnerRepository: Repository<InsuranceCompanyPartner>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private mapPartnerTypeToCompanyType(partnerType: PartnerType): CompanyType {
    switch (partnerType) {
      case PartnerType.REINSURANCE_COMPANY:
        return CompanyType.REINSURANCE_COMPANY;
      case PartnerType.BROKER:
        return CompanyType.BROKER;
      case PartnerType.AGENCY:
        return CompanyType.AGENCY;
      case PartnerType.BANCASSURANCE:
        return CompanyType.BANCASSURANCE;
      case PartnerType.SERVICE_PROVIDER:
        return CompanyType.SERVICE_PROVIDER;
      default:
        throw new BadRequestException('Invalid partner type');
    }
  }

  async create(dto: CreateInsurancePartnerDto, actorUserId: string) {
    const insurerCompany = await this.companyRepository.findOne({
      where: { id: dto.insurer_company_id },
    });

    if (!insurerCompany) {
      throw new NotFoundException('Insurance company not found');
    }

    if (insurerCompany.company_type !== CompanyType.INSURANCE_COMPANY) {
      throw new BadRequestException(
        'insurer_company_id must belong to an INSURANCE_COMPANY',
      );
    }

    const intermediaryCompany = await this.companyRepository.findOne({
      where: { id: dto.intermediary_company_id },
    });

    if (!intermediaryCompany) {
      throw new NotFoundException('Partner company not found');
    }

    const expectedCompanyType = this.mapPartnerTypeToCompanyType(
      dto.partner_type,
    );

    if (intermediaryCompany.company_type !== expectedCompanyType) {
      throw new BadRequestException(
        `intermediary_company_id must belong to ${expectedCompanyType}`,
      );
    }

    if (dto.partner_type === PartnerType.AGENCY) {
      const existingAgencyRelationship = await this.partnerRepository.findOne({
        where: {
          intermediary_company_id: dto.intermediary_company_id,
          partner_type: PartnerType.AGENCY,
          status: In([
            PartnerRelationshipStatus.PENDING,
            PartnerRelationshipStatus.ACTIVE,
            PartnerRelationshipStatus.SUSPENDED,
          ]),
        },
      });

      if (existingAgencyRelationship) {
        throw new ConflictException(
          'This Agency is already linked to an Insurance Company',
        );
      }
    }

    const relationship = this.partnerRepository.create({
      insurer_company_id: dto.insurer_company_id,
      intermediary_company_id: dto.intermediary_company_id,
      partner_type: dto.partner_type,
      commission_rate:
        dto.commission_rate !== undefined
          ? normalizeRateForStorage(dto.commission_rate)
          : null,
      start_date: dto.start_date ? new Date(dto.start_date) : null,
      end_date: dto.end_date ? new Date(dto.end_date) : null,
      agreement_reference: dto.agreement_reference ?? null,
      agreement_document_url: dto.agreement_document_url ?? null,
      status: PartnerRelationshipStatus.PENDING,
      metadata: { created_by: actorUserId },
    });

    return this.partnerRepository.save(relationship);
  }

  async approve(id: string, actorUserId: string) {
    const relationship = await this.partnerRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    relationship.status = PartnerRelationshipStatus.ACTIVE;
    relationship.approved_by = actorUserId;
    relationship.approved_at = new Date();

    return this.partnerRepository.save(relationship);
  }

  async suspend(id: string, reason: string) {
    const relationship = await this.partnerRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    relationship.status = PartnerRelationshipStatus.SUSPENDED;
    relationship.suspension_reason = reason;

    return this.partnerRepository.save(relationship);
  }

  async terminate(id: string, reason: string) {
    const relationship = await this.partnerRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    relationship.status = PartnerRelationshipStatus.TERMINATED;
    relationship.termination_reason = reason;
    relationship.end_date = new Date();

    return this.partnerRepository.save(relationship);
  }
}
