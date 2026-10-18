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
import { CreateMotorFleetDto } from './dto/create-motor-fleet.dto';
import { CreateMotorFleetItemDto } from './dto/create-motor-fleet-item.dto';
import { CreateMotorPolicyDetailDto } from './dto/create-motor-policy-detail.dto';
import { CreateMotorVehicleDto } from './dto/create-motor-vehicle.dto';
import { FilterMotorDto } from './dto/filter-motor.dto';
import { SearchMotorVehiclesDto } from './dto/search-motor-vehicles.dto';
import { UpdateMotorFleetDto } from './dto/update-motor-fleet.dto';
import { UpdateMotorFleetItemDto } from './dto/update-motor-fleet-item.dto';
import { UpdateMotorPolicyDetailDto } from './dto/update-motor-policy-detail.dto';
import { UpdateMotorVehicleDto } from './dto/update-motor-vehicle.dto';
import { MotorService } from './motor.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('motor')
@ApiBearerAuth()
@Controller('tenant/motor')
@TenantScoped()
export class MotorController {
  constructor(private readonly motorService: MotorService) {}

  @Get('vehicles')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'List motor vehicles for the current company' })
  listVehicles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterMotorDto,
  ) {
    return this.motorService.listVehicles(user.companyId!, query);
  }

  @Post('vehicles')
  @Permissions('motor:create')
  @ApiOperation({ summary: 'Create a motor vehicle' })
  createVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMotorVehicleDto,
  ) {
    return this.motorService.createVehicle(user.companyId!, dto, user.id);
  }

  // Declared before `vehicles/:id` so "search" is not parsed as a vehicle ID.
  @Get('vehicles/search')
  @Permissions('motor:read')
  @ApiOperation({
    summary: 'Find motor vehicles by registration or chassis number',
  })
  searchVehicles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchMotorVehiclesDto,
  ) {
    return this.motorService.searchVehicles(user.companyId!, query);
  }

  @Get('vehicles/:id')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'Get a motor vehicle by ID' })
  findVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.findVehicle(user.companyId!, id);
  }

  @Patch('vehicles/:id')
  @Permissions('motor:update')
  @ApiOperation({ summary: 'Update a motor vehicle' })
  updateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMotorVehicleDto,
  ) {
    return this.motorService.updateVehicle(user.companyId!, id, dto, user.id);
  }

  @Delete('vehicles/:id')
  @Permissions('motor:delete')
  @ApiOperation({ summary: 'Archive a motor vehicle' })
  async removeVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.motorService.removeVehicle(user.companyId!, id, user.id);
    return { message: 'Motor vehicle archived successfully' };
  }

  @Patch('vehicles/:id/restore')
  @Permissions('motor:update')
  @ApiOperation({ summary: 'Restore an archived motor vehicle' })
  restoreVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.restoreVehicle(user.companyId!, id, user.id);
  }

  @Get('vehicles/:id/versions')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'List immutable motor vehicle versions' })
  listVehicleVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.listVehicleVersions(user.companyId!, id);
  }

  @Get('vehicles/:id/audit-history')
  @Permissions('motor:audit-history:read')
  @ApiOperation({ summary: 'List read-only motor vehicle audit history' })
  listVehicleAuditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.listVehicleAuditHistory(user.companyId!, id);
  }

  @Get('vehicles/:id/insurance-history')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'List motor vehicle insurance history' })
  listVehicleInsuranceHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.listVehicleInsuranceHistory(user.companyId!, id);
  }

  @Get('fleets')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'List motor fleets for the current company' })
  listFleets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterMotorDto,
  ) {
    return this.motorService.listFleets(user.companyId!, query);
  }

  @Post('fleets')
  @Permissions('motor:create')
  @ApiOperation({ summary: 'Create a motor fleet' })
  createFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMotorFleetDto,
  ) {
    return this.motorService.createFleet(user.companyId!, dto);
  }

  @Get('fleets/:id')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'Get a motor fleet by ID' })
  findFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.findFleet(user.companyId!, id);
  }

  @Patch('fleets/:id')
  @Permissions('motor:update')
  @ApiOperation({ summary: 'Update a motor fleet' })
  updateFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMotorFleetDto,
  ) {
    return this.motorService.updateFleet(user.companyId!, id, dto);
  }

  @Delete('fleets/:id')
  @Permissions('motor:delete')
  @ApiOperation({ summary: 'Soft-delete a motor fleet' })
  async removeFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.motorService.removeFleet(user.companyId!, id);
    return { message: 'Motor fleet deleted successfully' };
  }

  @Get('fleets/:fleetId/items')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'List items in a motor fleet' })
  listFleetItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
  ) {
    return this.motorService.listFleetItems(user.companyId!, fleetId);
  }

  @Post('fleets/:fleetId/items')
  @Permissions('motor:create')
  @ApiOperation({ summary: 'Add a vehicle item to a motor fleet' })
  createFleetItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Body() dto: CreateMotorFleetItemDto,
  ) {
    return this.motorService.createFleetItem(user.companyId!, fleetId, dto);
  }

  @Get('fleets/:fleetId/items/:id')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'Get a motor fleet item by ID' })
  findFleetItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.findFleetItem(user.companyId!, fleetId, id);
  }

  @Patch('fleets/:fleetId/items/:id')
  @Permissions('motor:update')
  @ApiOperation({ summary: 'Update a motor fleet item' })
  updateFleetItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMotorFleetItemDto,
  ) {
    return this.motorService.updateFleetItem(user.companyId!, fleetId, id, dto);
  }

  @Delete('fleets/:fleetId/items/:id')
  @Permissions('motor:delete')
  @ApiOperation({ summary: 'Remove a motor fleet item' })
  async removeFleetItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.motorService.removeFleetItem(user.companyId!, fleetId, id);
    return { message: 'Motor fleet item deleted successfully' };
  }

  @Get('policy-details')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'List motor policy details' })
  listPolicyDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id') policyId?: string,
  ) {
    return this.motorService.listPolicyDetails(user.companyId!, policyId);
  }

  @Post('policy-details')
  @Permissions('motor:create')
  @ApiOperation({ summary: 'Create a motor policy detail' })
  createPolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMotorPolicyDetailDto,
  ) {
    return this.motorService.createPolicyDetail(user.companyId!, dto);
  }

  @Get('policy-details/:id')
  @Permissions('motor:read')
  @ApiOperation({ summary: 'Get a motor policy detail by ID' })
  findPolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.motorService.findPolicyDetail(user.companyId!, id);
  }

  @Patch('policy-details/:id')
  @Permissions('motor:update')
  @ApiOperation({ summary: 'Update a motor policy detail' })
  updatePolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMotorPolicyDetailDto,
  ) {
    return this.motorService.updatePolicyDetail(user.companyId!, id, dto);
  }

  @Delete('policy-details/:id')
  @Permissions('motor:delete')
  @ApiOperation({ summary: 'Delete a motor policy detail' })
  async removePolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.motorService.removePolicyDetail(user.companyId!, id);
    return { message: 'Motor policy detail deleted successfully' };
  }

  @Patch('policy-details/:id/restore')
  @Permissions('motor:update')
  @ApiOperation({ summary: 'Restore a soft-deleted motor policy detail' })
  async restorePolicyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.motorService.restorePolicyDetail(user.companyId!, id);
    return { message: 'Motor policy detail restored successfully' };
  }
}
