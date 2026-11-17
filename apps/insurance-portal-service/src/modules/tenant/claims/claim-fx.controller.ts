import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClaimFxRateDto, ClaimFxRejectDto } from './dto/claim-fx.dto';
import { ClaimFxGovernanceService } from './services/claim-fx-governance.service';
import { ClaimAccessService } from './services/claim-access.service';
import { DataSource } from 'typeorm';

@Controller('tenant/claims-fx/rates')
@TenantScoped()
export class ClaimFxController {
  constructor(private readonly fx: ClaimFxGovernanceService) {}

  @Get()
  @Permissions('claims.fx.view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.fx.list(user, status);
  }

  @Get(':id')
  @Permissions('claims.fx.view')
  details(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fx.details(user, id);
  }

  @Post()
  @Permissions('claims.fx.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: ClaimFxRateDto) {
    return this.fx.create(user, body);
  }

  @Patch(':id')
  @Permissions('claims.fx.create')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClaimFxRateDto,
  ) {
    return this.fx.update(user, id, body);
  }

  @Post(':id/submit')
  @Permissions('claims.fx.submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fx.transition(user, id, 'SUBMIT');
  }

  @Post(':id/approve')
  @Permissions('claims.fx.approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fx.transition(user, id, 'APPROVE');
  }

  @Post(':id/reject')
  @Permissions('claims.fx.approve')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClaimFxRejectDto,
  ) {
    return this.fx.transition(user, id, 'REJECT', body.reason);
  }
}

@Controller('tenant/claims-fx/claims')
@TenantScoped()
export class ClaimFxHistoryController {
  constructor(
    private readonly access: ClaimAccessService,
    private readonly dataSource: DataSource,
  ) {}

  @Get(':id/snapshots')
  @Permissions('claims.fx.history')
  async snapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const claim = await this.access.getForRead(user, id);
    return this.dataSource.query(
      `SELECT * FROM claim_fx_snapshots WHERE company_id=$1 AND claim_id=$2 ORDER BY created_at, version`,
      [claim.company_id, claim.id],
    );
  }
}
