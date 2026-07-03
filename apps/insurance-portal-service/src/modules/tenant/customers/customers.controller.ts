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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomerDto } from './dto/filter-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('tenant/customers')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('customers:create')
  @ApiOperation({ summary: 'Create a customer for the current company' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.companyId!, dto, user.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('customers:read')
  @ApiOperation({ summary: 'List customers for the current company' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: FilterCustomerDto) {
    return this.customersService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get a customer by ID' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(user.companyId!, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('customers:update')
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.companyId!, id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('customers:delete')
  @ApiOperation({ summary: 'Soft-delete a customer' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.customersService.remove(user.companyId!, id);
    return { message: 'Customer deleted successfully' };
  }

  @Patch(':id/restore')
  @UseGuards(PermissionsGuard)
  @Permissions('customers:update')
  @ApiOperation({ summary: 'Restore a soft-deleted customer' })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.restore(user.companyId!, id);
  }
}

