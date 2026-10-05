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
import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CreateEndorsementDto } from '../dto/create-endorsement.dto';
import { EndorsementEligibilityQueryDto } from '../dto/endorsement-eligibility-query.dto';
import { RecordEndorsementChangeDto } from '../dto/record-endorsement-change.dto';
import { ReasonDto } from '../dto/reason.dto';
import { EndorsementService } from '../services/endorsement.service';
import { EndorsementReconciliationService } from '../services/endorsement-reconciliation.service';
import { PolicyTransactionLifecycleService } from '../services/policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisSubmissionService } from '../services/policy-transaction-tiramis-submission.service';
import { canSelfApprove } from '../../../shared/authorization/maker-checker';

@ApiTags('endorsements')
@ApiBearerAuth()
@Controller()
@TenantScoped()
export class EndorsementsController {
  private readonly logger = new Logger(EndorsementsController.name);

  constructor(
    private readonly endorsementService: EndorsementService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly submissionService: PolicyTransactionTiramisSubmissionService,
    private readonly reconciliationService: EndorsementReconciliationService,
  ) {}

  @Get('tenant/policies/:policyId/endorsement-eligibility')
  @Permissions('policy-transactions:read')
  @ApiOperation({
    summary: 'Check whether the current issued policy can be endorsed',
  })
  eligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Query() query: EndorsementEligibilityQueryDto,
  ) {
    return this.endorsementService.getEligibility(
      user,
      policyId,
      query.effective_date,
    );
  }

  @Post('tenant/policies/:policyId/endorsements')
  @Permissions('endorsements:create')
  @ApiOperation({ summary: 'Create an endorsement on an active policy' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: CreateEndorsementDto,
  ) {
    return this.endorsementService.create(user, policyId, dto);
  }

  @Get('tenant/endorsements')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'List endorsements for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id') policyId?: string,
  ) {
    return this.endorsementService.findAll(user, policyId);
  }

  @Get('tenant/endorsements/:id/context')
  @Permissions('endorsements:update-draft')
  @ApiOperation({
    summary:
      'Load the endorsement draft, current source snapshot and recorded changes',
  })
  context(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.getContext(user, id);
  }

  @Get('tenant/endorsements/:id')
  @Permissions('policy-transactions:read')
  @ApiOperation({ summary: 'Get an endorsement by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.findOne(user, id);
  }

  @Post('tenant/endorsements/:id/changes')
  @Permissions('endorsements:update-draft')
  @ApiOperation({ summary: 'Record a change on a draft endorsement' })
  recordChange(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordEndorsementChangeDto,
  ) {
    return this.endorsementService.recordChange(user, id, dto);
  }

  @Post('tenant/endorsements/:id/recalculate')
  @Permissions('endorsements:update-draft')
  @ApiOperation({
    summary: 'Rebuild the proposed snapshot and re-price the endorsement',
  })
  recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.recalculate(user, id);
  }

  @Post('tenant/endorsements/:id/complete')
  @Permissions('endorsements:complete')
  @ApiOperation({
    summary:
      'Complete an endorsement, evaluating approval/payment requirements',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.complete(user, id);
  }

  @Post('tenant/endorsements/:id/submit-approval')
  @Permissions('endorsements:submit-approval')
  @ApiOperation({ summary: 'Submit a completed endorsement for approval' })
  async submitApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:submit-approval',
    );
    return this.lifecycleService.submitForApproval(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('tenant/endorsements/:id/approve')
  @Permissions('endorsements:approve')
  @ApiOperation({ summary: 'Approve an endorsement (maker-checker enforced)' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:approve',
    );
    const transaction = await this.lifecycleService.approveTransaction(
      user.companyId!,
      id,
      {
        changedBy: user.id,
        isMakerCheckerExempt: canSelfApprove(user),
      },
    );

    // Per the endorsement workflow spec, the background TIRAMIS submission
    // quotation is created automatically once (and only once) the
    // endorsement is approved — never at draft-creation time. This is
    // idempotent: re-approval after a CHANGES_REQUESTED cycle will not
    // create a second quotation.
    try {
      await this.endorsementService.ensureTransactionQuotation(user, id);
    } catch (error) {
      this.logger.warn(
        `Automatic quotation creation failed for endorsement ${id} after approval: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Per the endorsement workflow spec, TIRAMIS submission must happen
    // automatically once a transaction is approved — the user should never
    // have to manually trigger it for the happy path. This is best-effort:
    // if approval satisfies all requirements (payment, if required, is
    // already settled) the transaction is immediately submittable, so we
    // submit it here rather than requiring a separate UI action. A failure
    // here must NOT fail the approval response or the approval itself —
    // `submitEndorsement`/`markSubmissionFailed` already leave the
    // transaction in a retryable state, and `submit-tiramis`/`retry-tiramis`
    // remain available for the user (or a background reconciler) to retry.
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

  @Post('tenant/endorsements/:id/reject')
  @Permissions('endorsements:approve')
  @ApiOperation({ summary: 'Reject an endorsement approval' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:approve',
    );
    return this.lifecycleService.rejectApproval(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('tenant/endorsements/:id/request-changes')
  @Permissions('endorsements:approve')
  @ApiOperation({ summary: 'Send an endorsement back for changes' })
  async requestChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:approve',
    );
    return this.lifecycleService.requestChanges(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('tenant/endorsements/:id/request-payment')
  @Permissions('endorsements:request-payment')
  @ApiOperation({
    summary: 'Create the additional-premium invoice and request payment',
  })
  requestPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.requestPayment(user, id);
  }

  @Post('tenant/endorsements/:id/submit-tiramis')
  @Permissions('endorsements:submit-tiramis')
  @ApiOperation({
    summary: 'Submit a completed, approved, paid endorsement to TIRAMIS',
  })
  async submitTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:submit-tiramis',
    );
    return this.submissionService.submitEndorsement(user, id);
  }

  @Post('tenant/endorsements/:id/retry-tiramis')
  @AnyPermissions('endorsements:retry-tiramis', 'endorsements:reconcile')
  @ApiOperation({
    summary: 'Retry a rejected/failed TIRAMIS submission for an endorsement',
  })
  async retryTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:retry-tiramis',
    );
    return this.submissionService.submitEndorsement(user, id);
  }

  @Get('tenant/endorsements/:id/reconciliation')
  @Permissions('endorsements:reconcile')
  @ApiOperation({ summary: 'Inspect endorsement issuance consistency' })
  async reconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:reconcile',
    );
    return this.reconciliationService.inspect(user.companyId!, id);
  }

  @Post('tenant/endorsements/:id/reconcile')
  @Permissions('endorsements:reconcile')
  @ApiOperation({
    summary: 'Repair safe post-issuance endorsement inconsistencies',
  })
  async reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.endorsementService.assertAccessible(
      user,
      id,
      'endorsements:reconcile',
    );
    return this.reconciliationService.reconcile(user.companyId!, id);
  }

  @Post('tenant/endorsements/:id/cancel')
  @Permissions('endorsements:cancel')
  @ApiOperation({ summary: 'Cancel a draft endorsement' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.endorsementService.cancel(user, id, dto.reason);
  }
}
