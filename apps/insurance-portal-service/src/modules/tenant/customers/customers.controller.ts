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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomerDto } from './dto/filter-customer.dto';
import { SearchCustomersDto } from './dto/search-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('tenant/customers')
@TenantScoped()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Permissions('customers:create')
  @ApiOperation({ summary: 'Create a customer for the current company' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createForUser(user, dto);
  }

  @Get()
  @Permissions('customers:read')
  @ApiOperation({ summary: 'List customers for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterCustomerDto,
  ) {
    return this.customersService.findAllForUser(user, query);
  }

  // Declared before `:id` so "search" is not parsed as a customer ID.
  @Get('search')
  @Permissions('customers:read')
  @ApiOperation({
    summary: 'Find customers by name, phone or ID number (summary fields)',
  })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchCustomersDto,
  ) {
    return this.customersService.searchForUser(user, query);
  }

  @Get(':id')
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get a customer by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.findOneForUser(user, id);
  }

  @Get(':id/versions')
  @Permissions('customers:read')
  @ApiOperation({ summary: 'List immutable customer versions' })
  getVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.listVersionsForUser(user, id);
  }

  @Get(':id/audit-history')
  @Permissions('customers:audit-history:read')
  @ApiOperation({ summary: 'List read-only customer audit history' })
  getAuditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.listAuditHistoryForUser(user, id);
  }

  @Patch(':id')
  @Permissions('customers:update')
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateForUser(user, id, dto);
  }

  @Delete(':id')
  @Permissions('customers:delete')
  @ApiOperation({ summary: 'Soft-delete a customer' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.customersService.removeForUser(user, id);
    return { message: 'Customer deleted successfully' };
  }

  @Patch(':id/restore')
  @Permissions('customers:update')
  @ApiOperation({ summary: 'Restore a soft-deleted customer' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.restoreForUser(user, id);
  }
}
