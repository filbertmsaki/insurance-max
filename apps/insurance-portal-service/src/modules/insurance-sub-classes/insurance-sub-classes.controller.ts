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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InsuranceSubClassesService } from './insurance-sub-classes.service';
import { CreateInsuranceSubClassDto } from './dto/create-insurance-sub-class.dto';
import { UpdateInsuranceSubClassDto } from './dto/update-insurance-sub-class.dto';
import { FilterInsuranceSubClassDto } from './dto/filter-insurance-sub-class.dto';

@ApiTags('Insurance Sub-Classes')
@ApiBearerAuth()
@Controller('insurance-sub-classes')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class InsuranceSubClassesController {
  constructor(private readonly service: InsuranceSubClassesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-sub-classes:read')
  @ApiOperation({
    summary: 'List all insurance sub-classes for the current company',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterInsuranceSubClassDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-sub-classes:create')
  @ApiOperation({ summary: 'Create a new insurance sub-class' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsuranceSubClassDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':subClassId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-sub-classes:read')
  @ApiOperation({ summary: 'Get an insurance sub-class by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subClassId', ParseUUIDPipe) subClassId: string,
  ) {
    return this.service.findOne(user.companyId!, subClassId);
  }

  @Patch(':subClassId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-sub-classes:update')
  @ApiOperation({ summary: 'Update an insurance sub-class' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subClassId', ParseUUIDPipe) subClassId: string,
    @Body() dto: UpdateInsuranceSubClassDto,
  ) {
    return this.service.update(user.companyId!, subClassId, dto, user.id);
  }

  @Delete(':subClassId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-sub-classes:delete')
  @ApiOperation({ summary: 'Soft-delete an insurance sub-class' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subClassId', ParseUUIDPipe) subClassId: string,
  ) {
    await this.service.remove(user.companyId!, subClassId);
    return { message: 'Insurance sub-class deleted successfully' };
  }
}
