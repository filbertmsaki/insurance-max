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
import { ApproveCustomerKycReviewDto } from './dto/approve-customer-kyc-review.dto';
import { RejectCustomerKycReviewDto } from './dto/reject-customer-kyc-review.dto';
import { RequestCustomerKycUpdateDto } from './dto/request-customer-kyc-update.dto';
import { SubmitCustomerKycReviewDto } from './dto/submit-customer-kyc-review.dto';
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

  @Get(':id')
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get a customer by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.findOneForUser(user, id);
  }

  @Get(':id/kyc')
  @Permissions('customer-kyc:read')
  @ApiOperation({ summary: 'Get the current KYC state for a customer' })
  getKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.getKycForUser(user, id);
  }

  @Get(':id/kyc/history')
  @Permissions('customer-kyc:read')
  @ApiOperation({ summary: 'List immutable KYC review history for a customer' })
  getKycHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.listKycHistoryForUser(user, id);
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

  @Post(':id/kyc/submit-review')
  @Permissions('customer-kyc:submit')
  @ApiOperation({ summary: 'Submit a customer for KYC review' })
  submitKycReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitCustomerKycReviewDto,
  ) {
    return this.customersService.submitKycReviewForUser(user, id, dto);
  }

  @Post(':id/kyc/approve')
  @Permissions('customer-kyc:approve')
  @ApiOperation({ summary: 'Approve a customer KYC review' })
  approveKycReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCustomerKycReviewDto,
  ) {
    return this.customersService.approveKycReviewForUser(user, id, dto);
  }

  @Post(':id/kyc/reject')
  @Permissions('customer-kyc:review')
  @ApiOperation({ summary: 'Reject a customer KYC review' })
  rejectKycReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCustomerKycReviewDto,
  ) {
    return this.customersService.rejectKycReviewForUser(user, id, dto);
  }

  @Post(':id/kyc/request-update')
  @Permissions('customer-kyc:review')
  @ApiOperation({
    summary: 'Mark a verified customer as requiring a KYC update',
  })
  requestKycUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestCustomerKycUpdateDto,
  ) {
    return this.customersService.requestKycUpdateForUser(user, id, dto);
  }

  @Post(':id/kyc/expire')
  @Permissions('customer-kyc:review')
  @ApiOperation({ summary: 'Expire an active customer KYC approval' })
  expireKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestCustomerKycUpdateDto,
  ) {
    return this.customersService.expireKycForUser(user, id, dto);
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
