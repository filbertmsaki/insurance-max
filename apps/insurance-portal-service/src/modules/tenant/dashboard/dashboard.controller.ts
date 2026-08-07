import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AnyPermissions } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardPermissions } from './dashboard.permissions';
import { ExecutiveDashboardService } from './executive-dashboard.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('Tenant Dashboard')
@ApiBearerAuth()
@Controller('tenant/dashboard')
@TenantScoped()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly executiveDashboardService: ExecutiveDashboardService,
  ) {}

  @Get('capabilities')
  @ApiOperation({
    summary: 'Get dashboard capabilities and allowed navigation',
  })
  getCapabilities(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getCapabilities(user);
  }

  @Get('executive')
  @AnyPermissions('dashboard:overview', 'dashboards:executive:read')
  @ApiOperation({
    summary: 'Get the executive metric dashboard built from the metric catalogue',
  })
  getExecutive(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.executiveDashboardService.getExecutive(user, query);
  }

  @Get()
  @Permissions(DashboardPermissions.OVERVIEW)
  @ApiOperation({
    summary: 'Get the tenant dashboard overview',
  })
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getOverview(user, query);
  }

  @Get('sales')
  @Permissions(DashboardPermissions.SALES)
  @ApiOperation({
    summary: 'Get quotation and sales dashboard information',
  })
  getSales(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getSales(user, query);
  }

  @Get('policies')
  @Permissions(DashboardPermissions.POLICIES)
  @ApiOperation({
    summary: 'Get policy dashboard information',
  })
  getPolicies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getPolicies(user, query);
  }

  @Get('finance')
  @Permissions(DashboardPermissions.FINANCE)
  @ApiOperation({
    summary: 'Get premium, invoice, receipt and commission summaries',
  })
  getFinance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getFinance(user, query);
  }

  @Get('tiramis')
  @Permissions(DashboardPermissions.TIRAMIS)
  @ApiOperation({
    summary: 'Get company-scoped TIRAMIS statistics',
  })
  getTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getTiramis(user, query);
  }

  @Get('tasks')
  @Permissions(DashboardPermissions.TASKS)
  @ApiOperation({
    summary: 'Get dashboard work queues and alerts',
  })
  getTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getTasks(user, query);
  }

  @Get('reinsurance')
  @Permissions(DashboardPermissions.REINSURANCE)
  @ApiOperation({
    summary: 'Get reinsurance dashboard information',
  })
  getReinsurance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getReinsurance(user, query);
  }
}
