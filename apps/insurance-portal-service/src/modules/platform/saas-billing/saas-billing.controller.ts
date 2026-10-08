import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { RolesGuard } from '@insurance-max/portal-shared/guards/roles.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { SaasBillingPermissions } from './saas-billing.permissions';
import {
  CreateSaasInvoiceAdjustmentDto,
  CreateSubscriptionDto,
  RecordSaasPaymentDto,
  ReverseSaasPaymentDto,
  ScheduleCancellationDto,
  SchedulePlanChangeDto,
  SuspendSubscriptionDto,
  VoidSaasInvoiceDto,
} from './dto/saas-billing.dto';
import { SaasCycleBillingService } from './services/saas-cycle-billing.service';
import { SubscriptionService } from './services/subscription.service';
import { UsageMeteringService } from './services/usage-metering.service';

@Controller('platform/saas')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles('OWNER')
export class SaasBillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly cycleService: SaasCycleBillingService,
  ) {}

  @Get('plans')
  @Permissions(SaasBillingPermissions.PLAN_READ)
  listPlans() {
    return this.subscriptionService.listPlans();
  }

  @Post('plans')
  @Permissions(SaasBillingPermissions.PLAN_CREATE)
  createPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.subscriptionService.createPlan(user, dto);
  }

  @Patch('plans/:id')
  @Permissions(SaasBillingPermissions.PLAN_UPDATE)
  updatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.subscriptionService.updatePlan(user, id, dto);
  }

  @Get('plans/:id/versions')
  @Permissions(SaasBillingPermissions.PLAN_READ)
  listPlanVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.listPlanVersions(id);
  }

  @Post('plans/:id/versions')
  @Permissions(SaasBillingPermissions.PLAN_UPDATE)
  createPlanVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subscriptionService.createPlanVersion(user, id);
  }

  @Post('plans/:id/versions/:versionId/approve')
  @Permissions(SaasBillingPermissions.PLAN_ACTIVATE)
  approvePlanVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.subscriptionService.approvePlanVersion(user, id, versionId);
  }

  @Post('plans/:id/versions/:versionId/publish')
  @Permissions(SaasBillingPermissions.PLAN_ACTIVATE)
  publishPlanVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.subscriptionService.publishPlanVersion(user, id, versionId);
  }

  @Post('plans/:id/activate')
  @Permissions(SaasBillingPermissions.PLAN_ACTIVATE)
  activatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subscriptionService.activatePlan(user, id);
  }

  @Get('subscriptions')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_READ)
  listSubscriptions() {
    return this.subscriptionService.listSubscriptions();
  }

  @Post('subscriptions')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_CREATE)
  createSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription(user, dto);
  }

  @Get('subscriptions/:id')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_READ)
  getSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.findSubscription(id);
  }

  @Post('subscriptions/:id/suspend')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_SUSPEND)
  suspendSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendSubscriptionDto,
  ) {
    return this.subscriptionService.suspendSubscription(user, id, dto.reason);
  }

  @Post('subscriptions/:id/cancel')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_CANCEL)
  cancelSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subscriptionService.cancelSubscription(user, id);
  }

  @Post('subscriptions/:id/schedule-plan-change')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_UPDATE)
  schedulePlanChange(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePlanChangeDto,
  ) {
    return this.subscriptionService.schedulePlanChange(user, id, dto);
  }

  @Post('subscriptions/:id/schedule-cancellation')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_CANCEL)
  scheduleCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCancellationDto,
  ) {
    return this.subscriptionService.scheduleCancellation(user, id, dto.reason);
  }

  @Post('operations/process-scheduled-changes')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_UPDATE)
  processScheduledChanges() {
    return this.subscriptionService.applyDueScheduledChanges();
  }

  @Get('usage')
  @Permissions(SaasBillingPermissions.USAGE_READ)
  listUsage() {
    return this.usageMeteringService.listEvents();
  }

  @Get('invoices')
  @Permissions(SaasBillingPermissions.INVOICE_READ)
  listInvoices() {
    return this.cycleService.listInvoices();
  }

  @Get('cycles')
  @Permissions(SaasBillingPermissions.INVOICE_READ)
  listCycles() {
    return this.cycleService.listCycles();
  }

  @Post('cycles/:id/issue-invoice')
  @Permissions(SaasBillingPermissions.INVOICE_ISSUE)
  issueInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cycleService.issueInvoice(user, id);
  }

  @Post('invoices/:id/payments')
  @Permissions(SaasBillingPermissions.PAYMENT_RECORD)
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: RecordSaasPaymentDto,
  ) {
    return this.cycleService.recordPayment(user, id, dto);
  }

  @Post('payments/:id/reverse')
  @Permissions(SaasBillingPermissions.PAYMENT_RECORD)
  reversePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseSaasPaymentDto,
  ) {
    return this.cycleService.reversePayment(user, id, dto.reason);
  }

  @Post('invoices/:id/void')
  @Permissions(SaasBillingPermissions.INVOICE_VOID)
  voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidSaasInvoiceDto,
  ) {
    return this.cycleService.voidInvoice(user, id, dto.reason);
  }

  @Get('invoices/:id/adjustments')
  @Permissions(SaasBillingPermissions.INVOICE_READ)
  listInvoiceAdjustments(@Param('id', ParseUUIDPipe) id: string) {
    return this.cycleService.listInvoiceAdjustments(id);
  }

  @Post('invoices/:id/adjustments')
  @Permissions(SaasBillingPermissions.INVOICE_ADJUST)
  createInvoiceAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: CreateSaasInvoiceAdjustmentDto,
  ) {
    return this.cycleService.createInvoiceAdjustment(user, id, dto);
  }

  @Post('invoice-adjustments/:id/approve')
  @Permissions(SaasBillingPermissions.INVOICE_ADJUST)
  approveInvoiceAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cycleService.approveInvoiceAdjustment(user, id);
  }

  @Post('operations/process-dunning')
  @Permissions(SaasBillingPermissions.INVOICE_ADJUST)
  processDunning() {
    return this.cycleService.processDunning();
  }

  @Post('operations/process-billing')
  @Permissions(SaasBillingPermissions.INVOICE_ISSUE)
  processBilling() {
    return this.cycleService.processDailyBilling();
  }
}
