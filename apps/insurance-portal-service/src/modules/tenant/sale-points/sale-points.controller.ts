import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TenantScoped } from '@insurance-max/portal-shared';

import { SalePointsService } from './sale-points.service';
import { CreateSalePointDto } from './dto/create-sale-point.dto';
import { UpdateSalePointDto } from './dto/update-sale-point.dto';
import { UpdateSalePointStatusDto } from './dto/update-sale-point-status.dto';

@ApiTags('Sale points')
@ApiBearerAuth('access-token')
@Controller('sale-points')
@TenantScoped()
export class SalePointsController {
  constructor(private readonly salePointsService: SalePointsService) {}

  @Get()
  @Permissions('sale-points:read')
  @ApiOperation({ summary: 'List sales points for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branch_id') branchId?: string,
  ) {
    return this.salePointsService.findAll(user.companyId!, branchId);
  }

  @Get('branch/:branchId')
  @Permissions('sale-points:read')
  @ApiOperation({ summary: 'List sales points for a specific branch' })
  findForBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.salePointsService.findForBranch(user.companyId!, branchId);
  }

  @Post('branch/:branchId')
  @Permissions('sale-points:create')
  @ApiOperation({ summary: 'Create a sales point under a branch' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateSalePointDto,
  ) {
    return this.salePointsService.create(
      user.companyId!,
      branchId,
      dto,
      user.id,
    );
  }

  @Patch('branch/:branchId/:id')
  @Permissions('sale-points:update')
  @ApiOperation({ summary: 'Update a sales point' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalePointDto,
  ) {
    return this.salePointsService.update(
      user.companyId!,
      branchId,
      id,
      dto,
      user.id,
    );
  }

  @Patch('branch/:branchId/:id/status')
  @Permissions('sale-points:update')
  @ApiOperation({ summary: 'Activate or deactivate a sales point' })
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalePointStatusDto,
  ) {
    return this.salePointsService.setStatus(
      user.companyId!,
      branchId,
      id,
      dto.is_active,
      user.id,
    );
  }

  @Patch('branch/:branchId/:id/default')
  @Permissions('sale-points:update')
  @ApiOperation({ summary: 'Set a sales point as the branch default' })
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salePointsService.setDefault(
      user.companyId!,
      branchId,
      id,
      user.id,
    );
  }

  @Delete('branch/:branchId/:id')
  @Permissions('sale-points:delete')
  @ApiOperation({ summary: 'Delete a sales point' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salePointsService.remove(user.companyId!, branchId, id, user.id);
  }
}
