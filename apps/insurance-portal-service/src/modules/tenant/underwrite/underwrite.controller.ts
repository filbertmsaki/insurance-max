import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  UNDERWRITE_DASHBOARD_VIEW_PERMISSION,
  UnderwriteAction,
  type UnderwriteLine,
} from '@insurance-max/contracts';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FilterCustomerDto } from '../customers/dto/filter-customer.dto';
import { FilterPolicyDto } from '../policies/dto/filter-policy.dto';
import { FilterQuotationDto } from '../quotations/dto/filter-quotation.dto';
import { UnderwriteDashboardService } from './common/underwrite-dashboard.service';
import {
  CurrentUnderwriteLine,
  UnderwriteLineAccess,
} from './common/underwrite-line.access';
import { UnderwriteLineGuard } from './common/underwrite-line.guard';
import { UnderwriteQueryService } from './common/underwrite-query.service';

const LINE_PARAM = {
  name: 'line',
  enum: ['motor', 'fleet', 'non-motor'],
  description: 'Underwrite business line',
};

@ApiTags('underwrite')
@ApiBearerAuth()
@Controller('tenant/underwrite')
@TenantScoped()
export class UnderwriteController {
  constructor(private readonly dashboardService: UnderwriteDashboardService) {}

  @Get('dashboard')
  @Permissions(UNDERWRITE_DASHBOARD_VIEW_PERMISSION)
  @ApiOperation({
    summary: 'Underwrite overview across the lines the user can access',
  })
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOverview(user);
  }
}

/**
 * Shared line-scoped endpoints. Each route enforces both the line gate
 * (`underwrite.<line>.<action>`) and the existing action permission.
 * Line-specific behaviour (fleet vehicles, non-motor risk schemas) lives in
 * the per-line controllers added in later phases.
 */
@ApiTags('underwrite')
@ApiBearerAuth()
@Controller('tenant/underwrite/:line')
@TenantScoped()
@UseGuards(UnderwriteLineGuard)
export class UnderwriteLineController {
  constructor(
    private readonly dashboardService: UnderwriteDashboardService,
    private readonly queryService: UnderwriteQueryService,
  ) {}

  @Get('dashboard')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Line dashboard statistics' })
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
  ) {
    return this.dashboardService.getLineSummary(user, line);
  }

  @Get('quotations')
  @Permissions('quotations:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List quotations in the line' })
  listQuotations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() query: FilterQuotationDto,
  ) {
    return this.queryService.listQuotations(user, line, query);
  }

  @Get('quotations/:id')
  @Permissions('quotations:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Get a quotation in the line' })
  getQuotation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queryService.getQuotation(user, line, id);
  }

  @Get('customers')
  @Permissions('customers:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({
    summary: 'List customers with quotations or policies in the line',
  })
  listCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() query: FilterCustomerDto,
  ) {
    return this.queryService.listCustomers(user, line, query);
  }

  @Get('policies')
  @Permissions('policies:read')
  @UnderwriteLineAccess(UnderwriteAction.POLICIES_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List policies in the line' })
  listPolicies(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() query: FilterPolicyDto,
  ) {
    return this.queryService.listPolicies(user, line, query);
  }

  @Get('policies/:id')
  @Permissions('policies:read')
  @UnderwriteLineAccess(UnderwriteAction.POLICIES_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Get a policy in the line' })
  getPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queryService.getPolicy(user, line, id);
  }
}
