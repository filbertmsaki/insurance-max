import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireTiramisPermissions } from '../auth/tiramis-permission.decorator';
import { TiramisCompanyScopeGuard } from '../auth/tiramis-company-scope.guard';
import { TiramisPermissionGuard } from '../auth/tiramis-permission.guard';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisAuditService } from '../services/tiramis-audit.service';
import { TiramisMonitoringService } from '../services/tiramis-monitoring.service';
import { TiramisNotificationService } from '../services/tiramis-notification.service';

@ApiTags('TIRAMIS Admin Monitoring')
@Controller('tiramis/admin')
@UseGuards(AuthGuard('jwt'), TiramisPermissionGuard, TiramisCompanyScopeGuard)
export class TiramisAdminController {
  constructor(
    private readonly tiramisMonitoringService: TiramisMonitoringService,
    private readonly tiramisAuditService: TiramisAuditService,
    private readonly tiramisNotificationService: TiramisNotificationService,
  ) {}

  @ApiOperation({
    summary: 'List TIRAMIS submissions with filters and pagination',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('submissions')
  getSubmissions(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisMonitoringService.getSubmissions(
      query,
      this.getAuthContext(req),
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get TIRAMIS dashboard statistics',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('statistics')
  getStatistics(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisMonitoringService.getStatistics(
      query,
      this.getAuthContext(req),
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'List failed TIRAMIS submissions',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('failed')
  getFailed(@Query('limit') limit?: string, @Req() req?: any) {
    return this.tiramisMonitoringService.getFailed(
      Number(limit || 50),
      this.getAuthContext(req),
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'List retryable TIRAMIS submissions',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('retryable')
  getRetryable(@Query('limit') limit?: string, @Req() req?: any) {
    return this.tiramisMonitoringService.getRetryable(
      Number(limit || 50),
      this.getAuthContext(req),
      this.getScope(req),
    );
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
  getSubmission(@Param('id') id: string, @Req() req: any) {
    return this.tiramisMonitoringService.getSubmission(id, this.getAuthContext(req));
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

  @ApiOperation({
    summary: 'Get recent TIRAMIS audit logs',
  })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('audit-logs')
  getRecentAuditLogs(@Query('limit') limit?: string) {
    return this.tiramisAuditService.findRecent(Number(limit || 100));
  }

  @ApiOperation({
    summary: 'Get TIRAMIS audit logs by local tracking ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('submissions/:id/audit-logs')
  getAuditLogsByTrackingId(@Param('id') id: string) {
    return this.tiramisAuditService.findByTrackingId(id);
  }

  @ApiOperation({
    summary: 'Get TIRAMIS audit logs by business reference',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('audit-logs/business-reference/:businessReference')
  getAuditLogsByBusinessReference(
    @Param('businessReference') businessReference: string,
  ) {
    return this.tiramisAuditService.findByBusinessReference(businessReference);
  }

  @ApiOperation({
    summary: 'Get recent TIRAMIS notifications',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('notifications')
  getRecentNotifications(@Query('limit') limit?: string) {
    return this.tiramisNotificationService.findRecent(Number(limit || 50));
  }

  @ApiOperation({
    summary: 'Get unread TIRAMIS notifications',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('notifications/unread')
  getUnreadNotifications(@Query('limit') limit?: string) {
    return this.tiramisNotificationService.findUnread(Number(limit || 50));
  }

  @ApiOperation({
    summary: 'Get notifications by local tracking ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('submissions/:id/notifications')
  getNotificationsByTrackingId(@Param('id') id: string) {
    return this.tiramisNotificationService.findByTrackingId(id);
  }

  @ApiOperation({
    summary: 'Get notifications by business reference',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('notifications/business-reference/:businessReference')
  getNotificationsByBusinessReference(
    @Param('businessReference') businessReference: string,
  ) {
    return this.tiramisNotificationService.findByBusinessReference(
      businessReference,
    );
  }

  @ApiOperation({
    summary: 'Mark one TIRAMIS notification as read',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Post('notifications/:id/read')
  markNotificationRead(@Param('id') id: string, @Req() req: any) {
    return this.tiramisNotificationService.markRead(
      id,
      req.user?.id || req.user?.sub || null,
    );
  }

  @ApiOperation({
    summary: 'Mark all TIRAMIS notifications as read',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Post('notifications/read-all')
  markAllNotificationsRead(@Req() req: any) {
    return this.tiramisNotificationService.markAllRead(
      req.user?.id || req.user?.sub || null,
    );
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

  private getAuthContext(req: any) {
    return {
      userId: req?.user?.id || req?.user?.sub || null,
      companyId:
        req?.user?.companyId ||
        req?.user?.active_company_id ||
        req?.user?.activeCompanyId ||
        null,
      activeCompanyId:
        req?.user?.active_company_id ||
        req?.user?.activeCompanyId ||
        req?.user?.companyId ||
        null,
      ipAddress:
        req?.ip ||
        req?.headers?.['x-forwarded-for'] ||
        req?.connection?.remoteAddress ||
        null,
      userAgent: req?.headers?.['user-agent'] || null,
    };
  }
}
