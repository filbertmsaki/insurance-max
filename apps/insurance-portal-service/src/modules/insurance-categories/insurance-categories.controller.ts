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
import { InsuranceCategoriesService } from './insurance-categories.service';
import { CreateInsuranceCategoryDto } from './dto/create-insurance-category.dto';
import { UpdateInsuranceCategoryDto } from './dto/update-insurance-category.dto';
import { FilterInsuranceCategoryDto } from './dto/filter-insurance-category.dto';

@ApiTags('Insurance Categories')
@ApiBearerAuth()
@Controller('insurance-categories')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class InsuranceCategoriesController {
  constructor(private readonly service: InsuranceCategoriesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-categories:read')
  @ApiOperation({
    summary: 'List all insurance categories for the current company',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterInsuranceCategoryDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-categories:create')
  @ApiOperation({ summary: 'Create a new insurance category' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsuranceCategoryDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':categoryId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-categories:read')
  @ApiOperation({ summary: 'Get an insurance category by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.service.findOne(user.companyId!, categoryId);
  }

  @Patch(':categoryId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-categories:update')
  @ApiOperation({ summary: 'Update an insurance category' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateInsuranceCategoryDto,
  ) {
    return this.service.update(user.companyId!, categoryId, dto, user.id);
  }

  @Delete(':categoryId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-categories:delete')
  @ApiOperation({ summary: 'Soft-delete an insurance category' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    await this.service.remove(user.companyId!, categoryId);
    return { message: 'Insurance category deleted successfully' };
  }
}
