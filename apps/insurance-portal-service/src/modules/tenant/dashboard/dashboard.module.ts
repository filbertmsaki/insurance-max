import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { CommissionTransaction } from '../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Policy } from '../policies/entities/policy.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quotation,
      Policy,
      Customer,
      Invoice,
      Receipt,
      CommissionTransaction,
      TiramisSubmissionTrackingEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardCacheService],
  exports: [DashboardService],
})
export class DashboardModule {}
