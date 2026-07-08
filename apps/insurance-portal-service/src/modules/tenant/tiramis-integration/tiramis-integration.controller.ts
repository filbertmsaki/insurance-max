import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { FilterPortalTiraSubmissionDto } from './dto/filter-portal-tira-submission.dto';
import { SubmitPortalTiraDto } from './dto/submit-portal-tira.dto';
import { TiramisIntegrationService } from './tiramis-integration.service';

@ApiTags('tiramis-submissions')
@ApiBearerAuth()
@Controller('tenant/tiramis-submissions')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class TiramisIntegrationController {
  constructor(
    private readonly tiramisIntegrationService: TiramisIntegrationService,
  ) {}

  @Post('submit')
  @UseGuards(PermissionsGuard)
  @Permissions('tiramis-submissions:create')
  @ApiOperation({
    summary: 'Submit a prepared TIRAMIS payload to the TIRAMIS service',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitPortalTiraDto,
  ) {
    return this.tiramisIntegrationService.submitToTiramis({
      companyId: user.companyId!,
      userId: user.id,
      dto,
    });
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('tiramis-submissions:read')
  @ApiOperation({ summary: 'List TIRAMIS submissions for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterPortalTiraSubmissionDto,
  ) {
    return this.tiramisIntegrationService.findAll(user.companyId!, query);
  }

  @Get('sale-points')
  @UseGuards(PermissionsGuard)
  @Permissions('tiramis-submissions:read')
  @ApiOperation({
    summary: 'List active TIRA sale points for the current company',
  })
  findSalePoints(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branch_id') branchId?: string,
  ) {
    return this.tiramisIntegrationService.findSalePoints(
      user.companyId!,
      branchId,
    );
  }

  @Get('request/:requestId')
  @UseGuards(PermissionsGuard)
  @Permissions('tiramis-submissions:read')
  @ApiOperation({ summary: 'Get a TIRAMIS submission by request ID' })
  findByRequestId(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ) {
    return this.tiramisIntegrationService.findByRequestId(
      user.companyId!,
      requestId,
    );
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('tiramis-submissions:read')
  @ApiOperation({ summary: 'Get a TIRAMIS submission by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tiramisIntegrationService.findOne(user.companyId!, id);
  }
}
