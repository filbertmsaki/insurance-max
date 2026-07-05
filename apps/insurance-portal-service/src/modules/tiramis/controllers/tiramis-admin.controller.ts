import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireTiramisPermissions } from '../auth/tiramis-permission.decorator';
import { TiramisCompanyScopeGuard } from '../auth/tiramis-company-scope.guard';
import { TiramisPermissionGuard } from '../auth/tiramis-permission.guard';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisMonitoringService } from '../services/tiramis-monitoring.service';

@ApiTags('TIRAMIS Admin Monitoring')
@Controller('tiramis/admin')
@UseGuards(AuthGuard('jwt'), TiramisPermissionGuard, TiramisCompanyScopeGuard)
export class TiramisAdminController {
  constructor(
    private readonly tiramisMonitoringService: TiramisMonitoringService,
  ) {}

  @ApiOperation({
    summary: 'List TIRAMIS submissions with filters and pagination',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('submissions')
  getSubmissions(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisMonitoringService.getSubmissions(query, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Get TIRAMIS dashboard statistics',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('statistics')
  getStatistics(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisMonitoringService.getStatistics(query, this.getScope(req));
  }

  @ApiOperation({
    summary: 'List failed TIRAMIS submissions',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('failed')
  getFailed(@Query('limit') limit?: string, @Req() req?: any) {
    return this.tiramisMonitoringService.getFailed(Number(limit || 50), this.getScope(req));
  }

  @ApiOperation({
    summary: 'List retryable TIRAMIS submissions',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('retryable')
  getRetryable(@Query('limit') limit?: string, @Req() req?: any) {
    return this.tiramisMonitoringService.getRetryable(Number(limit || 50), this.getScope(req));
  }

  @ApiOperation({
    summary: 'Retry all pending retryable TIRAMIS submissions',
  })
  @RequireTiramisPermissions(TiramisPermissions.RETRY)
  @Post('submissions/retry')
  retryAll() {
    return this.tiramisMonitoringService.retryAll();
  }

  @ApiOperation({
    summary: 'Sync final status for all pending local tracking records',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('submissions/sync')
  syncAll() {
    return this.tiramisMonitoringService.syncAll();
  }

  @ApiOperation({
    summary: 'Get one TIRAMIS submission tracking record',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('submissions/:id')
  getSubmission(@Param('id') id: string) {
    return this.tiramisMonitoringService.getSubmission(id);
  }

  @ApiOperation({
    summary: 'Retry one TIRAMIS submission',
  })
  @RequireTiramisPermissions(TiramisPermissions.RETRY)
  @Post('submissions/:id/retry')
  retryOne(@Param('id') id: string) {
    return this.tiramisMonitoringService.retryOne(id);
  }

  @ApiOperation({
    summary: 'Sync final TIRAMIS status for one submission',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('submissions/:id/sync')
  syncOne(@Param('id') id: string) {
    return this.tiramisMonitoringService.syncOne(id);
  }

  @ApiOperation({
    summary: 'Sync one TIRAMIS tracking record to its business record',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('submissions/:id/sync-business-record')
  syncBusinessRecord(@Param('id') id: string) {
    return this.tiramisMonitoringService.syncBusinessRecord(id);
  }

  private getScope(req: any) {
    const roles = [
      ...(Array.isArray(req?.user?.role_codes) ? req.user.role_codes : []),
      ...(Array.isArray(req?.user?.roleCodes) ? req.user.roleCodes : []),
      ...(Array.isArray(req?.user?.roles) ? req.user.roles : []),
    ].map((role) => String(role).toLowerCase());

    return {
      companyId:
        req?.user?.companyId ||
        req?.user?.active_company_id ||
        req?.user?.activeCompanyId ||
        null,
      canAccessAllCompanies:
        roles.includes('super_admin') || roles.includes('platform_admin'),
    };
  }
}
