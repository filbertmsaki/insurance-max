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
import { InsuranceProductsService } from './insurance-products.service';
import { CreateInsuranceProductDto } from './dto/create-insurance-product.dto';
import { UpdateInsuranceProductDto } from './dto/update-insurance-product.dto';
import { FilterInsuranceProductDto } from './dto/filter-insurance-product.dto';

@ApiTags('Insurance Products')
@ApiBearerAuth()
@Controller('insurance-products')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class InsuranceProductsController {
  constructor(private readonly service: InsuranceProductsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-products:read')
  @ApiOperation({
    summary: 'List all insurance products for the current company',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterInsuranceProductDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-products:create')
  @ApiOperation({ summary: 'Create a new insurance product' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsuranceProductDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':productId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-products:read')
  @ApiOperation({ summary: 'Get an insurance product by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.service.findOne(user.companyId!, productId);
  }

  @Patch(':productId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-products:update')
  @ApiOperation({ summary: 'Update an insurance product' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateInsuranceProductDto,
  ) {
    return this.service.update(user.companyId!, productId, dto, user.id);
  }

  @Delete(':productId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-products:delete')
  @ApiOperation({ summary: 'Soft-delete an insurance product' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.service.remove(user.companyId!, productId);
    return { message: 'Insurance product deleted successfully' };
  }
}
