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
import { CreatePolicyDto } from './dto/create-policy.dto';
import { FilterPolicyDto } from './dto/filter-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PoliciesService } from './policies.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('policies')
@ApiBearerAuth()
@Controller('tenant/policies')
@TenantScoped()
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @Permissions('policies:create')
  @ApiOperation({ summary: 'Create a policy' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePolicyDto) {
    return this.policiesService.createForUser(user, dto);
  }

  @Get()
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policies for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterPolicyDto,
  ) {
    return this.policiesService.findAllForUser(user, query);
  }

  @Get(':id')
  @Permissions('policies:read')
  @ApiOperation({ summary: 'Get a policy by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.policiesService.findOneForUser(user, id);
  }

  @Patch(':id')
  @Permissions('policies:update')
  @ApiOperation({ summary: 'Update a policy' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policiesService.updateForUser(user, id, dto);
  }

  @Delete(':id')
  @Permissions('policies:delete')
  @ApiOperation({ summary: 'Soft-delete a policy' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.policiesService.removeForUser(user, id);
  }

  @Patch(':id/restore')
  @Permissions('policies:update')
  @ApiOperation({ summary: 'Restore a soft-deleted policy' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.policiesService.restoreForUser(user, id);
  }

  @Get(':id/risks')
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policy risks' })
  listRisks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.policiesService.listRisksForUser(user, id);
  }

  @Get(':id/breakdowns')
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policy premium breakdowns' })
  listBreakdowns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.policiesService.listBreakdownsForUser(user, id);
  }

  @Get(':id/history')
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policy status history' })
  listHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.policiesService.listHistoryForUser(user, id);
  }
}
