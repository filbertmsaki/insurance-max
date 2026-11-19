import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TenantScoped } from '@insurance-max/portal-shared';

import { DataAccessScopeService } from '../../../../shared/authorization/data-access-scope.service';
import {
  FinancePermission,
  FinancePermissions,
} from '../../governance/finance-permissions/finance.permissions';
import { FinanceEventOperationsService } from './finance-event-operations.service';

export class RequestReplayDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}

export class DecideReplayDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/**
 * Finance event monitoring and controlled replay. Outbox events are
 * company-level operational records, so every endpoint requires company-wide
 * data access in addition to the action permission.
 */
@Controller('tenant/finance/events')
@TenantScoped()
export class FinanceEventOperationsController {
  constructor(
    private readonly operations: FinanceEventOperationsService,
    private readonly dataAccessScope: DataAccessScopeService,
  ) {}

  @Get('summary')
  @Permissions(FinancePermissions.FINANCE_EVENTS_READ)
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.summary(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_READ),
    );
  }

  @Get()
  @Permissions(FinancePermissions.FINANCE_EVENTS_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.operations.list(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_READ),
      {
        status: status || undefined,
        eventType: eventType || undefined,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 25,
      },
    );
  }

  @Get('replays')
  @Permissions(FinancePermissions.FINANCE_EVENTS_READ)
  replays(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.operations.listReplays(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_READ),
      status || undefined,
    );
  }

  @Get(':id')
  @Permissions(FinancePermissions.FINANCE_EVENTS_READ)
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.operations.detail(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_READ),
      id,
    );
  }

  @Post(':id/replay-requests')
  @Permissions(FinancePermissions.FINANCE_EVENTS_REPLAY_REQUEST)
  requestReplay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestReplayDto,
  ) {
    return this.operations.requestReplay(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_REPLAY_REQUEST),
      user.id,
      id,
      dto.reason,
    );
  }

  @Post('replays/:requestId/decision')
  @Permissions(FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE)
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideReplayDto,
  ) {
    return this.operations.decideReplay(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE),
      user.id,
      requestId,
      dto.decision,
      dto.note,
    );
  }

  @Post('replays/:requestId/execute')
  @Permissions(FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE)
  execute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.operations.executeReplay(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE),
      user.id,
      requestId,
    );
  }

  @Post('replays/:requestId/cancel')
  @Permissions(FinancePermissions.FINANCE_EVENTS_REPLAY_REQUEST)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.operations.cancelReplay(
      this.companyWide(user, FinancePermissions.FINANCE_EVENTS_REPLAY_REQUEST),
      user.id,
      requestId,
    );
  }

  private companyWide(
    user: AuthenticatedUser,
    permission: FinancePermission,
  ): string {
    const scope = this.dataAccessScope.resolve(user, permission);
    if (!user.companyId || !scope.canViewAllBranches || scope.ownRecordsOnly) {
      throw new ForbiddenException(
        'Finance event operations require company-wide data access.',
      );
    }
    return user.companyId;
  }
}
