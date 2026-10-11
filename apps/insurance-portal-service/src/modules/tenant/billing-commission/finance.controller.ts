import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TenantScoped } from '@insurance-max/portal-shared';

import { FinancePermissions } from './finance.permissions';
import { BillingCommissionService } from './billing-commission.service';
import {
  ApproveCommissionAccrualDto,
  ApproveCommissionPaymentDto,
  ApproveRefundDto,
  ApproveReconciliationBatchDto,
  AllocateReceiptDto,
  CancelRefundDto,
  CreateCommissionPaymentCommandDto,
  CreateReconciliationBatchDto,
  ExcludeReconciliationItemDto,
  ImportReconciliationBatchDto,
  IssueInvoiceDto,
  MatchReconciliationItemDto,
  PayCommissionPaymentDto,
  PayRefundDto,
  PostReconciliationBatchDto,
  PostReceiptDto,
  RecordPaymentTransactionDto,
  RequestRefundDto,
  ReverseCommissionAccrualDto,
  ReverseCommissionPaymentDto,
  ReverseAllocationDto,
  ReverseReceiptDto,
  VoidInvoiceDto,
} from './dto/finance-operations.dto';
import { FilterBillingDto } from './dto/filter-billing.dto';
import { CreatePaymentReferenceDto } from './dto/payment-reference.dto';
import { FinanceCommandService } from './services/finance-command.service';
import { PaymentReferenceService } from './services/payment-reference.service';
import { ReconciliationService } from './services/reconciliation.service';

@Controller('tenant/finance')
@TenantScoped()
export class FinanceController {
  constructor(
    private readonly billingCommissionService: BillingCommissionService,
    private readonly financeCommandService: FinanceCommandService,
    private readonly reconciliationService: ReconciliationService,
    private readonly paymentReferenceService: PaymentReferenceService,
  ) {}

