import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../../shared/authorization/authorization.module';
import { CategoryAccessModule } from '../category-access/category-access.module';
import { CustomersModule } from '../customers/customers.module';
import { PoliciesModule } from '../policies/policies.module';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyTransactionsModule } from '../policy-transactions/policy-transactions.module';
import { PolicyRenewal } from '../policy-transactions/entities/policy-renewal.entity';
import { PolicyTransaction } from '../policy-transactions/entities/policy-transaction.entity';
import { ProductAccessModule } from '../product-access/product-access.module';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { UnderwriteDashboardService } from './common/underwrite-dashboard.service';
import { UnderwriteLineGuard } from './common/underwrite-line.guard';
import { UnderwriteQueryService } from './common/underwrite-query.service';
import { UnderwriteQuotationCommandService } from './common/underwrite-quotation-command.service';
import { UnderwriteTransactionsService } from './common/underwrite-transactions.service';
import {
  UnderwriteController,
  UnderwriteLineController,
} from './underwrite.controller';
import { UnderwriteQuotationsController } from './underwrite-quotations.controller';
import { UnderwriteTransactionsController } from './underwrite-transactions.controller';
import { FleetRegisterService } from './fleet/fleet-register.service';
import { FleetVehiclesService } from './fleet/fleet-vehicles.service';
import { UnderwriteFleetController } from './fleet/underwrite-fleet.controller';
import { ProductRiskField } from './non-motor/entities/product-risk-field.entity';
import { QuotationNonMotorDetail } from './non-motor/entities/quotation-non-motor-detail.entity';
import { NonMotorRiskService } from './non-motor/non-motor-risk.service';
import { UnderwriteNonMotorController } from './non-motor/underwrite-non-motor.controller';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';

/**
 * Underwrite: Motor | Fleet | Non-Motor presentation layer over the existing
 * quotation, policy and policy-transaction engines. It owns no business rules;
 * it pins the business line and enforces line-level permissions.
 */
@Module({
  imports: [
    QuotationsModule,
    PoliciesModule,
    CustomersModule,
    PolicyTransactionsModule,
    AuthorizationModule,
    CategoryAccessModule,
    ProductAccessModule,
    TypeOrmModule.forFeature([
      Quotation,
      Policy,
      PolicyTransaction,
      PolicyRenewal,
      InsuranceProduct,
      InsuranceSubClass,
      ProductRiskField,
      QuotationNonMotorDetail,
    ]),
  ],
  controllers: [
    UnderwriteController,
    UnderwriteLineController,
    UnderwriteQuotationsController,
    UnderwriteTransactionsController,
    UnderwriteFleetController,
    UnderwriteNonMotorController,
  ],
  providers: [
    UnderwriteQueryService,
    UnderwriteQuotationCommandService,
    UnderwriteTransactionsService,
    UnderwriteDashboardService,
    UnderwriteLineGuard,
    FleetRegisterService,
    FleetVehiclesService,
    NonMotorRiskService,
  ],
})
export class UnderwriteModule {}
