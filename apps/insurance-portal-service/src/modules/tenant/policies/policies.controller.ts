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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { FilterPolicyDto } from './dto/filter-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@ApiBearerAuth()
@Controller('tenant/policies')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('policies:create')
  @ApiOperation({ summary: 'Create a policy' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePolicyDto) {
    return this.policiesService.create(user.companyId!, dto, user.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policies for the current company' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: FilterPolicyDto) {
    return this.policiesService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:read')
  @ApiOperation({ summary: 'Get a policy by ID' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOne(user.companyId!, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:update')
  @ApiOperation({ summary: 'Update a policy' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policiesService.update(user.companyId!, id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:delete')
  @ApiOperation({ summary: 'Soft-delete a policy' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.policiesService.remove(user.companyId!, id);
    return { message: 'Policy deleted successfully' };
  }

  @Patch(':id/restore')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:update')
  @ApiOperation({ summary: 'Restore a soft-deleted policy' })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.restore(user.companyId!, id);
  }

  @Get(':id/risks')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policy risks' })
  listRisks(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.listRisks(user.companyId!, id);
  }

  @Get(':id/breakdowns')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policy premium breakdowns' })
  listBreakdowns(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.listBreakdowns(user.companyId!, id);
  }

  @Get(':id/history')
  @UseGuards(PermissionsGuard)
  @Permissions('policies:read')
  @ApiOperation({ summary: 'List policy status history' })
  listHistory(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.listHistory(user.companyId!, id);
  }
}
