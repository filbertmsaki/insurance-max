import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';

@Injectable()
export class CompanyLicenseExpiryJob {
  private readonly logger = new Logger(CompanyLicenseExpiryJob.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  @Cron('0 0 2 * * *', { timeZone: 'Africa/Dar_es_Salaam' })
  async reportUpcomingExpiries(now = new Date()): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 30);
    const companies = await this.companyRepository
      .createQueryBuilder('company')
      .select([
        'company.id',
        'company.name',
        'company.company_type',
        'company.tira_license_number',
        'company.license_expires_at',
      ])
      .where('company.status = :status', { status: 'active' })
      .andWhere('company.deleted_at IS NULL')
      .andWhere('company.license_expires_at IS NOT NULL')
      .andWhere('company.license_expires_at <= :cutoff', {
        cutoff: cutoff.toISOString().slice(0, 10),
      })
      .orderBy('company.license_expires_at', 'ASC')
      .getMany();

    for (const company of companies) {
      const expiry = new Date(company.license_expires_at!);
      const daysRemaining = Math.ceil(
        (expiry.getTime() - now.getTime()) / 86_400_000,
      );
      const detail = {
        event: 'organization_license_expiry',
        company_id: company.id,
        company_name: company.name,
        company_type: company.company_type,
        license_number: company.tira_license_number,
        expires_at: expiry.toISOString().slice(0, 10),
        days_remaining: daysRemaining,
      };
      if (daysRemaining < 0) {
        this.logger.error(JSON.stringify(detail));
      } else {
        this.logger.warn(JSON.stringify(detail));
      }
    }
    return companies.length;
  }
}
