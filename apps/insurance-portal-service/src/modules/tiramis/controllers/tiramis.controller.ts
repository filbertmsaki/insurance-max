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

import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisStatusQueryDto } from '../dto/tiramis-status-query.dto';
import { TiramisClientService } from '../services/tiramis-client.service';
import { TiramisStatusSyncService } from '../services/tiramis-status-sync.service';

@ApiTags('TIRAMIS')
@ApiBearerAuth()
@Controller('tiramis')
@UseGuards(AuthGuard('jwt'))
export class TiramisController {
  constructor(
    private readonly tiramisClientService: TiramisClientService,
    private readonly tiramisStatusSyncService: TiramisStatusSyncService,
  ) {}

  @ApiOperation({
    summary: 'Submit any supported business payload to tiramis-service',
  })
  @ApiBody({ type: SubmitTiramisDto })
  @Post('submit')
  submit(@Body() dto: SubmitTiramisDto, @Req() req: any) {
    return this.tiramisClientService.submit(dto, {
      userId: req.user?.id || req.user?.sub || null,
      companyId:
        req.user?.companyId ||
        req.user?.active_company_id ||
        req.user?.activeCompanyId ||
        null,
    });
  }

  @ApiOperation({
    summary: 'Get TIRAMIS submission status',
  })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @ApiQuery({ name: 'includePayload', required: false })
  @Get('status')
  getStatus(@Query() query: TiramisStatusQueryDto) {
    return this.tiramisClientService.getStatus({
      ...query,
      includePayload:
        String((query as any).includePayload).toLowerCase() === 'true',
    });
  }

  @ApiOperation({
    summary: 'Get full TIRAMIS submission trace',
  })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @ApiQuery({ name: 'includePayload', required: false })
  @Get('trace')
  getTrace(@Query() query: TiramisStatusQueryDto) {
    return this.tiramisClientService.getTrace({
      ...query,
      includePayload:
        String((query as any).includePayload).toLowerCase() === 'true',
    });
  }

  @ApiOperation({
    summary: 'Get local portal-side TIRAMIS tracking record by ID',
  })
  @Get('local-tracking/:id')
  getLocalTrackingById(@Param('id') id: string) {
    return this.tiramisClientService.getLocalTrackingById(id);
  }

  @ApiOperation({
    summary: 'Get local portal-side TIRAMIS tracking records by business reference',
  })
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
  @Get('local-tracking')
  getRecentLocalTracking(@Query('limit') limit?: string) {
    return this.tiramisClientService.getRecentLocalTracking(Number(limit || 50));
  }

  @ApiOperation({
    summary: 'Manually run TIRAMIS final status sync for pending local records',
  })
  @Post('local-tracking/sync')
  syncPendingFinalStatuses() {
    return this.tiramisStatusSyncService.syncPendingFinalStatuses();
  }

  @ApiOperation({
    summary: 'Manually sync one local TIRAMIS tracking record',
  })
  @Post('local-tracking/:id/sync')
  syncOneLocalTracking(@Param('id') id: string) {
    return this.tiramisStatusSyncService.syncOne(id);
  }
}
