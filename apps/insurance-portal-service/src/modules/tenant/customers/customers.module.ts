import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerContact } from './entities/customer-contact.entity';
import { CustomerDocument } from './entities/customer-document.entity';
import { CustomerIdentifier } from './entities/customer-identifier.entity';
import { CustomerKycReview } from './entities/customer-kyc-review.entity';
import { Customer } from './entities/customer.entity';
import { InsuredAsset } from './entities/insured-asset.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerIdentifier,
      CustomerAddress,
      CustomerContact,
      CustomerDocument,
      CustomerKycReview,
      InsuredAsset,
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
