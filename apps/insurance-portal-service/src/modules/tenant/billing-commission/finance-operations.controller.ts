import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  AllocateReceiptDto,
  IssueInvoiceDto,
  PostReceiptDto,
  ReverseFinancialRecordDto,
  VoidInvoiceDto,
} from './dto/finance-operations.dto';
import { FinancePermissions } from './finance.permissions';
import { FinanceLifecycleService } from './finance-lifecycle.service';

@Controller('tenant/billing')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class FinanceOperationsController {
  constructor(
    private readonly financeLifecycleService: FinanceLifecycleService,
  ) {}

  @Post('invoices/:id/issue')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.INVOICE_ISSUE)
  issueInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.financeLifecycleService.issueInvoice(user, id, dto);
  }

  @Post('invoices/:id/void')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.INVOICE_VOID)
  voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.financeLifecycleService.voidInvoice(user, id, dto);
  }

  @Post('receipts/:id/post')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.RECEIPT_POST)
  postReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostReceiptDto,
  ) {
    return this.financeLifecycleService.postReceipt(user, id, dto);
  }

  @Post('receipts/:id/allocate')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.RECEIPT_ALLOCATE)
  allocateReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateReceiptDto,
  ) {
    return this.financeLifecycleService.allocateReceipt(user, id, dto);
  }

  @Post('allocations/:id/reverse')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.RECEIPT_REVERSE)
  reverseAllocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseFinancialRecordDto,
  ) {
    return this.financeLifecycleService.reverseAllocation(
      user,
      id,
      dto,
    );
  }

  @Post('receipts/:id/reverse')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.RECEIPT_REVERSE)
  reverseReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseFinancialRecordDto,
  ) {
    return this.financeLifecycleService.reverseReceipt(user, id, dto);
  }

  @Post('commission-payments/:id/pay')
  @UseGuards(PermissionsGuard)
  @Permissions(FinancePermissions.COMMISSION_PAY)
  payCommission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financeLifecycleService.markCommissionPaymentPaid(
      user,
      id,
    );
  }
}
