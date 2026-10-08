import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { Branch } from '../branches/entities/branch.entity';
import { InsuranceCompanyPartnerProductScope } from './entities/insurance-company-partner-product-scope.entity';
import { InsuranceCompanyPartnerEvent } from './entities/insurance-company-partner-event.entity';
import { InsuranceCompanyPartnerAmendment } from './entities/insurance-company-partner-amendment.entity';
import { InsuranceCompanyPartner } from './entities/insurance-company-partner.entity';
import { InsurancePartnersController } from './insurance-partners.controller';
import { PartnerRelationshipRequestsController } from './partner-relationship-requests.controller';
import { InsurancePartnersService } from './insurance-partners.service';
import { PartnerRelationshipExpiryJob } from './jobs/partner-relationship-expiry.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceCompanyPartner,
      InsuranceCompanyPartnerProductScope,
      InsuranceCompanyPartnerEvent,
      InsuranceCompanyPartnerAmendment,
      Company,
      InsuranceProduct,
      Branch,
    ]),
  ],
  controllers: [
    InsurancePartnersController,
    PartnerRelationshipRequestsController,
  ],
  providers: [InsurancePartnersService, PartnerRelationshipExpiryJob],
  exports: [InsurancePartnersService],
})
export class InsurancePartnersModule {}
