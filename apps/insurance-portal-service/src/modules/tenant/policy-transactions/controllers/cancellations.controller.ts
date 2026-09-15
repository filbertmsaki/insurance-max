import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import {
  TenantScoped,
  hasCompanyAdminRole,
} from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CreateCancellationDto } from '../dto/create-cancellation.dto';
import { ClaimsReviewDto } from '../dto/claims-review.dto';
import { EndorsementEligibilityQueryDto } from '../dto/endorsement-eligibility-query.dto';
import { ReasonDto } from '../dto/reason.dto';
import { CancellationService } from '../services/cancellation.service';
import { PolicyReplacementService } from '../services/policy-replacement.service';
import { CreatePolicyReplacementDto } from '../dto/create-policy-replacement.dto';
import { PolicyTransactionLifecycleService } from '../services/policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisSubmissionService } from '../services/policy-transaction-tiramis-submission.service';

@ApiTags('cancellations')
@ApiBearerAuth()
@Controller()
@TenantScoped()
export class CancellationsController {
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
    return this.cancellationService.findAll(user.companyId!, policyId);
  }

  @Get('tenant/cancellations/:id')
  @Permissions('cancellations:read')
  @ApiOperation({ summary: 'Get a cancellation by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.findOne(user.companyId!, id);
  }

  @Get('tenant/cancellations/:id/context')
  @Permissions('cancellations:read')
  @ApiOperation({ summary: 'Get a cancellation transaction with detail row' })
  context(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.findContext(user.companyId!, id);
  }

  @Post('tenant/cancellations/:id/claims-review')
  @Permissions('cancellations:claims-review')
  @ApiOperation({
    summary:
      'Record the claims-review decision for a cancellation with open claims',
  })
  claimsReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimsReviewDto,
  ) {
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
    return this.cancellationService.complete(user, id);
  }

  @Post('tenant/cancellations/:id/submit-approval')
  @Permissions('cancellations:approve')
  @ApiOperation({ summary: 'Submit a completed cancellation for approval' })
  submitApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.submitForApproval(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('tenant/cancellations/:id/approve')
  @Permissions('cancellations:approve')
  @ApiOperation({ summary: 'Approve a cancellation (maker-checker enforced)' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.approveTransaction(user.companyId!, id, {
      changedBy: user.id,
      isMakerCheckerExempt: hasCompanyAdminRole(user),
    });
  }

  @Post('tenant/cancellations/:id/request-payment')
  @Permissions('cancellations:request-payment')
  @ApiOperation({
    summary: 'Create the cancellation-charge invoice and request payment',
  })
  requestPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.requestPayment(user, id);
  }

  @Post('tenant/cancellations/:id/submit-tiramis')
  @Permissions('cancellations:submit-tiramis')
  @ApiOperation({
    summary:
      'Submit a completed, approved cancellation to TIRAMIS (also used to retry after a failed attempt)',
  })
  submitTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionService.submitCancellation(user, id);
  }

  @Post('tenant/cancellations/:id/cancel')
  @Permissions('cancellations:cancel')
  @ApiOperation({ summary: 'Withdraw a draft cancellation request' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.lifecycleService.cancelTransaction(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }
}
