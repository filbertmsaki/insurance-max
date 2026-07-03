import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Policy } from '../policies/entities/policy.entity';
import { ProductCommissionRule } from '../product-distribution/entities/product-commission-rule.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { User } from '../users/entities/user.entity';
import { CommissionPayment } from './entities/commission-payment.entity';
import { CommissionPaymentItem } from './entities/commission-payment-item.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Receipt } from './entities/receipt.entity';
import { BillingCommissionController } from './billing-commission.controller';
import { BillingCommissionService } from './billing-commission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Customer,
      Policy,
      ProductCommissionRule,
      Quotation,
      User,
      Invoice,
      InvoiceItem,
      Receipt,
      PaymentTransaction,
      CommissionTransaction,
      CommissionPayment,
      CommissionPaymentItem,
    ]),
  ],
  controllers: [BillingCommissionController],
  providers: [BillingCommissionService],
  exports: [BillingCommissionService],
})
export class BillingCommissionModule {}
