import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CreateEndorsementDto } from '../dto/create-endorsement.dto';
import { RecordEndorsementChangeDto } from '../dto/record-endorsement-change.dto';
import { ReasonDto } from '../dto/reason.dto';
import { EndorsementService } from '../services/endorsement.service';
import { PolicyTransactionLifecycleService } from '../services/policy-transaction-lifecycle.service';
import { PolicyTransactionTiramisSubmissionService } from '../services/policy-transaction-tiramis-submission.service';

@ApiTags('endorsements')
@ApiBearerAuth()
@Controller()
@TenantScoped()
export class EndorsementsController {
  constructor(
    private readonly endorsementService: EndorsementService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly submissionService: PolicyTransactionTiramisSubmissionService,
  ) {}

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
  @Permissions('endorsements:create')
  @ApiOperation({ summary: 'List endorsements for the current company' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.endorsementService.findAll(user.companyId!);
  }

  @Get('tenant/endorsements/:id')
  @Permissions('endorsements:create')
  @ApiOperation({ summary: 'Get an endorsement by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.findOne(user.companyId!, id);
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
  @ApiOperation({ summary: 'Rebuild the proposed snapshot and re-price the endorsement' })
  recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.recalculate(user, id);
  }

  @Post('tenant/endorsements/:id/complete')
  @Permissions('endorsements:complete')
  @ApiOperation({ summary: 'Complete an endorsement, evaluating approval/payment requirements' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.complete(user, id);
  }

  @Post('tenant/endorsements/:id/submit-approval')
  @Permissions('endorsements:submit-approval')
  @ApiOperation({ summary: 'Submit a completed endorsement for approval' })
  submitApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.submitForApproval(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('tenant/endorsements/:id/approve')
  @Permissions('endorsements:approve')
  @ApiOperation({ summary: 'Approve an endorsement (maker-checker enforced)' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.approveTransaction(user.companyId!, id, {
      changedBy: user.id,
    });
  }

  @Post('tenant/endorsements/:id/reject')
  @Permissions('endorsements:approve')
  @ApiOperation({ summary: 'Reject an endorsement approval' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.lifecycleService.rejectApproval(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('tenant/endorsements/:id/request-changes')
  @Permissions('endorsements:approve')
  @ApiOperation({ summary: 'Send an endorsement back for changes' })
  requestChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.lifecycleService.requestChanges(user.companyId!, id, {
      changedBy: user.id,
      reason: dto.reason,
    });
  }

  @Post('tenant/endorsements/:id/request-payment')
  @Permissions('endorsements:request-payment')
  @ApiOperation({ summary: 'Create the additional-premium invoice and request payment' })
  requestPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.endorsementService.requestPayment(user, id);
  }

  @Post('tenant/endorsements/:id/submit-tiramis')
  @Permissions('endorsements:submit-tiramis')
  @ApiOperation({ summary: 'Submit a completed, approved, paid endorsement to TIRAMIS' })
  submitTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionService.submitEndorsement(user, id);
  }

  @Post('tenant/endorsements/:id/retry-tiramis')
  @Permissions('endorsements:retry-tiramis')
  @ApiOperation({ summary: 'Retry a rejected/failed TIRAMIS submission for an endorsement' })
  retryTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionService.submitEndorsement(user, id);
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
