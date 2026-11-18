import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceAccountingModule } from '../accounting/finance-accounting.module';
import { CommissionAccrualService } from './commission-payables/commission-accrual.service';
import { CommissionPayment } from './commission-payables/entities/commission-payment.entity';
import { CommissionPaymentItem } from './commission-payables/entities/commission-payment-item.entity';
import { CommissionTransaction } from './commission-payables/entities/commission-transaction.entity';

/** Commission accrual (payable recognition). Outgoing-cash controls live in FinanceFoundationModule. */
@Module({
  imports: [
    FinanceAccountingModule,
    TypeOrmModule.forFeature([
      CommissionTransaction,
      CommissionPayment,
      CommissionPaymentItem,
    ]),
  ],
  providers: [CommissionAccrualService],
  exports: [CommissionAccrualService],
})
export class FinancePayablesModule {}
