import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { SharedModule } from '../../shared/shared.module';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { WorkItemsModule } from '../work-items/work-items.module';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyTransactionsModule } from '../policy-transactions/policy-transactions.module';
import { ProductCommissionRule } from '../product-distribution/entities/product-commission-rule.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { User } from '../users/entities/user.entity';
import { CommissionPayment } from './entities/commission-payment.entity';
import { CommissionPaymentItem } from './entities/commission-payment-item.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { FinanceAccount } from './entities/finance-account.entity';
import { FinanceJournalEntry } from './entities/finance-journal-entry.entity';
import { FinanceJournalLine } from './entities/finance-journal-line.entity';
import { FinanceOutboxEvent } from './entities/finance-outbox-event.entity';
import { FinanceProviderEvent } from './entities/finance-provider-event.entity';
import { FinanceReconciliationBatch } from './entities/finance-reconciliation-batch.entity';
import { FinanceReconciliationItem } from './entities/finance-reconciliation-item.entity';
import { FinanceRefund } from './entities/finance-refund.entity';
import { FinancialReversal } from './entities/financial-reversal.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentReference } from './entities/payment-reference.entity';
import { ReceiptAllocation } from './entities/receipt-allocation.entity';
import { Receipt } from './entities/receipt.entity';
import { BillingCommissionController } from './billing-commission.controller';
import { BillingCommissionService } from './billing-commission.service';
import { FinanceController } from './finance.controller';
import { FinanceWebhookController } from './finance-webhook.controller';
import { FinanceLifecycleService } from './finance-lifecycle.service';
import { FinanceOperationsController } from './finance-operations.controller';
import { FinanceOutboxProcessor } from './outbox/finance-outbox.processor';
import { FinanceCommandService } from './services/finance-command.service';
import { FinanceAutoReceiptService } from './services/finance-auto-receipt.service';
import { FinanceJournalService } from './services/finance-journal.service';
import { FinanceOutboxService } from './services/finance-outbox.service';
import { InvoiceBalanceService } from './services/invoice-balance.service';
import { CommissionAccrualService } from './services/commission-accrual.service';
import { PaymentPayloadRedactionService } from './services/payment-payload-redaction.service';
import { PaymentProviderRegistry } from './services/payment-provider.registry';
import { PaymentReferenceService } from './services/payment-reference.service';
import { PaymentTransactionProviderService } from './services/payment-transaction-provider.service';
import { PolicyTransactionPaymentProjectionService } from './services/policy-transaction-payment-projection.service';
import { ProviderWebhookService } from './services/provider-webhook.service';
import { QuotationInvoiceService } from './services/quotation-invoice.service';
import { QuotationPaymentEventService } from './services/quotation-payment-event.service';
import { QuotationPaymentProjectionService } from './services/quotation-payment-projection.service';
import { ReconciliationService } from './services/reconciliation.service';
import { ReceiptBalanceService } from './services/receipt-balance.service';
import { AuditModule } from '../../shared/audit/audit.module';

@Module({
  imports: [
    SharedModule,
    AuditModule,
    WorkItemsModule,
    forwardRef(() => QuotationsModule),
    forwardRef(() => PolicyTransactionsModule),
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
      ReceiptAllocation,
      FinanceRefund,
      FinanceProviderEvent,
      FinanceOutboxEvent,
      FinanceReconciliationBatch,
      FinanceReconciliationItem,
      FinanceAccount,
      FinanceJournalEntry,
      FinanceJournalLine,
      FinancialReversal,
      PaymentTransaction,
      PaymentReference,
      CommissionTransaction,
      CommissionPayment,
      CommissionPaymentItem,
    ]),
  ],
  controllers: [
    BillingCommissionController,
    FinanceOperationsController,
    FinanceController,
    FinanceWebhookController,
  ],
  providers: [
    BillingCommissionService,
    IdentifierGeneratorService,
    FinanceLifecycleService,
    FinanceCommandService,
    FinanceAutoReceiptService,
    CommissionAccrualService,
    FinanceOutboxService,
    FinanceOutboxProcessor,
    InvoiceBalanceService,
    ReceiptBalanceService,
    FinanceJournalService,
    PaymentPayloadRedactionService,
    PaymentProviderRegistry,
    PaymentReferenceService,
    PaymentTransactionProviderService,
    ProviderWebhookService,
    ReconciliationService,
    QuotationInvoiceService,
    QuotationPaymentEventService,
    QuotationPaymentProjectionService,
    PolicyTransactionPaymentProjectionService,
  ],
  exports: [
    BillingCommissionService,
    IdentifierGeneratorService,
    FinanceLifecycleService,
    FinanceCommandService,
    FinanceAutoReceiptService,
    CommissionAccrualService,
    FinanceOutboxService,
    InvoiceBalanceService,
    ReceiptBalanceService,
    FinanceJournalService,
    PaymentPayloadRedactionService,
    PaymentProviderRegistry,
    PaymentReferenceService,
    PaymentTransactionProviderService,
    ProviderWebhookService,
    ReconciliationService,
    QuotationInvoiceService,
    QuotationPaymentEventService,
    QuotationPaymentProjectionService,
    PolicyTransactionPaymentProjectionService,
  ],
})
export class BillingCommissionModule {}
