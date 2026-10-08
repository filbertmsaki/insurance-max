import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PublicServiceEndpoint } from '@insurance-max/shared-kernel';
import { TiramisAdministratorGuard } from '../../api-keys/guards/tiramis-administrator.guard';

import type { TiramisPortalNotificationOutboxStatus } from '../entities/tiramis-portal-notification-outbox.entity';
import { TiramisPortalNotificationService } from '../services/tiramis-portal-notification.service';

@ApiTags('TIRAMIS Portal Notification Outbox')
@Controller('tiramis/portal-notifications/outbox')
@PublicServiceEndpoint()
@UseGuards(TiramisAdministratorGuard)
export class TiramisPortalNotificationOutboxController {
  constructor(
    private readonly notificationService: TiramisPortalNotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List portal notification outbox entries' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('status') status?: string,
    @Query('requestId') requestId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.listOutbox({
      status: status as TiramisPortalNotificationOutboxStatus | undefined,
      requestId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Manually retry one portal notification outbox row',
  })
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.retryOutboxEntry(id);
  }

  @Get('callbacks')
  @ApiOperation({
    summary: 'List callback verification and processing outcomes',
  })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  callbacks(
    @Query('requestId') requestId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.listCallbackDiagnostics({
      requestId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