  @Get('invoices')
  @Permissions(FinancePermissions.INVOICES_READ)
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findInvoices(user.companyId!, query);
  }

  @Get('invoices/:id')
  @Permissions(FinancePermissions.INVOICES_READ)
  getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findInvoice(user.companyId!, id);
  }

  @Get('invoices/:id/payment-references')
  @Permissions(FinancePermissions.PAYMENTS_READ)
  listInvoicePaymentReferences(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentReferenceService.listForInvoice(user, id);
  }

  @Post('invoices/:id/payment-references')
  @Permissions(FinancePermissions.PAYMENTS_RECORD_MANUAL)
  createInvoicePaymentReference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentReferenceDto,
  ) {
    return this.paymentReferenceService.createOrReuse(user, id, dto);
  }

  @Post('invoices/:id/issue')
  @Permissions(FinancePermissions.INVOICES_ISSUE)
  issueInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.financeCommandService.issue(user, id, dto);
  }

  @Post('invoices/:id/void')
  @Permissions(FinancePermissions.INVOICES_VOID)
  voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.financeCommandService.voidInvoice(user, id, dto);
  }

  @Get('payment-transactions')
  @Permissions(FinancePermissions.PAYMENTS_READ)
  listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findPaymentTransactions(
      user.companyId!,
      query,
    );
  }

  @Get('payment-transactions/:id')
  @Permissions(FinancePermissions.PAYMENTS_READ)
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findPaymentTransaction(
      user.companyId!,
      id,
    );
  }

  @Post('payment-transactions/manual')
  @Permissions(FinancePermissions.PAYMENTS_RECORD_MANUAL)
  recordManualPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordPaymentTransactionDto,
  ) {
    return this.financeCommandService.recordManualPayment(user, dto);
  }

  @Get('receipts')
  @Permissions(FinancePermissions.RECEIPTS_READ)
  listReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findReceipts(user.companyId!, query);
  }

  @Get('receipts/:id')
  @Permissions(FinancePermissions.RECEIPTS_READ)
  getReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findReceipt(user.companyId!, id);
  }

  @Post('receipts/post')
  @Permissions(FinancePermissions.RECEIPTS_POST)
  postReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PostReceiptDto,
  ) {
    return this.financeCommandService.postReceipt(user, dto);
  }

  @Post('receipts/:id/allocate')
  @Permissions(FinancePermissions.RECEIPTS_ALLOCATE)
  allocateReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateReceiptDto,
  ) {
    return this.financeCommandService.allocate(user, id, dto);
  }

  @Post('receipts/:id/reverse')
  @Permissions(FinancePermissions.RECEIPTS_REVERSE)
  reverseReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseReceiptDto,
  ) {
    return this.financeCommandService.reverseReceipt(user, id, dto);
  }

  @Post('allocations/:id/reverse')
  @Permissions(FinancePermissions.RECEIPTS_REVERSE)
  reverseAllocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseAllocationDto,
  ) {
    return this.financeCommandService.reverseAllocation(user, id, dto);
  }

  @Post('refunds')
  @Permissions(FinancePermissions.REFUNDS_REQUEST)
  requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestRefundDto,
  ) {
    return this.financeCommandService.requestRefund(user, dto);
  }

  @Get('refunds')
  @Permissions(FinancePermissions.REFUNDS_READ)
  listRefunds(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findRefunds(user.companyId!, query);
  }

  @Get('refunds/:id')
  @Permissions(FinancePermissions.REFUNDS_READ)
  getRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findRefund(user.companyId!, id);
  }

  @Post('refunds/:id/approve')
  @Permissions(FinancePermissions.REFUNDS_APPROVE)
  approveRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRefundDto,
  ) {
    return this.financeCommandService.approveRefund(user, id, dto);
  }

  @Post('refunds/:id/pay')
  @Permissions(FinancePermissions.REFUNDS_PAY)
  payRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayRefundDto,
  ) {
    return this.financeCommandService.payRefund(user, id, dto);
  }

  @Post('refunds/:id/cancel')
  @Permissions(FinancePermissions.REFUNDS_CANCEL)
  cancelRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRefundDto,
  ) {
    return this.financeCommandService.cancelRefund(user, id, dto);
  }

  @Get('reconciliation-batches')
  @Permissions(FinancePermissions.RECONCILIATION_READ)
  listReconciliationBatches(@CurrentUser() user: AuthenticatedUser) {
    return this.reconciliationService.listBatches(user.companyId!);
  }

  @Post('reconciliation-batches')
  @Permissions(FinancePermissions.RECONCILIATION_CREATE)
  createReconciliationBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReconciliationBatchDto,
  ) {
    return this.reconciliationService.createBatch(user, dto);
  }

  @Get('reconciliation-batches/:id')
  @Permissions(FinancePermissions.RECONCILIATION_READ)
  getReconciliationBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reconciliationService.findBatch(user.companyId!, id);
  }

  @Post('reconciliation-batches/:id/import')
  @Permissions(FinancePermissions.RECONCILIATION_IMPORT)
  importReconciliationBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportReconciliationBatchDto,
  ) {
    return this.reconciliationService.importBatch(user, id, dto);
  }

  @Post('reconciliation-batches/:id/auto-match')
  @Permissions(FinancePermissions.RECONCILIATION_MATCH)
  autoMatchReconciliationBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reconciliationService.autoMatch(user, id);
  }

  @Post('reconciliation-batches/:id/approve')
  @Permissions(FinancePermissions.RECONCILIATION_APPROVE)
  approveReconciliationBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveReconciliationBatchDto,
  ) {
    return this.reconciliationService.approveBatch(user, id, dto);
  }

  @Post('reconciliation-batches/:id/post')
  @Permissions(FinancePermissions.RECONCILIATION_POST)
  postReconciliationBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostReconciliationBatchDto,
  ) {
    return this.reconciliationService.postBatch(user, id, dto);
  }

  @Post('reconciliation-items/:id/match')
  @Permissions(FinancePermissions.RECONCILIATION_MATCH)
  matchReconciliationItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MatchReconciliationItemDto,
  ) {
    return this.reconciliationService.matchItem(user, id, dto);
  }

  @Post('reconciliation-items/:id/exclude')
  @Permissions(FinancePermissions.RECONCILIATION_MATCH)
  excludeReconciliationItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExcludeReconciliationItemDto,
  ) {
    return this.reconciliationService.excludeItem(user, id, dto);
  }

  @Get('commission-accruals')
  @Permissions(FinancePermissions.COMMISSIONS_READ)
  listCommissionAccruals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findCommissionTransactions(
      user.companyId!,
      query,
    );
  }

  @Get('commission-accruals/:id')
  @Permissions(FinancePermissions.COMMISSIONS_READ)
  getCommissionAccrual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findCommissionTransaction(
      user.companyId!,
      id,
    );
  }

  @Post('commission-accruals/:id/approve')
  @Permissions(FinancePermissions.COMMISSIONS_APPROVE)
  approveCommissionAccrual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCommissionAccrualDto,
  ) {
    return this.financeCommandService.approveCommissionAccrual(user, id, dto);
  }

  @Post('commission-accruals/:id/reverse')
  @Permissions(FinancePermissions.COMMISSIONS_REVERSE)
  reverseCommissionAccrual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseCommissionAccrualDto,
  ) {
    return this.financeCommandService.reverseCommissionAccrual(user, id, dto);
  }

  @Get('commission-payments')
  @Permissions(FinancePermissions.COMMISSIONS_READ)
  listCommissionPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findCommissionPayments(
      user.companyId!,
      query,
    );
  }

  @Get('journals')
  @Permissions(FinancePermissions.FINANCE_JOURNALS_READ)
  listJournals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findFinanceJournals(
      user.companyId!,
      query,
    );
  }

  @Get('journals/:id')
  @Permissions(FinancePermissions.FINANCE_JOURNALS_READ)
  getJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findFinanceJournal(
      user.companyId!,
      id,
    );
  }

  @Post('commission-payments')
  @Permissions(FinancePermissions.COMMISSIONS_PAY)
  createCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommissionPaymentCommandDto,
  ) {
    return this.financeCommandService.createCommissionPayment(user, dto);
  }

  @Get('commission-payments/:id')
  @Permissions(FinancePermissions.COMMISSIONS_READ)
  getCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findCommissionPayment(
      user.companyId!,
      id,
    );
  }

  @Post('commission-payments/:id/approve')
  @Permissions(FinancePermissions.COMMISSIONS_APPROVE)
  approveCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCommissionPaymentDto,
  ) {
    return this.financeCommandService.approveCommissionPayment(user, id, dto);
  }

  @Post('commission-payments/:id/pay')
  @Permissions(FinancePermissions.COMMISSIONS_PAY)
  payCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayCommissionPaymentDto,
  ) {
    return this.financeCommandService.payCommissionPayment(user, id, dto);
  }

  @Post('commission-payments/:id/reverse')
  @Permissions(FinancePermissions.COMMISSIONS_REVERSE)
  reverseCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseCommissionPaymentDto,
  ) {
    return this.financeCommandService.reverseCommissionPayment(user, id, dto);
  }
}
