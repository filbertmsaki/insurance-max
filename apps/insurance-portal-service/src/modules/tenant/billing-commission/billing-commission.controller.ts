import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateCommissionPaymentDto } from './dto/create-commission-payment.dto';
import { CreateCommissionTransactionDto } from './dto/create-commission-transaction.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { FilterBillingDto } from './dto/filter-billing.dto';
import { UpdateCommissionPaymentDto } from './dto/update-commission-payment.dto';
import { UpdateCommissionTransactionDto } from './dto/update-commission-transaction.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { BillingCommissionService } from './billing-commission.service';

@ApiTags('billing', 'commissions')
@ApiBearerAuth()
@Controller('tenant/billing')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BillingCommissionController {
  constructor(private readonly billingCommissionService: BillingCommissionService) {}

  @Post('invoices')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:create')
  @ApiOperation({ summary: 'Create an invoice' })
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.billingCommissionService.createInvoice(user.companyId!, dto, user.id);
  }

  @Get('invoices')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @ApiOperation({ summary: 'List invoices' })
  findInvoices(@CurrentUser() user: AuthenticatedUser, @Query() query: FilterBillingDto) {
    return this.billingCommissionService.findInvoices(user.companyId!, query);
  }

  @Get('invoices/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @ApiOperation({ summary: 'Get an invoice by ID' })
  findInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.billingCommissionService.findInvoice(user.companyId!, id);
  }

  @Patch('invoices/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:update')
  @ApiOperation({ summary: 'Update an invoice' })
  updateInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.billingCommissionService.updateInvoice(user.companyId!, id, dto, user.id);
  }

  @Delete('invoices/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:delete')
  @ApiOperation({ summary: 'Delete an invoice' })
  async deleteInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.billingCommissionService.deleteInvoice(user.companyId!, id);
    return { message: 'Invoice deleted successfully' };
  }

  @Post('receipts')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:create')
  @ApiOperation({ summary: 'Create a receipt' })
  createReceipt(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReceiptDto) {
    return this.billingCommissionService.createReceipt(user.companyId!, dto, user.id);
  }

  @Get('receipts')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @ApiOperation({ summary: 'List receipts' })
  findReceipts(@CurrentUser() user: AuthenticatedUser, @Query() query: FilterBillingDto) {
    return this.billingCommissionService.findReceipts(user.companyId!, query);
  }

  @Get('receipts/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @ApiOperation({ summary: 'Get a receipt by ID' })
  findReceipt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.billingCommissionService.findReceipt(user.companyId!, id);
  }

  @Patch('receipts/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:update')
  @ApiOperation({ summary: 'Update a receipt' })
  updateReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.billingCommissionService.updateReceipt(user.companyId!, id, dto, user.id);
  }

  @Delete('receipts/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:delete')
  @ApiOperation({ summary: 'Delete a receipt' })
  async deleteReceipt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.billingCommissionService.deleteReceipt(user.companyId!, id);
    return { message: 'Receipt deleted successfully' };
  }

  @Post('payment-transactions')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:create')
  @ApiOperation({ summary: 'Create a payment transaction' })
  createPaymentTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentTransactionDto,
  ) {
    return this.billingCommissionService.createPaymentTransaction(user.companyId!, dto);
  }

  @Get('payment-transactions')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @ApiOperation({ summary: 'List payment transactions' })
  findPaymentTransactions(@CurrentUser() user: AuthenticatedUser, @Query() query: FilterBillingDto) {
    return this.billingCommissionService.findPaymentTransactions(user.companyId!, query);
  }

  @Get('payment-transactions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @ApiOperation({ summary: 'Get a payment transaction by ID' })
  findPaymentTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findPaymentTransaction(user.companyId!, id);
  }

  @Patch('payment-transactions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:update')
  @ApiOperation({ summary: 'Update a payment transaction' })
  updatePaymentTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentTransactionDto,
  ) {
    return this.billingCommissionService.updatePaymentTransaction(user.companyId!, id, dto);
  }

  @Delete('payment-transactions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('billing:delete')
  @ApiOperation({ summary: 'Delete a payment transaction' })
  async deletePaymentTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.billingCommissionService.deletePaymentTransaction(user.companyId!, id);
    return { message: 'Payment transaction deleted successfully' };
  }

  @Post('commission-transactions')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:create')
  @ApiOperation({ summary: 'Create a commission transaction' })
  createCommissionTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommissionTransactionDto,
  ) {
    return this.billingCommissionService.createCommissionTransaction(user.companyId!, dto);
  }

  @Get('commission-transactions')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:read')
  @ApiOperation({ summary: 'List commission transactions' })
  findCommissionTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterBillingDto,
  ) {
    return this.billingCommissionService.findCommissionTransactions(user.companyId!, query);
  }

  @Get('commission-transactions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:read')
  @ApiOperation({ summary: 'Get a commission transaction by ID' })
  findCommissionTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findCommissionTransaction(user.companyId!, id);
  }

  @Patch('commission-transactions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:update')
  @ApiOperation({ summary: 'Update a commission transaction' })
  updateCommissionTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionTransactionDto,
  ) {
    return this.billingCommissionService.updateCommissionTransaction(user.companyId!, id, dto);
  }

  @Delete('commission-transactions/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:delete')
  @ApiOperation({ summary: 'Delete a commission transaction' })
  async deleteCommissionTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.billingCommissionService.deleteCommissionTransaction(user.companyId!, id);
    return { message: 'Commission transaction deleted successfully' };
  }

  @Post('commission-payments')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:create')
  @ApiOperation({ summary: 'Create a commission payment' })
  createCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommissionPaymentDto,
  ) {
    return this.billingCommissionService.createCommissionPayment(user.companyId!, dto, user.id);
  }

  @Get('commission-payments')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:read')
  @ApiOperation({ summary: 'List commission payments' })
  findCommissionPayments(@CurrentUser() user: AuthenticatedUser, @Query() query: FilterBillingDto) {
    return this.billingCommissionService.findCommissionPayments(user.companyId!, query);
  }

  @Get('commission-payments/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:read')
  @ApiOperation({ summary: 'Get a commission payment by ID' })
  findCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingCommissionService.findCommissionPayment(user.companyId!, id);
  }

  @Patch('commission-payments/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:update')
  @ApiOperation({ summary: 'Update a commission payment' })
  updateCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionPaymentDto,
  ) {
    return this.billingCommissionService.updateCommissionPayment(user.companyId!, id, dto);
  }

  @Delete('commission-payments/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('commissions:delete')
  @ApiOperation({ summary: 'Delete a commission payment' })
  async deleteCommissionPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.billingCommissionService.deleteCommissionPayment(user.companyId!, id);
    return { message: 'Commission payment deleted successfully' };
  }
}
