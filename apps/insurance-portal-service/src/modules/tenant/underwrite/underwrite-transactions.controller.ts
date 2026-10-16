import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
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
  UnderwriteAction,
  WorkflowApprovalStatus,
  type UnderwriteLine,
  type WorkflowApprovalStatus as WorkflowApprovalStatusType,
} from '@insurance-max/contracts';
import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import { CreateCancellationDto } from '../policy-transactions/dto/create-cancellation.dto';
import { CreateEndorsementDto } from '../policy-transactions/dto/create-endorsement.dto';
import { EndorsementEligibilityQueryDto } from '../policy-transactions/dto/endorsement-eligibility-query.dto';
import { LinkRenewalQuotationDto } from '../policy-transactions/dto/link-renewal-quotation.dto';
import { ReasonDto } from '../policy-transactions/dto/reason.dto';
import { RecordEndorsementChangeDto } from '../policy-transactions/dto/record-endorsement-change.dto';
import { PolicyTransaction } from '../policy-transactions/entities/policy-transaction.entity';
import { CancellationService } from '../policy-transactions/services/cancellation.service';
import { EndorsementService } from '../policy-transactions/services/endorsement.service';
import { PolicyTransactionLifecycleService } from '../policy-transactions/services/policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisSubmissionService } from '../policy-transactions/services/policy-transaction-tiramis-submission.service';
import { RenewalService } from '../policy-transactions/services/renewal.service';
import { QuotationsService } from '../quotations/quotations.service';
import {
  CurrentUnderwriteLine,
  UnderwriteLineAccess,
} from './common/underwrite-line.access';
import { UnderwriteLineGuard } from './common/underwrite-line.guard';
import { UnderwriteTransactionsService } from './common/underwrite-transactions.service';
import { canSelfApprove } from '../../shared/authorization/maker-checker';

const LINE_PARAM = {
  name: 'line',
  enum: ['motor', 'fleet', 'non-motor'],
  description: 'Underwrite business line',
};

@ApiTags('underwrite')
@ApiBearerAuth()
@Controller('tenant/underwrite/:line')
@TenantScoped()
@UseGuards(UnderwriteLineGuard)
export class UnderwriteTransactionsController {
  private readonly logger = new Logger(UnderwriteTransactionsController.name);

  constructor(
    private readonly transactions: UnderwriteTransactionsService,
    private readonly endorsementService: EndorsementService,
    private readonly cancellationService: CancellationService,
    private readonly renewalService: RenewalService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly submissionService: PolicyTransactionTiramisSubmissionService,
    private readonly quotationsService: QuotationsService,
  ) {}

  @Get('renewals')
  @Permissions('renewals:read')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List renewal offers in the line' })
  listRenewals(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listRenewals(user, line, table);
  }

  @Get('endorsements')
  @AnyPermissions(
    'endorsements:create',
    'policy-transactions:read',
    'endorsements:approve',
  )
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List endorsements in the line' })
  listEndorsements(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTransactions(user, line, 'endorsement', table);
  }

