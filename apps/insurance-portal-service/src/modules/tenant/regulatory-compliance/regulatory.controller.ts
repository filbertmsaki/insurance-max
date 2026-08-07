import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { RegulatoryPermissions } from './regulatory.permissions';
import { PremiumLevyReturnService } from './services/premium-levy-return.service';
import { RegulatoryCalendarService } from './services/regulatory-calendar.service';

@Controller('tenant/regulatory')
@TenantScoped()
export class RegulatoryController {
  constructor(
    private readonly calendarService: RegulatoryCalendarService,
    private readonly levyService: PremiumLevyReturnService,
  ) {}

  @Get('profile')
  @Permissions(RegulatoryPermissions.PROFILE_READ)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.getProfile(user.companyId!);
  }

  @Patch('profile')
  @Permissions(RegulatoryPermissions.PROFILE_UPDATE)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.calendarService.updateProfile(user.companyId!, dto, user.id);
  }

  @Get('calendar')
  @Permissions(RegulatoryPermissions.CALENDAR_READ)
  listCalendar(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listCalendar(user.companyId!);
  }

  @Get('authorities')
  @Permissions(RegulatoryPermissions.PROFILE_READ)
  listAuthorities(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listAuthorities(user.companyId!);
  }

  @Get('obligation-definitions')
  @Permissions(RegulatoryPermissions.CALENDAR_READ)
  listDefinitions(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listDefinitions(user.companyId!);
  }

  @Get('obligations')
  @Permissions(RegulatoryPermissions.CALENDAR_READ)
  listObligations(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listCalendar(user.companyId!);
  }

  @Get('obligations/:id')
  @Permissions(RegulatoryPermissions.CALENDAR_READ)
  getObligation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.getObligation(user.companyId!, id);
  }

  @Post('calendar/generate/:year')
  @Permissions(RegulatoryPermissions.CALENDAR_MANAGE)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.calendarService.generateForCompany(user.companyId!, year);
  }

  @Get('returns')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  listReturns(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listReturns(user.companyId!);
  }

  @Get('returns/:id')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  getReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.getReturn(user.companyId!, id);
  }

  @Get('returns/:id/versions')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  async getReturnVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const record = await this.calendarService.getReturn(user.companyId!, id);
    return record.versions;
  }

  @Get('returns/:id/validation')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  async getReturnValidation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const record = await this.calendarService.getReturn(user.companyId!, id);
    return record.validation_results ?? null;
  }

  @Get('returns/:id/reconciliation')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  async getReturnReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const record = await this.calendarService.getReturn(user.companyId!, id);
    return record.reconciliation_summary ?? null;
  }

  @Post('obligations/:id/assign')
  @Permissions(RegulatoryPermissions.CALENDAR_MANAGE)
  assignObligation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: { assigned_user_id?: string | null; assigned_role_id?: string | null },
  ) {
    return this.calendarService.assignObligation(user.companyId!, id, dto);
  }

  @Post('obligations/:id/waive')
  @Permissions(RegulatoryPermissions.CALENDAR_MANAGE)
  waiveObligation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
  ) {
    return this.calendarService.waiveObligation(
      user.companyId!,
      id,
      user.id,
      dto.reason,
    );
  }

  @Post('obligations/:id/mark-not-applicable')
  @Permissions(RegulatoryPermissions.CALENDAR_MANAGE)
  markNotApplicable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
  ) {
    return this.calendarService.markNotApplicable(
      user.companyId!,
      id,
      user.id,
      dto.reason,
    );
  }

  @Post('returns/:id/validate')
  @Permissions(RegulatoryPermissions.RETURN_PREPARE)
  validateReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.validateReturn(user.companyId!, id, user.id);
  }

  @Post('returns/:id/reconcile')
  @Permissions(RegulatoryPermissions.RETURN_PREPARE)
  reconcileReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.reconcileReturn(user.companyId!, id, user.id);
  }

  @Post('returns/:id/submit-review')
  @Permissions(RegulatoryPermissions.RETURN_SUBMIT_FOR_APPROVAL)
  submitReturnForReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.submitForReview(user.companyId!, id, user.id);
  }

  @Post('returns/:id/approve')
  @Permissions(RegulatoryPermissions.RETURN_APPROVE)
  approveReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.approveReturn(user.companyId!, id, user.id);
  }

  @Post('returns/:id/create-correction')
  @Permissions(RegulatoryPermissions.RETURN_PREPARE)
  createCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.createCorrection(user.companyId!, id, user.id);
  }

  @Post('returns/:id/record-submission')
  @Permissions(RegulatoryPermissions.RETURN_MARK_SUBMITTED)
  recordSubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      submission_channel: string;
      submission_reference?: string;
      evidence_document_id?: string;
      acknowledgement_reference?: string;
      acknowledgement_code?: string;
      acknowledgement_message?: string;
      acknowledged_at?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.calendarService.recordSubmission(
      user.companyId!,
      id,
      user.id,
      dto,
    );
  }

  @Post('returns/:id/record-acknowledgement')
  @Permissions(RegulatoryPermissions.RETURN_MARK_SUBMITTED)
  recordAcknowledgement(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      submission_id: string;
      acknowledgement_reference?: string;
      acknowledgement_code?: string;
      acknowledgement_message?: string;
    },
  ) {
    return this.calendarService.acknowledgeSubmission(
      user.companyId!,
      dto.submission_id,
      dto,
    );
  }

  @Post('returns/:id/premium-levy/calculate')
  @Permissions(RegulatoryPermissions.LEVY_CALCULATE)
  calculateLevy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { levy_rate?: string | number },
  ) {
    return this.levyService.calculate(user, id, dto);
  }

  @Get('levy-assessments')
  @Permissions(RegulatoryPermissions.LEVY_READ)
  listLevyAssessments(@CurrentUser() user: AuthenticatedUser) {
    return this.levyService.listAssessments(user.companyId!);
  }

  @Get('levy-assessments/:id')
  @Permissions(RegulatoryPermissions.LEVY_READ)
  getLevyAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.levyService.getAssessment(user.companyId!, id);
  }

  @Post('levy-assessments/:id/submit-approval')
  @Permissions(RegulatoryPermissions.LEVY_CONFIRM)
  submitLevyForApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.levyService.submitForApproval(user, id);
  }

  @Post('levy-assessments/:id/approve')
  @Permissions(RegulatoryPermissions.LEVY_CONFIRM)
  approveLevyAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.levyService.approveAssessment(user, id);
  }

  @Post('levy-assessments/:id/request-payment')
  @Permissions(RegulatoryPermissions.LEVY_CONFIRM)
  requestLevyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.levyService.requestPayment(user.companyId!, id);
  }

  @Post('levy-assessments/:id/reconcile')
  @Permissions(RegulatoryPermissions.LEVY_CONFIRM)
  reconcileLevyAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.levyService.reconcileAssessment(user.companyId!, id);
  }

  @Post('premium-levy/:id/adjustments')
  @Permissions(RegulatoryPermissions.LEVY_ADJUST)
  addLevyAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      amount: string | number;
      description: string;
      evidence_reference?: string;
    },
  ) {
    return this.levyService.addAdjustment(user, id, dto);
  }
}
