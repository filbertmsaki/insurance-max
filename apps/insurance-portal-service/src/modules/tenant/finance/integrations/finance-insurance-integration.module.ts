import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyTransactionsModule } from '../../policy-transactions/policy-transactions.module';
import { QuotationsModule } from '../../quotations/quotations.module';
import { FinanceAccountingModule } from '../accounting/finance-accounting.module';
import { FinancePayablesModule } from '../payables/finance-payables.module';
import { Invoice } from '../receivables/invoices/entities/invoice.entity';
import { InvoiceItem } from '../receivables/invoices/entities/invoice-item.entity';
import { FinanceOutboxProcessor } from './finance-events/finance-outbox.processor';
import { PolicyTransactionPaymentProjectionService } from './policy-finance/policy-transaction-payment-projection.service';
import { QuotationInvoiceService } from './quotation-finance/quotation-invoice.service';
import { QuotationPaymentEventService } from './quotation-finance/quotation-payment-event.service';
import { QuotationPaymentProjectionService } from './quotation-finance/quotation-payment-projection.service';

/**
 * Contracts between Finance and the insurance lifecycle: quotation invoices,
 * payment projections onto quotations and policy transactions, and the outbox
 * processor that delivers quotation payment events. Insurance modules keep
 * ownership of their lifecycle; Finance calls their lifecycle services only.
 * QuotationsModule and PolicyTransactionsModule import Finance too, so these
 * two module-level cycles keep the forwardRef they already had.
 */
@Module({
  imports: [
    FinanceAccountingModule,
    FinancePayablesModule,
    forwardRef(() => QuotationsModule),
    forwardRef(() => PolicyTransactionsModule),
    TypeOrmModule.forFeature([Invoice, InvoiceItem]),
  ],
  providers: [
    QuotationInvoiceService,
    QuotationPaymentEventService,
    QuotationPaymentProjectionService,
    PolicyTransactionPaymentProjectionService,
    FinanceOutboxProcessor,
  ],
  exports: [
    QuotationInvoiceService,
    QuotationPaymentEventService,
    QuotationPaymentProjectionService,
    PolicyTransactionPaymentProjectionService,
  ],
})
export class FinanceInsuranceIntegrationModule {}
