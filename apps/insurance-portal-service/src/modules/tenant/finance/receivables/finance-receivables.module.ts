import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../../../shared/shared.module';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyTransactionsModule } from '../../policy-transactions/policy-transactions.module';
import { ProductCommissionRule } from '../../product-distribution/entities/product-commission-rule.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { User } from '../../users/entities/user.entity';
import { FinanceAccountingModule } from '../accounting/finance-accounting.module';
import { FinanceJournalEntry } from '../accounting/journal-entries/entities/finance-journal-entry.entity';
import { FinancialReversal } from '../accounting/reversals/entities/financial-reversal.entity';
import { FinanceController } from '../finance.controller';
import { FinanceInsuranceIntegrationModule } from '../integrations/finance-insurance-integration.module';
import { FinancePayablesModule } from '../payables/finance-payables.module';
import { CommissionPayment } from '../payables/commission-payables/entities/commission-payment.entity';
import { CommissionPaymentItem } from '../payables/commission-payables/entities/commission-payment-item.entity';
import { CommissionTransaction } from '../payables/commission-payables/entities/commission-transaction.entity';
import { FinanceReconciliationModule } from '../reconciliation/finance-reconciliation.module';
import { BillingCommissionController } from './billing/billing-commission.controller';
import { BillingCommissionService } from './billing/billing-commission.service';
import { ManualInvoiceOptionsService } from './invoices/manual-invoice-options.service';
import { FinanceDashboardService } from './billing/finance-dashboard.service';
import { FinanceLifecycleService } from './billing/finance-lifecycle.service';
import { Invoice } from './invoices/entities/invoice.entity';
import { InvoiceItem } from './invoices/entities/invoice-item.entity';
import { InvoiceBalanceService } from './outstanding-balances/invoice-balance.service';
import { FinanceCommandService } from './payment-transactions/finance-command.service';
import { PaymentReference } from './payment-transactions/entities/payment-reference.entity';
import { PaymentTransaction } from './payment-transactions/entities/payment-transaction.entity';
import { PaymentReferenceService } from './payment-transactions/payment-reference.service';
import { ReceiptAllocation } from './receipt-allocations/entities/receipt-allocation.entity';
import { Receipt } from './receipts/entities/receipt.entity';
import { FinanceAutoReceiptService } from './receipts/finance-auto-receipt.service';
import { ReceiptBalanceService } from './receipts/receipt-balance.service';
import { FinanceRefund } from './refunds/entities/finance-refund.entity';

/**
 * Invoices, payment transactions, receipts and allocations, refunds and balances,
 * plus the /tenant/finance and /tenant/billing-commission APIs. FinanceCommandService
 * is the single write path: it takes the row locks, posts journals through
 * FinanceAccountingModule and projects payments onto quotations and policy
 * transactions inside one database transaction.
 */
@Module({
  imports: [
    SharedModule,
    FinanceAccountingModule,
    FinancePayablesModule,
    FinanceReconciliationModule,
    // Same file-load cycle as QuotationsModule <-> Finance (see integration module).
    forwardRef(() => FinanceInsuranceIntegrationModule),
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
      FinanceJournalEntry,
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
    // FinanceOperationsController (legacy /tenant/billing writes without
    // locks, journals or quotation projection) is intentionally not
    // registered. Use FinanceController (/tenant/finance) instead.
    FinanceController,
  ],
  providers: [
    BillingCommissionService,
    FinanceDashboardService,
    ManualInvoiceOptionsService,
    FinanceLifecycleService,
    FinanceCommandService,
    FinanceAutoReceiptService,
    InvoiceBalanceService,
    ReceiptBalanceService,
    PaymentReferenceService,
  ],
  exports: [
    BillingCommissionService,
    FinanceLifecycleService,
    FinanceCommandService,
    FinanceAutoReceiptService,
    InvoiceBalanceService,
    ReceiptBalanceService,
    PaymentReferenceService,
  ],
})
export class FinanceReceivablesModule {}
