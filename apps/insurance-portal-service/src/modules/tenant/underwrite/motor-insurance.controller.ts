import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UnderwriteAction } from '@insurance-max/contracts';
import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  MotorInsurancePolicyFilterDto,
  MotorInsuranceQuotationFilterDto,
} from './dto/motor-insurance-filter.dto';
import {
  MotorInsuranceQueryService,
  type MotorInsuranceType,
} from './common/motor-insurance-query.service';
import { UnderwriteTransactionsService } from './common/underwrite-transactions.service';

/**
 * Read-only endpoints for the unified Motor Insurance module (MF-1).
 * Deliberately outside `tenant/underwrite/:line` so the path cannot be taken
 * for a line slug. All writes keep using the line-scoped endpoints.
 */
@ApiTags('motor-insurance')
@ApiBearerAuth()
@Controller('tenant/motor-insurance')
@TenantScoped()
export class MotorInsuranceController {
  constructor(
    private readonly queryService: MotorInsuranceQueryService,
    private readonly transactions: UnderwriteTransactionsService,
  ) {}

  @Get('quotations')
  @Permissions('quotations:read')
  @ApiQuery({ name: 'type', required: false, enum: ['single', 'fleet'] })
  @ApiOperation({ summary: 'Motor and Fleet quotations in one register' })
  listQuotations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MotorInsuranceQuotationFilterDto,
  ) {
    const { type, rest } = splitType(query);
    return this.queryService.listQuotations(user, rest, type);
  }

  @Get('quotations/:id/line')
  @Permissions('quotations:read')
  @ApiOperation({ summary: 'Resolve the line (Motor or Fleet) of a quotation' })
  quotationLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queryService.resolveQuotationLine(user, id);
  }

  @Get('policies')
  @Permissions('policies:read')
  @ApiQuery({ name: 'type', required: false, enum: ['single', 'fleet'] })
  @ApiOperation({ summary: 'Motor and Fleet policies in one register' })
  listPolicies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MotorInsurancePolicyFilterDto,
  ) {
    const { type, rest } = splitType(query);
    return this.queryService.listPolicies(user, rest, type);
  }

  @Get('policies/:id/line')
  @Permissions('policies:read')
  @ApiOperation({ summary: 'Resolve the line (Motor or Fleet) of a policy' })
  policyLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queryService.resolvePolicyLine(user, id);
  }

  /*
   * Policy transactions across Motor and Fleet (MF-5). Each list includes
   * only the lines whose gate the user holds for that action; the existing
   * policy/transaction data scope is then applied by the shared service.
   */

  @Get('renewals')
  @Permissions('renewals:read')
  @ApiOperation({ summary: 'Motor and Fleet renewals' })
  listRenewals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listRenewals(
      user,
      this.queryService.permittedLines(user, UnderwriteAction.RENEWALS_VIEW),
      table,
    );
  }

  @Get('endorsements')
  @AnyPermissions(
    'endorsements:create',
    'policy-transactions:read',
    'endorsements:approve',
  )
  @ApiOperation({ summary: 'Motor and Fleet endorsements' })
  listEndorsements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTransactions(
      user,
      this.queryService.permittedLines(
        user,
        UnderwriteAction.ENDORSEMENTS_VIEW,
      ),
      'endorsement',
      table,
    );
  }

  @Get('cancellations')
  @AnyPermissions('cancellations:read', 'cancellations:approve')
  @ApiOperation({ summary: 'Motor and Fleet cancellations' })
  listCancellations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTransactions(
      user,
      this.queryService.permittedLines(
        user,
        UnderwriteAction.CANCELLATIONS_VIEW,
      ),
      'cancellation',
      table,
    );
  }

  @Get('tira-failed')
  @AnyPermissions(
    'quotations:retry-tiramis',
    'endorsements:retry-tiramis',
    'cancellations:submit-tiramis',
  )
  @ApiOperation({
    summary: 'Failed or retryable TIRA work across Motor and Fleet',
  })
  listTiraFailed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTiraQueue(
      user,
      this.queryService.permittedLines(user, UnderwriteAction.TIRA_RETRY),
      'failed',
      table,
    );
  }

  @Get('tira-pending')
  @AnyPermissions(
    'quotations:retry-tiramis',
    'endorsements:retry-tiramis',
    'cancellations:submit-tiramis',
  )
  @ApiOperation({ summary: 'Pending TIRA work across Motor and Fleet' })
  listTiraPending(
    @CurrentUser() user: AuthenticatedUser,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTiraQueue(
      user,
      this.queryService.permittedLines(user, UnderwriteAction.TIRA_RETRY),
      'pending',
      table,
    );
  }
}

function splitType<T extends object>(
  query: T,
): { type?: MotorInsuranceType; rest: T } {
  const { type, ...rest } = query as T & { type?: string };
  return {
    type: type === 'single' || type === 'fleet' ? type : undefined,
    rest: rest as T,
  };
}
