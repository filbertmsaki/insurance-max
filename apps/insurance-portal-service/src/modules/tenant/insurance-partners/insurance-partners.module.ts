import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { InsuranceCompanyPartner } from './entities/insurance-company-partner.entity';
import { InsurancePartnersController } from './insurance-partners.controller';
import { InsurancePartnersService } from './insurance-partners.service';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceCompanyPartner, Company])],
  controllers: [InsurancePartnersController],
  providers: [InsurancePartnersService],
  exports: [InsurancePartnersService],
})
export class InsurancePartnersModule {}
