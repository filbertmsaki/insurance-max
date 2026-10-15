import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  TableQueryDto,
  isPagedRequest,
} from '@insurance-max/portal-shared/dto/table-query.dto';

import {
  CustomerCompanyProductQueryDto,
  CustomerCompanyRiskQueryDto,
  CustomerCoverCheckDto,
} from '../dto/customer-marketplace.dto';
import { CustomerMarketplaceService } from '../services/customer-marketplace.service';

@ApiTags('Customer marketplace')
@ApiBearerAuth('access-token')
@Controller({ path: 'customer', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class CustomerMarketplaceController {
  constructor(
    private readonly marketplaceService: CustomerMarketplaceService,
  ) {}

  @Get('companies')
  @ApiOperation({
    summary: 'List insurance companies available for customer portal sales',
  })
  companies(@CurrentUser() user: AuthenticatedUser) {
    return this.marketplaceService.listEligibleCompanies(user);
  }

  @Get('companies/:companyId/products')
  @ApiOperation({
    summary: 'List customer-available products for the selected company',
  })
  products(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: CustomerCompanyProductQueryDto,
  ) {
    return this.marketplaceService.listProducts(user, companyId, query);
  }

  @Get('companies/:companyId/products/:productId/risks')
  @ApiOperation({
    summary: 'List customer-available risks for the selected product',
  })
  risks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: CustomerCompanyRiskQueryDto,
  ) {
    return this.marketplaceService.listRisks(user, companyId, productId, query);
  }

  @Post('companies/:companyId/context')
  @ApiOperation({
    summary:
      'Create or resolve the logged-in customer profile for a selected company',
  })
  companyCustomerContext(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.marketplaceService.ensureCompanyCustomerContext(
      user,
      companyId,
    );
  }

  @Get('vehicles')
  @ApiOperation({
    summary:
      'List vehicles belonging to the logged-in customer across insurers',
  })
  vehicles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TableQueryDto,
  ) {
    // `page` opts into the paged table contract; otherwise the full list.
    return isPagedRequest(query)
      ? this.marketplaceService.pageMyVehicles(user, query)
      : this.marketplaceService.listMyVehicles(user);
  }

  @Post('cover/check')
  @ApiOperation({
    summary: 'Check whether a vehicle has an active internal cover',
  })
  checkCover(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CustomerCoverCheckDto,
  ) {
    return this.marketplaceService.checkVehicleCover(user, dto);
  }
}
