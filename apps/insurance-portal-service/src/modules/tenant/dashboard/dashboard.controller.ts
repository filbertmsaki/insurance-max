import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardPermissions } from './dashboard.permissions';

@ApiTags('Tenant Dashboard')
@ApiBearerAuth()
@Controller('tenant/dashboard')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('capabilities')
  @ApiOperation({
    summary: 'Get dashboard capabilities and allowed navigation',
  })
  getCapabilities(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getCapabilities(user);
  }

  @Get()
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
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
}
