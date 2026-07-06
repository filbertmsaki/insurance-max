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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireTiramisPermissions } from '../auth/tiramis-permission.decorator';
import { TiramisPermissionGuard } from '../auth/tiramis-permission.guard';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisStatusQueryDto } from '../dto/tiramis-status-query.dto';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisBusinessRecordSyncService } from '../services/tiramis-business-record-sync.service';
import { TiramisClientService } from '../services/tiramis-client.service';
import { TiramisRetryService } from '../services/tiramis-retry.service';
import { TiramisStatusSyncService } from '../services/tiramis-status-sync.service';

@ApiTags('TIRAMIS')
@ApiBearerAuth()
@Controller('tiramis')
@UseGuards(AuthGuard('jwt'), TiramisPermissionGuard)
export class TiramisController {
  constructor(
    private readonly tiramisClientService: TiramisClientService,
    private readonly tiramisStatusSyncService: TiramisStatusSyncService,
    private readonly tiramisBusinessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly tiramisRetryService: TiramisRetryService,
  ) {}

  @ApiOperation({
    summary: 'Submit any supported business payload to tiramis-service',
  })
  @ApiBody({ type: SubmitTiramisDto })
  @RequireTiramisPermissions(TiramisPermissions.SUBMIT)
  @Post('submit')
  submit(@Body() dto: SubmitTiramisDto, @Req() req: any) {
    return this.tiramisClientService.submit(dto, this.getAuthContext(req));
  }

  @ApiOperation({
    summary: 'Get TIRAMIS submission status',
  })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @ApiQuery({ name: 'includePayload', required: false })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('status')
  getStatus(@Query() query: TiramisStatusQueryDto, @Req() req: any) {
    return this.tiramisClientService.getStatus(
      {
        ...query,
        includePayload:
          String((query as any).includePayload).toLowerCase() === 'true',
      },
      this.getAuthContext(req),
    );
  }

  @ApiOperation({
    summary: 'Get full TIRAMIS submission trace',
  })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @ApiQuery({ name: 'includePayload', required: false })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('trace')
  getTrace(@Query() query: TiramisStatusQueryDto, @Req() req: any) {
    return this.tiramisClientService.getTrace(
      {
        ...query,
        includePayload:
          String((query as any).includePayload).toLowerCase() === 'true',
      },
      this.getAuthContext(req),
    );
  }

  @ApiOperation({
    summary: 'Check TCP connection from portal to tiramis-service',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('service-health')
  checkTiramisServiceHealth() {
    return this.tiramisClientService.checkTiramisServiceHealth();
  }

  @ApiOperation({
    summary: 'Get local portal-side TIRAMIS tracking record by ID',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('local-tracking/:id')
  getLocalTrackingById(@Param('id') id: string) {
    return this.tiramisClientService.getLocalTrackingById(id);
  }

  @ApiOperation({
    summary: 'Get local portal-side TIRAMIS tracking records by business reference',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('local-tracking/business-reference/:businessReference')
  getLocalTrackingByBusinessReference(
    @Param('businessReference') businessReference: string,
  ) {
    return this.tiramisClientService.getLocalTrackingByBusinessReference(
      businessReference,
    );
  }

  @ApiOperation({
    summary: 'Get recent local portal-side TIRAMIS tracking records',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('local-tracking')
  getRecentLocalTracking(@Query('limit') limit?: string) {
    return this.tiramisClientService.getRecentLocalTracking(Number(limit || 50));
  }

  @ApiOperation({
    summary: 'Manually retry all pending retryable TIRAMIS submissions',
  })
  @RequireTiramisPermissions(TiramisPermissions.RETRY)
  @Post('local-tracking/retry')
  retryPendingSubmissions() {
    return this.tiramisRetryService.retryPendingSubmissions();
  }

  @ApiOperation({
    summary: 'Manually retry one local TIRAMIS tracking record',
  })
  @RequireTiramisPermissions(TiramisPermissions.RETRY)
  @Post('local-tracking/:id/retry')
  retryOne(@Param('id') id: string) {
    return this.tiramisRetryService.retryOne(id);
  }

  @ApiOperation({
    summary: 'Check if a business record already has active TIRAMIS submission',
  })
  @ApiQuery({ name: 'requestType', required: true, enum: TiramisRequestType })
  @ApiQuery({ name: 'sourceModule', required: false })
  @ApiQuery({ name: 'sourceRecordId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('duplicate-check')
  checkDuplicate(
    @Query('requestType') requestType: TiramisRequestType,
    @Query('sourceModule') sourceModule?: string,
    @Query('sourceRecordId') sourceRecordId?: string,
    @Query('businessReference') businessReference?: string,
    @Req() req?: any,
  ) {
    return this.tiramisClientService.checkDuplicate({
      requestType,
      sourceModule,
      sourceRecordId,
      businessReference,
      sourceCompanyId:
        req?.user?.companyId ||
        req?.user?.active_company_id ||
        req?.user?.activeCompanyId ||
        null,
    });
  }

  @ApiOperation({
    summary: 'Manually run TIRAMIS final status sync for pending local records',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('local-tracking/sync')
  syncPendingFinalStatuses() {
    return this.tiramisStatusSyncService.syncPendingFinalStatuses();
  }

  @ApiOperation({
    summary: 'Manually sync one local TIRAMIS tracking record',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('local-tracking/:id/sync')
  syncOneLocalTracking(@Param('id') id: string) {
    return this.tiramisStatusSyncService.syncOne(id);
  }

  @ApiOperation({
    summary: 'Manually sync one local TIRAMIS tracking record to its business record',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post('local-tracking/:id/sync-business-record')
  async syncBusinessRecord(@Param('id') id: string) {
    const tracking = await this.tiramisClientService.getLocalTrackingById(id);

    const syncResult =
      await this.tiramisBusinessRecordSyncService.syncFromTracking(tracking);

    return {
      tracking,
      syncResult,
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
