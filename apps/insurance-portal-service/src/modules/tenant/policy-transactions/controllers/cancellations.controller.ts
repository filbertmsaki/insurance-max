import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  WorkflowApprovalStatus,
  type WorkflowApprovalStatus as WorkflowApprovalStatusType,
} from '@insurance-max/contracts';

import { CreateCancellationDto } from '../dto/create-cancellation.dto';
import { ClaimsReviewDto } from '../dto/claims-review.dto';
import { EndorsementEligibilityQueryDto } from '../dto/endorsement-eligibility-query.dto';
import { ReasonDto } from '../dto/reason.dto';
import { CancellationService } from '../services/cancellation.service';
import { PolicyReplacementService } from '../services/policy-replacement.service';
import { CreatePolicyReplacementDto } from '../dto/create-policy-replacement.dto';
import { PolicyTransactionLifecycleService } from '../services/policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisSubmissionService } from '../services/policy-transaction-tiramis-submission.service';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { canSelfApprove } from '../../../shared/authorization/maker-checker';

@ApiTags('cancellations')
@ApiBearerAuth()
@Controller()
@TenantScoped()
export class CancellationsController {
  private readonly logger = new Logger(CancellationsController.name);

  constructor(
    private readonly replacementService: PolicyReplacementService,
    private readonly cancellationService: CancellationService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly submissionService: PolicyTransactionTiramisSubmissionService,
  ) {}

  @Get('tenant/policies/:policyId/cancellation-eligibility')
  @Permissions('cancellations:create')
  @ApiOperation({
    summary: 'Check whether the current issued policy can be cancelled',
  })
  eligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Query() query: EndorsementEligibilityQueryDto,
  ) {
    return this.cancellationService.getEligibility(
      user,
      policyId,
      query.effective_date,
    );
  }

  @Post('tenant/policies/:policyId/cancellations')
  @Permissions('cancellations:create')
  @ApiOperation({ summary: 'Request cancellation of an active policy' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: CreateCancellationDto,
  ) {
    return this.cancellationService.create(user, policyId, dto);
  }

  @Post('tenant/policies/:policyId/replacements')
  @Permissions('cancellations:create', 'quotations:create')
  @ApiOperation({
    summary:
      'Create a replacement quotation; cancel original records only after accepted issuance',
  })
  createReplacement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: CreatePolicyReplacementDto,
  ) {
    return this.replacementService.create(user, policyId, dto);
  }

  @Get('tenant/cancellations')
  @Permissions('cancellations:read')
  @ApiOperation({ summary: 'List cancellations for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id') policyId?: string,
  ) {
    return this.cancellationService.findAll(user, policyId);
  }

  @Get('tenant/cancellations/:id')
  @Permissions('cancellations:read')
  @ApiOperation({ summary: 'Get a cancellation by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.findOne(user, id);
  }

  @Get('tenant/cancellations/:id/context')
  @Permissions('cancellations:read')
  @ApiOperation({ summary: 'Get a cancellation transaction with detail row' })
  context(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.findContext(user, id);
  }

  @Post('tenant/cancellations/:id/claims-review')
  @Permissions('cancellations:claims-review')
  @ApiOperation({
    summary:
      'Record the claims-review decision for a cancellation with open claims',
  })
  async claimsReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimsReviewDto,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:claims-review',
    );
    return this.cancellationService.completeClaimsReview(
      user,
      id,
      dto.approved,
      dto.reason,
    );
  }

  @Post('tenant/cancellations/:id/complete')
  @Permissions('cancellations:complete')
  @ApiOperation({
    summary:
      'Complete a cancellation, evaluating approval/payment requirements',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.completeAndAdvance(user, id);
  }

  // Submitting for approval is a maker action; `complete` already does it
  // automatically, so it shares the `cancellations:complete` permission.
  @Post('tenant/cancellations/:id/submit-approval')
  @Permissions('cancellations:complete')
  @ApiOperation({ summary: 'Submit a completed cancellation for approval' })
  async submitApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:complete',
    );
    return this.lifecycleService.submitForApproval(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('tenant/cancellations/:id/approve')
  @Permissions('cancellations:approve')
  @ApiOperation({ summary: 'Approve a cancellation (maker-checker enforced)' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:approve',
    );
    const transaction = await this.lifecycleService.approveTransaction(
      user.companyId!,
      id,
      {
        changedBy: user.id,
        isMakerCheckerExempt: canSelfApprove(user),
      },
    );

    // Automatic, idempotent quotation creation and TIRAMIS submission.
    await this.tryAutoIssue(user, transaction, 'after approval');

    return this.cancellationService.findOne(user, id);
  }

  @Post('tenant/cancellations/:id/reject')
  @Permissions('cancellations:approve')
  @ApiOperation({ summary: 'Reject a cancellation approval' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:approve',
    );
    return this.lifecycleService.rejectApproval(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('tenant/cancellations/:id/request-changes')
  @Permissions('cancellations:approve')
  @ApiOperation({ summary: 'Send a cancellation back for changes' })
  async requestChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:approve',
    );
    return this.lifecycleService.requestChanges(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('tenant/cancellations/:id/request-payment')
  @Permissions('cancellations:request-payment')
  @ApiOperation({
    summary: 'Create the cancellation-charge invoice and request payment',
  })
  async requestPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:request-payment',
    );
    return this.cancellationService.requestPayment(user, id);
  }

  @Post('tenant/cancellations/:id/submit-tiramis')
  @Permissions('cancellations:submit-tiramis')
  @ApiOperation({
    summary:
      'Submit a completed, approved cancellation to TIRAMIS (also used to retry after a failed attempt)',
  })
  async submitTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:submit-tiramis',
    );
    return this.submissionService.submitCancellation(user, id);
  }

  @Post('tenant/cancellations/:id/cancel')
  @Permissions('cancellations:cancel')
  @ApiOperation({ summary: 'Withdraw a draft cancellation request' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:cancel',
    );
    return this.lifecycleService.cancelTransaction(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  private async completeAndAdvance(user: AuthenticatedUser, id: string) {
    await this.cancellationService.assertAccessible(
      user,
      id,
      'cancellations:complete',
    );
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

    await this.tryAutoIssue(user, transaction, 'after completion');

    return this.cancellationService.findOne(user, id);
  }

  private async tryAutoIssue(
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
