import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireTiramisPermissions } from '../auth/tiramis-permission.decorator';
import { TiramisCompanyScopeGuard } from '../auth/tiramis-company-scope.guard';
import { TiramisPermissionGuard } from '../auth/tiramis-permission.guard';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { FilterTiramisAuditLogDto } from '../dto/filter-tiramis-audit-log.dto';
import { FilterTiramisNotificationDto } from '../dto/filter-tiramis-notification.dto';
import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisAccessScopeService } from '../services/tiramis-access-scope.service';
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
    private readonly tiramisAccessScopeService: TiramisAccessScopeService,
  ) {}

  @ApiOperation({
    summary: 'Get TIRAMIS dashboard summary, charts, and recent lists',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('dashboard')
  getDashboard(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisMonitoringService.getDashboard(
      query,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get TIRAMIS integration health status',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('health')
  getHealth(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisMonitoringService.getHealth(query, this.getScope(req));
  }

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
    return this.tiramisMonitoringService.getSubmissionScoped(
      id,
      this.getAuthContext(req),
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get TIRAMIS tracking timeline from audit logs and notifications',
  })
  @RequireTiramisPermissions(TiramisPermissions.MONITORING_VIEW)
  @Get('submissions/:id/timeline')
  getSubmissionTimeline(@Param('id') id: string, @Req() req: any) {
    return this.tiramisMonitoringService.getTrackingTimeline(
      id,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Retry one TIRAMIS submission',
  })
  @RequireTiramisPermissions(TiramisPermissions.RETRY)
  @Post('submissions/:id/retry')
  retryOne(@Param('id') id: string, @Req() req: any) {
    return this.tiramisMonitoringService.retryOne(id, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Schedule one TIRAMIS submission for retry',
  })
  @RequireTiramisPermissions(TiramisPermissions.RETRY)
  @Post('submissions/:id/schedule-retry')
  scheduleRetry(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Req() req?: any,
  ) {
    return this.tiramisMonitoringService.scheduleRetry(
      id,
      reason,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Sync final TIRAMIS status for one submission',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('submissions/:id/sync')
  syncOne(@Param('id') id: string, @Req() req: any) {
    return this.tiramisMonitoringService.syncOne(id, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Sync one TIRAMIS tracking record to its business record',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('submissions/:id/sync-business-record')
  syncBusinessRecord(@Param('id') id: string, @Req() req: any) {
    return this.tiramisMonitoringService.syncBusinessRecord(
      id,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Search TIRAMIS audit logs with filters',
  })
  @RequireTiramisPermissions(TiramisPermissions.AUDIT_VIEW)
  @Get('audit-logs')
  getAuditLogs(@Query() query: FilterTiramisAuditLogDto, @Req() req: any) {
    return this.tiramisAuditService.search(query, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Get one TIRAMIS audit log by ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.AUDIT_VIEW)
  @Get('audit-logs/:id')
  getAuditLogById(@Param('id') id: string, @Req() req: any) {
    return this.tiramisAuditService.findById(id, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Get TIRAMIS audit logs by local tracking ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.AUDIT_VIEW)
  @Get('submissions/:id/audit-logs')
  getAuditLogsByTrackingId(@Param('id') id: string, @Req() req: any) {
    return this.tiramisAuditService.findByTrackingId(id, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Get TIRAMIS audit logs by business reference',
  })
  @RequireTiramisPermissions(TiramisPermissions.AUDIT_VIEW)
  @Get('audit-logs/business-reference/:businessReference')
  getAuditLogsByBusinessReference(
    @Param('businessReference') businessReference: string,
    @Req() req: any,
  ) {
    return this.tiramisAuditService.findByBusinessReference(
      businessReference,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get TIRAMIS audit timeline by correlation ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.AUDIT_VIEW)
  @Get('audit-logs/correlation/:correlationId')
  getAuditLogsByCorrelationId(
    @Param('correlationId') correlationId: string,
    @Req() req: any,
  ) {
    return this.tiramisAuditService.findByCorrelationId(
      correlationId,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Search TIRAMIS notifications with filters',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Get('notifications')
  getNotifications(
    @Query() query: FilterTiramisNotificationDto,
    @Req() req: any,
  ) {
    return this.tiramisNotificationService.search(query, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Get TIRAMIS notification summary',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Get('notifications/summary')
  getNotificationSummary(@Req() req: any) {
    return this.tiramisNotificationService.getSummary(this.getScope(req));
  }

  @ApiOperation({
    summary: 'Get unread TIRAMIS notifications',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Get('notifications/unread')
  getUnreadNotifications(@Query('limit') limit?: string, @Req() req?: any) {
    return this.tiramisNotificationService.findUnread(
      Number(limit || 50),
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get notifications by local tracking ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Get('submissions/:id/notifications')
  getNotificationsByTrackingId(@Param('id') id: string, @Req() req: any) {
    return this.tiramisNotificationService.findByTrackingId(
      id,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get notifications by business reference',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Get('notifications/business-reference/:businessReference')
  getNotificationsByBusinessReference(
    @Param('businessReference') businessReference: string,
    @Req() req: any,
  ) {
    return this.tiramisNotificationService.findByBusinessReference(
      businessReference,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Mark one TIRAMIS notification as read',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Post('notifications/:id/read')
  markNotificationRead(@Param('id') id: string, @Req() req: any) {
    return this.tiramisNotificationService.markRead(
      id,
      req.user?.id || req.user?.sub || null,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Mark one TIRAMIS notification as unread',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Post('notifications/:id/unread')
  markNotificationUnread(@Param('id') id: string, @Req() req: any) {
    return this.tiramisNotificationService.markUnread(id, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Dismiss one TIRAMIS notification',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Post('notifications/:id/dismiss')
  dismissNotification(@Param('id') id: string, @Req() req: any) {
    return this.tiramisNotificationService.dismiss(
      id,
      req.user?.id || req.user?.sub || null,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Mark all TIRAMIS notifications as read',
  })
  @RequireTiramisPermissions(TiramisPermissions.NOTIFICATION_VIEW)
  @Post('notifications/read-all')
  markAllNotificationsRead(@Req() req: any) {
    const scope = this.getScope(req);

    return this.tiramisNotificationService.markAllRead({
      userId: req.user?.id || req.user?.sub || null,
      sourceCompanyId: scope.companyId,
      canAccessAllCompanies: scope.canAccessAllCompanies,
    });
  }

  private getScope(req: any) {
    const authContext = this.getAuthContext(req);
    const scope = this.tiramisAccessScopeService.resolveScope(authContext);

    return {
      companyId: scope.companyId,
      canAccessAllCompanies: scope.canAccessAllCompanies,
    };
  }

  private getAuthContext(req: any) {
    return {
      userId: req?.user?.id || req?.user?.sub || null,
      sub: req?.user?.sub || null,
      email: req?.user?.email || null,
      userType: req?.user?.user_type || req?.user?.userType || null,
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
      branchId:
        req?.user?.branchId ||
        req?.user?.active_branch_id ||
        req?.user?.activeBranchId ||
        null,
      activeBranchId:
        req?.user?.active_branch_id ||
        req?.user?.activeBranchId ||
        req?.user?.branchId ||
        null,
      permissionCodes:
        req?.user?.permission_codes ||
        req?.user?.permissionCodes ||
        req?.user?.permissions ||
        [],
      roleCodes:
        req?.user?.role_codes || req?.user?.roleCodes || req?.user?.roles || [],
      correlationId:
        req?.headers?.['x-correlation-id'] ||
        req?.headers?.['x-request-id'] ||
        null,
      method: req?.method || null,
      endpoint: req?.originalUrl || req?.url || null,
      ipAddress:
        req?.ip ||
        req?.headers?.['x-forwarded-for'] ||
        req?.connection?.remoteAddress ||
        null,
      userAgent: req?.headers?.['user-agent'] || null,
    };
  }
}
