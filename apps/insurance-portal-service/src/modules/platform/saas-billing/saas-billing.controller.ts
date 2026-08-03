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
    @Body() dto: { company_id: string; plan_id: string; started_at?: string },
  ) {
    return this.subscriptionService.createSubscription(user, dto);
  }

  @Post('subscriptions/:id/suspend')
  @Permissions(SaasBillingPermissions.SUBSCRIPTION_SUSPEND)
  suspendSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason?: string },
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
    dto: {
      amount: string | number;
      payment_reference: string;
      payment_date?: string;
      notes?: string;
    },
  ) {
    return this.cycleService.recordPayment(user, id, dto);
  }
}
