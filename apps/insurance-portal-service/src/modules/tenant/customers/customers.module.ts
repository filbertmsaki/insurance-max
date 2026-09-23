import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerContact } from './entities/customer-contact.entity';
import { CustomerDocument } from './entities/customer-document.entity';
import { CustomerIdentifier } from './entities/customer-identifier.entity';
import { CustomerKycReview } from './entities/customer-kyc-review.entity';
import { CustomerAuditLog } from './entities/customer-audit-log.entity';
import { CustomerVersion } from './entities/customer-version.entity';
import { Customer } from './entities/customer.entity';
import { InsuredAsset } from './entities/insured-asset.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { TiraPolicyholderMapperService } from './services/tira-policyholder-mapper.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerIdentifier,
      CustomerAddress,
      CustomerContact,
      CustomerDocument,
      CustomerKycReview,
      CustomerVersion,
      CustomerAuditLog,
      InsuredAsset,
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService, TiraPolicyholderMapperService],
  exports: [CustomersService, TiraPolicyholderMapperService],
})
export class CustomersModule {}
