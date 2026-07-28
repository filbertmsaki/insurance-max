import {
  Body,
  Delete,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
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
import { CreateSalePointDto } from './dto/create-sale-point.dto';
import { UpdateSalePointDto } from './dto/update-sale-point.dto';
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

  @Get('sale-points/branch/:branchId')
  @UseGuards(PermissionsGuard)
  @Permissions('branches:read')
  findBranchSalePoints(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.tiramisIntegrationService.findBranchSalePoints(user.companyId!, branchId);
  }

  @Post('sale-points/branch/:branchId')
  @UseGuards(PermissionsGuard)
  @Permissions('branches:manage-access')
  createSalePoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateSalePointDto,
  ) {
    return this.tiramisIntegrationService.createSalePoint(user.companyId!, branchId, dto);
  }

  @Patch('sale-points/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('branches:manage-access')
  updateSalePoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalePointDto & { branch_id: string },
  ) {
    return this.tiramisIntegrationService.updateSalePoint(user.companyId!, dto.branch_id, id, dto);
  }

  @Patch('sale-points/:id/status')
  @UseGuards(PermissionsGuard)
  @Permissions('branches:manage-access')
  setSalePointStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { branch_id: string; is_active: boolean },
  ) {
    return this.tiramisIntegrationService.setSalePointStatus(user.companyId!, body.branch_id, id, body.is_active);
  }

  @Patch('sale-points/:id/default')
  @UseGuards(PermissionsGuard)
  @Permissions('branches:manage-access')
  setDefaultSalePoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('branch_id') branchId: string,
  ) {
    return this.tiramisIntegrationService.setDefaultSalePoint(user.companyId!, branchId, id);
  }

  @Delete('sale-points/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('branches:manage-access')
  deleteSalePoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('branch_id') branchId: string,
  ) {
    return this.tiramisIntegrationService.deleteSalePoint(user.companyId!, branchId, id);
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
