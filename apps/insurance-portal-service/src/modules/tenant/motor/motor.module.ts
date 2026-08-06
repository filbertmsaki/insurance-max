import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InsuredAsset } from '../customers/entities/insured-asset.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationEntryRisk } from '../quotations/entities/structured/quotation-entry-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { User } from '../users/entities/user.entity';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { MotorController } from './motor.controller';
import { MotorFleet } from './entities/motor-fleet.entity';
import { MotorFleetItem } from './entities/motor-fleet-item.entity';
import { MotorFleetMembership } from './entities/motor-fleet-membership.entity';
import { MotorPolicyDetail } from './entities/motor-policy-detail.entity';
import { MotorVehicle } from './entities/motor-vehicle.entity';
import { MotorVehicleOwnership } from './entities/motor-vehicle-ownership.entity';
import { MotorService } from './motor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MotorVehicle,
      MotorFleet,
      MotorFleetItem,
      MotorFleetMembership,
      MotorPolicyDetail,
      MotorVehicleOwnership,
      Company,
      Customer,
      InsuredAsset,
      Quotation,
      QuotationEntryRisk,
      Policy,
      PolicyRisk,
      User,
    ]),
  ],
  controllers: [MotorController],
  providers: [MotorService, IdentifierGeneratorService],
  exports: [MotorService],
})
export class MotorModule {}