  @Get('cancellations')
  @AnyPermissions('cancellations:read', 'cancellations:approve')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List cancellations in the line' })
  listCancellations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTransactions(
      user,
      line,
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
  @UnderwriteLineAccess(UnderwriteAction.TIRA_RETRY)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List failed or retryable TIRA work in the line' })
  listTiraFailed(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTiraQueue(user, line, 'failed', table);
  }

  @Get('tira-pending')
  @AnyPermissions(
    'quotations:retry-tiramis',
    'endorsements:retry-tiramis',
    'cancellations:submit-tiramis',
  )
  @UnderwriteLineAccess(UnderwriteAction.TIRA_RETRY)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'List pending TIRA work in the line' })
  listTiraPending(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Query() table: TableQueryDto,
  ) {
    return this.transactions.listTiraQueue(user, line, 'pending', table);
  }

  @Get('policies/:policyId/endorsement-eligibility')
  @Permissions('endorsements:create')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Check endorsement eligibility in the line' })
  async endorsementEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Query() query: EndorsementEligibilityQueryDto,
  ) {
    await this.transactions.assertPolicyInLine(user, line, policyId);
    return this.endorsementService.getEligibility(
      user,
      policyId,
      query.effective_date,
    );
  }

  @Post('policies/:policyId/endorsements')
  @Permissions('endorsements:create')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Create an endorsement in the line' })
  async createEndorsement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: CreateEndorsementDto,
  ) {
    await this.transactions.assertPolicyInLine(user, line, policyId);
    return this.endorsementService.create(user, policyId, dto);
  }

  @Get('endorsements/:id/context')
  @AnyPermissions('endorsements:update-draft', 'endorsements:approve')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Load an endorsement context in the line' })
  async endorsementContext(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    return this.endorsementService.getContext(user, id);
  }

  @Post('endorsements/:id/changes')
  @Permissions('endorsements:update-draft')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Record an endorsement change in the line' })
  async recordEndorsementChange(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordEndorsementChangeDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    return this.endorsementService.recordChange(user, id, dto);
  }

  @Post('endorsements/:id/recalculate')
  @Permissions('endorsements:update-draft')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Recalculate an endorsement in the line' })
  async recalculateEndorsement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    return this.endorsementService.recalculate(user, id);
  }

  @Post('endorsements/:id/complete')
  @Permissions('endorsements:complete')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Complete an endorsement in the line' })
  async completeEndorsement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    return this.endorsementService.complete(user, id);
  }

  @Post('endorsements/:id/submit-approval')
  @Permissions('endorsements:submit-approval')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Submit an endorsement for approval in the line' })
  async submitEndorsementApproval(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    await this.endorsementService.assertAccessible(user, id);
    return this.lifecycleService.submitForApproval(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('endorsements/:id/approve')
  @Permissions('endorsements:approve')
  @UnderwriteLineAccess(UnderwriteAction.APPROVE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Approve an endorsement in the line' })
  async approveEndorsement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    await this.endorsementService.assertAccessible(user, id);
    const transaction = await this.lifecycleService.approveTransaction(
      user.companyId!,
      id,
      {
        changedBy: user.id,
        isMakerCheckerExempt: canSelfApprove(user),
      },
    );

    try {
      await this.endorsementService.ensureTransactionQuotation(user, id);
    } catch (error) {
      this.logger.warn(
        `Automatic quotation creation failed for endorsement ${id} after approval: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (this.lifecycleService.canSubmit(transaction)) {
      try {
        await this.submissionService.submitEndorsement(user, id);
      } catch (error) {
        this.logger.warn(
          `Automatic TIRAMIS submission failed for endorsement ${id} after approval: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.endorsementService.findOne(user, id);
  }

  @Post('endorsements/:id/reject')
  @Permissions('endorsements:approve')
  @UnderwriteLineAccess(UnderwriteAction.APPROVE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Reject an endorsement approval in the line' })
  async rejectEndorsement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    await this.endorsementService.assertAccessible(user, id);
    return this.lifecycleService.rejectApproval(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('endorsements/:id/request-changes')
  @Permissions('endorsements:approve')
  @UnderwriteLineAccess(UnderwriteAction.APPROVE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Request endorsement changes in the line' })
  async requestEndorsementChanges(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    await this.endorsementService.assertAccessible(user, id);
    return this.lifecycleService.requestChanges(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('endorsements/:id/request-payment')
  @Permissions('endorsements:request-payment')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Request endorsement payment in the line' })
  async requestEndorsementPayment(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    return this.endorsementService.requestPayment(user, id);
  }

  @Post('endorsements/:id/submit-tiramis')
  @Permissions('endorsements:submit-tiramis')
  @UnderwriteLineAccess(UnderwriteAction.TIRA_RETRY)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Submit an endorsement to TIRAMIS in the line' })
  async submitEndorsementTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    await this.endorsementService.assertAccessible(user, id);
    return this.submissionService.submitEndorsement(user, id);
  }

  @Post('endorsements/:id/retry-tiramis')
  @AnyPermissions('endorsements:retry-tiramis', 'endorsements:reconcile')
  @UnderwriteLineAccess(UnderwriteAction.TIRA_RETRY)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Retry endorsement TIRAMIS in the line' })
  async retryEndorsementTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    await this.endorsementService.assertAccessible(user, id);
    return this.submissionService.submitEndorsement(user, id);
  }

  @Post('endorsements/:id/cancel')
  @Permissions('endorsements:cancel')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Cancel an endorsement in the line' })
  async cancelEndorsement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
    return this.endorsementService.cancel(user, id, dto.reason);
  }

  @Get('policies/:policyId/cancellation-eligibility')
  @Permissions('cancellations:create')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Check cancellation eligibility in the line' })
  async cancellationEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Query() query: EndorsementEligibilityQueryDto,
  ) {
    await this.transactions.assertPolicyInLine(user, line, policyId);
    return this.cancellationService.getEligibility(
      user,
      policyId,
      query.effective_date,
    );
  }

  @Post('policies/:policyId/cancellations')
  @Permissions('cancellations:create')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Create a cancellation in the line' })
  async createCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: CreateCancellationDto,
  ) {
    await this.transactions.assertPolicyInLine(user, line, policyId);
    return this.cancellationService.create(user, policyId, dto);
  }

  @Get('cancellations/:id/context')
  @AnyPermissions('cancellations:read', 'cancellations:approve')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Load a cancellation context in the line' })
  async cancellationContext(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    return this.cancellationService.findContext(user, id);
  }

  @Post('cancellations/:id/complete')
  @Permissions('cancellations:complete')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Complete a cancellation in the line' })
  async completeCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    return this.completeAndAdvanceCancellation(user, id);
  }

  @Post('cancellations/:id/submit-approval')
  @Permissions('cancellations:complete')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Submit a cancellation for approval in the line' })
  async submitCancellationApproval(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    return this.lifecycleService.submitForApproval(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('cancellations/:id/approve')
  @Permissions('cancellations:approve')
  @UnderwriteLineAccess(UnderwriteAction.APPROVE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Approve a cancellation in the line' })
  async approveCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    const transaction = await this.lifecycleService.approveTransaction(
      user.companyId!,
      id,
      {
        changedBy: user.id,
        isMakerCheckerExempt: canSelfApprove(user),
      },
    );

    await this.tryAutoIssueCancellation(user, transaction, 'after approval');
    return this.cancellationService.findOne(user, id);
  }

  @Post('cancellations/:id/reject')
  @Permissions('cancellations:approve')
  @UnderwriteLineAccess(UnderwriteAction.APPROVE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Reject a cancellation approval in the line' })
  async rejectCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    return this.lifecycleService.rejectApproval(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('cancellations/:id/request-changes')
  @Permissions('cancellations:approve')
  @UnderwriteLineAccess(UnderwriteAction.APPROVE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Request cancellation changes in the line' })
  async requestCancellationChanges(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    return this.lifecycleService.requestChanges(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('cancellations/:id/request-payment')
  @Permissions('cancellations:request-payment')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Request cancellation payment in the line' })
  async requestCancellationPayment(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    return this.cancellationService.requestPayment(user, id);
  }

  @Post('cancellations/:id/submit-tiramis')
  @Permissions('cancellations:submit-tiramis')
  @UnderwriteLineAccess(UnderwriteAction.TIRA_RETRY)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Submit a cancellation to TIRAMIS in the line' })
  async submitCancellationTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    return this.submissionService.submitCancellation(user, id);
  }

  @Post('cancellations/:id/cancel')
  @Permissions('cancellations:cancel')
  @UnderwriteLineAccess(UnderwriteAction.CANCELLATIONS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Withdraw a cancellation in the line' })
  async cancelCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'cancellation',
    );
    await this.cancellationService.assertAccessible(user, id);
    return this.lifecycleService.cancelTransaction(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Get('policies/:policyId/renewal-eligibility')
  @Permissions('renewals:create')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Check renewal eligibility in the line' })
  async renewalEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    await this.transactions.assertPolicyInLine(user, line, policyId);
    return this.renewalService.getEligibility(user, policyId);
  }

  @Post('policies/:policyId/renewals')
  @Permissions('renewals:create')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Create a renewal offer in the line' })
  async createRenewal(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    await this.transactions.assertPolicyInLine(user, line, policyId);
    return this.renewalService.createEligibleRenewalForPolicy(
      user.companyId!,
      policyId,
      user.id,
    );
  }

  @Get('renewals/:id/context')
  @Permissions('renewals:read')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_VIEW)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Load a renewal context in the line' })
  async renewalContext(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertRenewalInLine(user, line, id);
    return this.renewalService.findContext(user.companyId!, id);
  }

  @Post('renewals/:id/create-offer')
  @Permissions('renewals:create-offer')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Create a renewal quotation in the line' })
  async createRenewalOffer(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertRenewalInLine(user, line, id);
    return this.renewalService.createRenewalOffer(user, id);
  }

  @Post('renewals/:id/link-quotation')
  @Permissions('renewals:create-offer')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Link a renewal quotation in the line' })
  async linkRenewalQuotation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkRenewalQuotationDto,
  ) {
    await this.transactions.assertRenewalInLine(user, line, id);
    await this.transactions.assertQuotationInLine(user, line, dto.quotation_id);
    return this.renewalService.linkQuotation(user, id, dto.quotation_id);
  }

  @Post('renewals/:id/send-offer')
  @Permissions('renewals:send-offer')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Send a renewal offer in the line' })
  async sendRenewalOffer(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertRenewalInLine(user, line, id);
    return this.renewalService.sendOffer(user, id);
  }

  @Post('renewals/:id/accept')
  @Permissions('renewals:accept')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Accept a renewal offer in the line' })
  async acceptRenewal(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertRenewalInLine(user, line, id);
    return this.renewalService.accept(user, id);
  }

  @Post('renewals/:id/decline')
  @Permissions('renewals:decline')
  @UnderwriteLineAccess(UnderwriteAction.RENEWALS_MANAGE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Decline a renewal offer in the line' })
  async declineRenewal(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.transactions.assertRenewalInLine(user, line, id);
    return this.renewalService.decline(user, id, dto.reason);
  }

  @Post('quotations/:id/retry-tira')
  @Permissions('quotations:retry-tiramis')
  @UnderwriteLineAccess(UnderwriteAction.TIRA_RETRY)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Retry a quotation TIRAMIS submission in the line' })
  async retryQuotationTira(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transactions.assertQuotationInLine(user, line, id);
    return this.quotationsService.retryTiraSubmission(
      user.companyId!,
      id,
      user,
    );
  }

  private async completeAndAdvanceCancellation(
    user: AuthenticatedUser,
    id: string,
  ) {
    await this.cancellationService.assertAccessible(user, id);
    let transaction = await this.cancellationService.complete(user, id);

    if (
      transaction.approval_required &&
      (
        [
          WorkflowApprovalStatus.NOT_EVALUATED,
          WorkflowApprovalStatus.CHANGES_REQUESTED,
        ] as WorkflowApprovalStatusType[]
      ).includes(transaction.approval_status)
    ) {
      transaction = await this.lifecycleService.submitForApproval(
        user.companyId!,
        id,
        { changedBy: user.id },
      );
    }

    await this.tryAutoIssueCancellation(user, transaction, 'after completion');

    return this.cancellationService.findOne(user, id);
  }

  private async tryAutoIssueCancellation(
    user: AuthenticatedUser,
    transaction: PolicyTransaction,
    phase: string,
  ) {
    if (!this.lifecycleService.canSubmit(transaction)) {
      return;
    }

    try {
      await this.cancellationService.ensureTransactionQuotation(
        user,
        transaction.id,
      );
    } catch (error) {
      this.logger.warn(
        `Automatic quotation creation failed for cancellation ${transaction.id} ${phase}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    try {
      await this.submissionService.submitCancellation(user, transaction.id);
    } catch (error) {
      this.logger.warn(
        `Automatic TIRAMIS submission failed for cancellation ${transaction.id} ${phase}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
