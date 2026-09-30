import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { ClaimsPermissions } from './claims.permissions';
import { ClaimsService } from './claims.service';
import {
  CreateClaimDto,
  CreateClaimantDto,
  UpdateClaimDto,
  UpdateClaimantDto,
} from './dto/create-claim.dto';
import {
  FindClaimsQueryDto,
  PolicyLookupQueryDto,
} from './dto/find-claims-query.dto';
import {
  AddClaimDocumentDto,
  AdjustDischargeVoucherDto,
  ApprovalActionDto,
  ApprovalDeclineDto,
  AssignClaimDto,
  ClaimDocumentUploadSessionDto,
  CloseClaimDto,
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimPaymentDto,
  CreateClaimRejectionDto,
  CreateClaimReserveDto,
  CreateDischargeVoucherDto,
  CreateServiceAssignmentDto,
  LinkClaimDocumentDto,
  ReleaseReserveDto,
  ReopenClaimDto,
  RespondToDischargeDto,
  TiramisSubmitOptionsDto,
  UpdateClaimAssessmentDto,
  UpdateClaimIntimationDto,
  VerifyClaimDocumentDto,
} from './dto/claim-workflow.dto';
import {
  ClaimDocumentsQueryDto,
  ClaimsDashboardQueryDto,
  SaveClaimApprovalLimitDto,
  SaveClaimDocumentRequirementDto,
} from './dto/claim-configuration.dto';
import {
  ConfirmDisbursementDto,
  FailDisbursementDto,
  RequestDisbursementDto,
} from './dto/claim-disbursement.dto';
import {
  ClaimDecisionActionDto,
  CreateClaimDecisionDto,
} from './dto/claim-decision.dto';
import {
  CreateClaimRecoveryDto,
  RecordRecoveryReceiptDto,
  WriteOffRecoveryDto,
} from './dto/claim-recovery.dto';
import { ClaimApprovalService } from './services/claim-approval.service';
import { ClaimAssessmentService } from './services/claim-assessment.service';
import { ClaimDecisionService } from './services/claim-decision.service';
import { ClaimDischargeService } from './services/claim-discharge.service';
import { ClaimDisbursementService } from './services/claim-disbursement.service';
import { ClaimDocumentService } from './services/claim-document.service';
import { ClaimIntimationService } from './services/claim-intimation.service';
import { ClaimPaymentService } from './services/claim-payment.service';
import { ClaimRecoveryService } from './services/claim-recovery.service';
import { ClaimRejectionService } from './services/claim-rejection.service';
import { ClaimsDashboardService } from './services/claims-dashboard.service';

/**
 * One claim case with its lifecycle stages as sub-resources
 * (docs/claims-module-design.md §7). Static routes are declared before
 * `:id` so they are never captured by it.
 */
@Controller('tenant/claims')
@TenantScoped()
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
    private readonly intimationService: ClaimIntimationService,
    private readonly assessmentService: ClaimAssessmentService,
    private readonly dischargeService: ClaimDischargeService,
    private readonly paymentService: ClaimPaymentService,
    private readonly rejectionService: ClaimRejectionService,
    private readonly documentService: ClaimDocumentService,
    private readonly approvalService: ClaimApprovalService,
    private readonly dashboardService: ClaimsDashboardService,
    private readonly claimDecisionService: ClaimDecisionService,
    private readonly claimDisbursementService: ClaimDisbursementService,
    private readonly claimRecoveryService: ClaimRecoveryService,
  ) {}

  // ----------------------------------------------------------- static

  @Get('policy-lookup')
  @Permissions(ClaimsPermissions.CREATE)
  policyLookup(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PolicyLookupQueryDto,
  ) {
    return this.claimsService.policyLookup(user, query);
  }

  @Get('policy-lookup/:policyId')
  @Permissions(ClaimsPermissions.CREATE)
  policyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.claimsService.policyDetail(user, policyId);
  }

  @Get('dashboard/summary')
  @AnyPermissions(ClaimsPermissions.DASHBOARD, ClaimsPermissions.READ)
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClaimsDashboardQueryDto,
  ) {
    return this.dashboardService.summary(user, query);
  }

  @Get('documents')
  @AnyPermissions(
    ClaimsPermissions.DOCUMENT_UPLOAD,
    ClaimsPermissions.DOCUMENT_VERIFY,
  )
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClaimDocumentsQueryDto,
  ) {
    return this.documentService.listForCompany(user, query);
  }

  @Get('configuration/approval-limits')
  @Permissions(ClaimsPermissions.CONFIGURATION_MANAGE)
  listApprovalLimits(@CurrentUser() user: AuthenticatedUser) {
    return this.approvalService.listLimits(user.companyId!);
  }

  @Put('configuration/approval-limits')
  @Permissions(ClaimsPermissions.CONFIGURATION_MANAGE)
  saveApprovalLimit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveClaimApprovalLimitDto,
  ) {
    return this.approvalService.saveLimit(user, dto);
  }

  @Delete('configuration/approval-limits/:limitId')
  @Permissions(ClaimsPermissions.CONFIGURATION_MANAGE)
  deactivateApprovalLimit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('limitId', ParseUUIDPipe) limitId: string,
  ) {
    return this.approvalService.deactivateLimit(user, limitId);
  }

  @Get('configuration/document-requirements')
  @AnyPermissions(
    ClaimsPermissions.CONFIGURATION_MANAGE,
    ClaimsPermissions.READ,
  )
  listDocumentRequirements(@CurrentUser() user: AuthenticatedUser) {
    return this.documentService.listRequirements(user.companyId!);
  }

  @Put('configuration/document-requirements')
  @Permissions(ClaimsPermissions.CONFIGURATION_MANAGE)
  saveDocumentRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveClaimDocumentRequirementDto,
  ) {
    return this.documentService.saveRequirement(user, dto);
  }

  @Delete('configuration/document-requirements/:requirementId')
  @Permissions(ClaimsPermissions.CONFIGURATION_MANAGE)
  deactivateDocumentRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    return this.documentService.deactivateRequirement(user, requirementId);
  }

  // ----------------------------------------------------------- claim

  @Post()
  @Permissions(ClaimsPermissions.CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClaimDto) {
    return this.claimsService.create(user, dto);
  }

  @Get()
  @Permissions(ClaimsPermissions.READ)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindClaimsQueryDto,
  ) {
    return this.claimsService.findAll(user, query);
  }

  @Get(':id')
  @Permissions(ClaimsPermissions.READ)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions(ClaimsPermissions.UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.claimsService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions(ClaimsPermissions.DELETE_DRAFT)
  removeDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.removeDraft(user, id);
  }

  @Get(':id/timeline')
  @Permissions(ClaimsPermissions.READ)
  timeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.timeline(user, id);
  }

  @Get(':id/tira-transactions')
  @Permissions(ClaimsPermissions.READ)
  tiraTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.tiraTransactions(user, id);
  }

  @Get(':id/approvals')
  @Permissions(ClaimsPermissions.READ)
  async approvals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const claim = await this.claimsService.findOne(user, id);
    return this.approvalService.listForClaim(user.companyId!, claim.id);
  }

  @Post(':id/assign')
  @Permissions(ClaimsPermissions.ASSIGN)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignClaimDto,
  ) {
    return this.claimsService.assignClaim(user, id, dto);
  }

  @Post(':id/close')
  @Permissions(ClaimsPermissions.CLOSE)
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseClaimDto,
  ) {
    return this.claimsService.closeClaim(user, id, dto);
  }

  @Post(':id/reopen')
  @Permissions(ClaimsPermissions.REOPEN)
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenClaimDto,
  ) {
    return this.claimsService.reopenClaim(user, id, dto);
  }

  // ----------------------------------------------------------- claimants

  @Post(':id/claimants')
  @AnyPermissions(ClaimsPermissions.INTIMATION_CREATE, ClaimsPermissions.UPDATE)
  addClaimant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimantDto,
  ) {
    return this.claimsService.addClaimant(user, id, dto);
  }

  @Patch('claimants/:claimantId')
  @AnyPermissions(ClaimsPermissions.INTIMATION_CREATE, ClaimsPermissions.UPDATE)
  updateClaimant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimantId', ParseUUIDPipe) claimantId: string,
    @Body() dto: UpdateClaimantDto,
  ) {
    return this.claimsService.updateClaimant(user, claimantId, dto);
  }

  @Delete('claimants/:claimantId')
  @AnyPermissions(ClaimsPermissions.INTIMATION_CREATE, ClaimsPermissions.UPDATE)
  removeClaimant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimantId', ParseUUIDPipe) claimantId: string,
  ) {
    return this.claimsService.removeClaimant(user, claimantId);
  }

  // ----------------------------------------------------------- documents

  @Get(':id/documents')
  @Permissions(ClaimsPermissions.READ)
  claimDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentService.listForClaim(user, id);
  }

  @Post(':id/documents/upload-session')
  @Permissions(ClaimsPermissions.DOCUMENT_UPLOAD)
  documentUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimDocumentUploadSessionDto,
  ) {
    return this.documentService.createUploadSession(user, id, dto);
  }

  @Post(':id/documents/link')
  @Permissions(ClaimsPermissions.DOCUMENT_UPLOAD)
  linkDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkClaimDocumentDto,
  ) {
    return this.documentService.link(user, id, dto);
  }

  @Post(':id/documents')
  @Permissions(ClaimsPermissions.DOCUMENT_UPLOAD)
  registerDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClaimDocumentDto,
  ) {
    return this.documentService.register(user, id, dto);
  }

  @Post('documents/:documentId/verify')
  @Permissions(ClaimsPermissions.DOCUMENT_VERIFY)
  verifyDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: VerifyClaimDocumentDto,
  ) {
    return this.documentService.verify(user, documentId, dto);
  }

  // ----------------------------------------------------------- notification

  @Post(':id/notification/submit')
  @AnyPermissions(
    ClaimsPermissions.NOTIFICATION_SUBMIT,
    ClaimsPermissions.TIRAMIS_SUBMIT,
  )
  submitNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TiramisSubmitOptionsDto,
  ) {
    return this.claimsService.submitNotification(user, id, dto);
  }

  @Post(':id/notification/retry')
  @AnyPermissions(
    ClaimsPermissions.TIRAMIS_RETRY,
    ClaimsPermissions.NOTIFICATION_SUBMIT,
  )
  retryNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitNotification(user, id, { retry: true });
  }

  // ----------------------------------------------------------- intimation & reserves

  @Post(':id/intimations')
  @AnyPermissions(ClaimsPermissions.INTIMATION_CREATE, ClaimsPermissions.UPDATE)
  createIntimation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimIntimationDto,
  ) {
    return this.intimationService.createIntimation(user, id, dto);
  }

  @Patch('intimations/:intimationId')
  @AnyPermissions(ClaimsPermissions.INTIMATION_CREATE, ClaimsPermissions.UPDATE)
  updateIntimation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intimationId', ParseUUIDPipe) intimationId: string,
    @Body() dto: UpdateClaimIntimationDto,
  ) {
    return this.intimationService.updateIntimation(user, intimationId, dto);
  }

  @Post('intimations/:intimationId/submit')
  @AnyPermissions(
    ClaimsPermissions.INTIMATION_SUBMIT,
    ClaimsPermissions.TIRAMIS_SUBMIT,
  )
  submitIntimation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intimationId', ParseUUIDPipe) intimationId: string,
    @Body() dto: TiramisSubmitOptionsDto,
  ) {
    return this.intimationService.submitIntimation(user, intimationId, dto);
  }

  @Post(':id/reserves')
  @Permissions(ClaimsPermissions.RESERVE_CREATE)
  createReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimReserveDto,
  ) {
    return this.intimationService.createReserve(user, id, dto);
  }

  @Post('reserves/:reserveId/approve')
  @Permissions(ClaimsPermissions.RESERVE_APPROVE)
  approveReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reserveId', ParseUUIDPipe) reserveId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.intimationService.approveReserve(user, reserveId, dto.comments);
  }

  @Post('reserves/:reserveId/decline')
  @Permissions(ClaimsPermissions.RESERVE_APPROVE)
  declineReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reserveId', ParseUUIDPipe) reserveId: string,
    @Body() dto: ApprovalDeclineDto,
  ) {
    return this.intimationService.declineReserve(user, reserveId, dto.comments);
  }

  @Post('reserves/:reserveId/release')
  @Permissions(ClaimsPermissions.RESERVE_RELEASE)
  releaseReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reserveId', ParseUUIDPipe) reserveId: string,
    @Body() dto: ReleaseReserveDto,
  ) {
    return this.intimationService.releaseReserve(user, reserveId, dto.reason);
  }

  @Post(':id/service-assignments')
  @Permissions(ClaimsPermissions.ASSIGN)
  createServiceAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceAssignmentDto,
  ) {
    return this.intimationService.createServiceAssignment(user, id, dto);
  }

  // ----------------------------------------------------------- assessment

  @Post(':id/assessments')
  @Permissions(ClaimsPermissions.ASSESSMENT_CREATE)
  createAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimAssessmentDto,
  ) {
    return this.assessmentService.createAssessment(user, id, dto);
  }

  @Patch('assessments/:assessmentId')
  @AnyPermissions(
    ClaimsPermissions.ASSESSMENT_UPDATE,
    ClaimsPermissions.ASSESSMENT_CREATE,
  )
  updateAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: UpdateClaimAssessmentDto,
  ) {
    return this.assessmentService.updateAssessment(user, assessmentId, dto);
  }

  @Post('assessments/:assessmentId/submit')
  @AnyPermissions(
    ClaimsPermissions.ASSESSMENT_SUBMIT,
    ClaimsPermissions.ASSESSMENT_CREATE,
  )
  submitAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.assessmentService.submitAssessment(user, assessmentId);
  }

  @Post('assessments/:assessmentId/approve')
  @AnyPermissions(
    ClaimsPermissions.APPROVE,
    ClaimsPermissions.ASSESSMENT_APPROVE,
  )
  approveAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.assessmentService.approveAssessment(
      user,
      assessmentId,
      dto.comments,
    );
  }

  @Post('assessments/:assessmentId/decline')
  @AnyPermissions(
    ClaimsPermissions.APPROVE,
    ClaimsPermissions.ASSESSMENT_APPROVE,
  )
  declineAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: ApprovalDeclineDto,
  ) {
    return this.assessmentService.declineAssessment(
      user,
      assessmentId,
      dto.comments,
      dto.decision,
    );
  }

  @Post('assessments/:assessmentId/tiramis')
  @AnyPermissions(
    ClaimsPermissions.ASSESSMENT_SUBMIT,
    ClaimsPermissions.TIRAMIS_RETRY,
    ClaimsPermissions.TIRAMIS_SUBMIT,
  )
  submitAssessmentToTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: TiramisSubmitOptionsDto,
  ) {
    return this.assessmentService.submitAssessmentToTiramis(
      user,
      assessmentId,
      dto,
    );
  }

  // ----------------------------------------------------------- liability decisions (optional)

  @Post(':id/decisions')
  @Permissions(ClaimsPermissions.DECISION_CREATE)
  createDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimDecisionDto,
  ) {
    return this.claimDecisionService.create(user, id, dto);
  }

  @Get(':id/decisions')
  @Permissions(ClaimsPermissions.READ)
  async listDecisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const claim = await this.claimsService.findOne(user, id);
    return this.claimDecisionService.findAll(user.companyId!, claim.id);
  }

  @Post('decisions/:decisionId/submit')
  @Permissions(ClaimsPermissions.DECISION_SUBMIT)
  submitDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
  ) {
    return this.claimDecisionService.submit(user, decisionId);
  }

  @Post('decisions/:decisionId/approve')
  @Permissions(ClaimsPermissions.DECISION_APPROVE)
  approveDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
  ) {
    return this.claimDecisionService.approve(user, decisionId);
  }

  @Post('decisions/:decisionId/reject')
  @Permissions(ClaimsPermissions.DECISION_REJECT)
  rejectDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
    @Body() dto: ClaimDecisionActionDto,
  ) {
    return this.claimDecisionService.reject(user, decisionId, dto.reason ?? '');
  }

  // ----------------------------------------------------------- discharge voucher

  @Post(':id/discharge-vouchers')
  @Permissions(ClaimsPermissions.DISCHARGE_CREATE)
  createDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDischargeVoucherDto,
  ) {
    return this.dischargeService.create(user, id, dto);
  }

  @Post('discharge-vouchers/:voucherId/submit')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_SUBMIT,
    ClaimsPermissions.DISCHARGE_CREATE,
  )
  submitDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
  ) {
    return this.dischargeService.submit(user, voucherId);
  }

  @Post('discharge-vouchers/:voucherId/approve')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_APPROVE,
    ClaimsPermissions.APPROVE,
  )
  approveDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.dischargeService.approve(user, voucherId, dto.comments);
  }

  @Post('discharge-vouchers/:voucherId/decline')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_APPROVE,
    ClaimsPermissions.APPROVE,
  )
  declineDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Body() dto: ApprovalDeclineDto,
  ) {
    return this.dischargeService.decline(
      user,
      voucherId,
      dto.comments,
      dto.decision,
    );
  }

  @Post('discharge-vouchers/:voucherId/respond')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_SUBMIT,
    ClaimsPermissions.DISCHARGE_CREATE,
  )
  respondToDischarge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Body() dto: RespondToDischargeDto,
  ) {
    return this.dischargeService.respond(user, voucherId, dto);
  }

  @Post('discharge-vouchers/:voucherId/adjust')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_SUBMIT,
    ClaimsPermissions.DISCHARGE_CREATE,
  )
  adjustDischarge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Body() dto: AdjustDischargeVoucherDto,
  ) {
    return this.dischargeService.adjust(user, voucherId, dto);
  }

  @Post('discharge-vouchers/:voucherId/tiramis')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_SUBMIT,
    ClaimsPermissions.TIRAMIS_RETRY,
    ClaimsPermissions.TIRAMIS_SUBMIT,
  )
  submitDischargeToTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Body() dto: TiramisSubmitOptionsDto,
  ) {
    return this.dischargeService.submitToTiramis(user, voucherId, dto);
  }

  @Post('discharge-vouchers/:voucherId/generate-document')
  @AnyPermissions(
    ClaimsPermissions.DISCHARGE_CREATE,
    ClaimsPermissions.DISCHARGE_SUBMIT,
  )
  generateDischargeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
  ) {
    return this.dischargeService.generateDocument(user, voucherId);
  }

  // ----------------------------------------------------------- payments

  @Post(':id/payments')
  @Permissions(ClaimsPermissions.PAYMENT_CREATE)
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimPaymentDto,
  ) {
    return this.paymentService.create(user, id, dto);
  }

  @Post('payments/:paymentId/submit')
  @Permissions(ClaimsPermissions.PAYMENT_CREATE)
  submitPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentService.submit(user, paymentId);
  }

  @Post('payments/:paymentId/approve')
  @Permissions(ClaimsPermissions.PAYMENT_APPROVE)
  approvePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.paymentService.approve(user, paymentId, dto.comments);
  }

  @Post('payments/:paymentId/decline')
  @Permissions(ClaimsPermissions.PAYMENT_APPROVE)
  declinePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ApprovalDeclineDto,
  ) {
    return this.paymentService.decline(
      user,
      paymentId,
      dto.comments,
      dto.decision,
    );
  }

  @Post('payments/:paymentId/cancel')
  @Permissions(ClaimsPermissions.PAYMENT_CREATE)
  cancelPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: FailDisbursementDto,
  ) {
    return this.paymentService.cancel(user, paymentId, dto.reason);
  }

  @Post('payments/:paymentId/tiramis')
  @AnyPermissions(
    ClaimsPermissions.PAYMENT_SUBMIT,
    ClaimsPermissions.TIRAMIS_RETRY,
    ClaimsPermissions.TIRAMIS_SUBMIT,
  )
  submitPaymentToTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: TiramisSubmitOptionsDto,
  ) {
    return this.paymentService.submitToTiramis(user, paymentId, dto);
  }

  @Post('payments/:paymentId/request-disbursement')
  @Permissions(ClaimsPermissions.PAYMENT_REQUEST_DISBURSEMENT)
  async requestDisbursement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: RequestDisbursementDto,
  ) {
    await this.paymentService.assertPaymentAccess(user, paymentId);
    return this.claimDisbursementService.requestDisbursement(
      user,
      paymentId,
      dto.idempotency_key,
    );
  }

  @Post('disbursements/:disbursementId/confirm')
  @Permissions(ClaimsPermissions.PAYMENT_CONFIRM_DISBURSEMENT)
  async confirmDisbursement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('disbursementId', ParseUUIDPipe) disbursementId: string,
    @Body() dto: ConfirmDisbursementDto,
  ) {
    await this.paymentService.assertDisbursementAccess(user, disbursementId);
    const disbursement =
      await this.claimDisbursementService.confirmDisbursement(
        user,
        disbursementId,
        dto.payment_method,
        dto.provider_reference ?? null,
      );
    const paymentId =
      await this.paymentService.paymentIdForDisbursement(disbursementId);

    if (paymentId) {
      // A confirmed payment is reported at once; failures stay retryable.
      await this.paymentService
        .submitToTiramis(user, paymentId)
        .catch(() => undefined);
    }

    return disbursement;
  }

  @Post('disbursements/:disbursementId/fail')
  @Permissions(ClaimsPermissions.PAYMENT_CONFIRM_DISBURSEMENT)
  async failDisbursement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('disbursementId', ParseUUIDPipe) disbursementId: string,
    @Body() dto: FailDisbursementDto,
  ) {
    await this.paymentService.assertDisbursementAccess(user, disbursementId);
    return this.claimDisbursementService.failDisbursement(
      user,
      disbursementId,
      dto.reason,
    );
  }

  @Post('disbursements/:disbursementId/reverse')
  @Permissions(ClaimsPermissions.PAYMENT_REVERSE)
  async reverseDisbursement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('disbursementId', ParseUUIDPipe) disbursementId: string,
    @Body() dto: FailDisbursementDto,
  ) {
    await this.paymentService.assertDisbursementAccess(user, disbursementId);
    return this.claimDisbursementService.reverseDisbursement(
      user,
      disbursementId,
      dto.reason,
    );
  }

  // ----------------------------------------------------------- rejection

  @Post(':id/rejections')
  @AnyPermissions(ClaimsPermissions.REJECTION_CREATE, ClaimsPermissions.REJECT)
  createRejection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimRejectionDto,
  ) {
    return this.rejectionService.create(user, id, dto);
  }

  @Post('rejections/:rejectionId/approve')
  @AnyPermissions(
    ClaimsPermissions.REJECTION_APPROVE,
    ClaimsPermissions.APPROVE,
  )
  approveRejection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rejectionId', ParseUUIDPipe) rejectionId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.rejectionService.approve(user, rejectionId, dto.comments);
  }

  @Post('rejections/:rejectionId/decline')
  @AnyPermissions(
    ClaimsPermissions.REJECTION_APPROVE,
    ClaimsPermissions.APPROVE,
  )
  declineRejection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rejectionId', ParseUUIDPipe) rejectionId: string,
    @Body() dto: ApprovalDeclineDto,
  ) {
    return this.rejectionService.decline(user, rejectionId, dto.comments);
  }

  @Post('rejections/:rejectionId/tiramis')
  @AnyPermissions(
    ClaimsPermissions.REJECTION_SUBMIT,
    ClaimsPermissions.TIRAMIS_RETRY,
    ClaimsPermissions.TIRAMIS_SUBMIT,
  )
  submitRejectionToTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rejectionId', ParseUUIDPipe) rejectionId: string,
    @Body() dto: TiramisSubmitOptionsDto,
  ) {
    return this.rejectionService.submitToTiramis(user, rejectionId, dto);
  }

  @Post('rejections/:rejectionId/generate-letter')
  @AnyPermissions(
    ClaimsPermissions.REJECTION_CREATE,
    ClaimsPermissions.REJECTION_APPROVE,
  )
  generateRejectionLetter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rejectionId', ParseUUIDPipe) rejectionId: string,
  ) {
    return this.rejectionService.generateLetter(user, rejectionId);
  }

  // ----------------------------------------------------------- recoveries

  @Get(':id/recoveries')
  @Permissions(ClaimsPermissions.READ)
  async listRecoveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const claim = await this.claimsService.findOne(user, id);
    return this.claimRecoveryService.findAll(user.companyId!, claim.id);
  }

  @Post(':id/recoveries')
  @Permissions(ClaimsPermissions.RECOVERY_CREATE)
  async createRecovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimRecoveryDto,
  ) {
    await this.claimsService.findOne(user, id);
    return this.claimRecoveryService.create(user, id, dto);
  }

  @Post('recoveries/:recoveryId/request')
  @Permissions(ClaimsPermissions.RECOVERY_REQUEST)
  requestRecovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recoveryId', ParseUUIDPipe) recoveryId: string,
  ) {
    return this.claimRecoveryService.request(user, recoveryId);
  }

  @Post('recoveries/:recoveryId/record-receipt')
  @Permissions(ClaimsPermissions.RECOVERY_RECORD_RECEIPT)
  recordRecoveryReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recoveryId', ParseUUIDPipe) recoveryId: string,
    @Body() dto: RecordRecoveryReceiptDto,
  ) {
    return this.claimRecoveryService.recordReceipt(
      user,
      recoveryId,
      dto.received_amount,
    );
  }

  @Post('recoveries/:recoveryId/write-off')
  @Permissions(ClaimsPermissions.RECOVERY_WRITE_OFF)
  writeOffRecovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recoveryId', ParseUUIDPipe) recoveryId: string,
    @Body() dto: WriteOffRecoveryDto,
  ) {
    return this.claimRecoveryService.writeOff(user, recoveryId, dto.reason);
  }

  @Post('recoveries/:recoveryId/cancel')
  @Permissions(ClaimsPermissions.RECOVERY_CANCEL)
  cancelRecovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recoveryId', ParseUUIDPipe) recoveryId: string,
  ) {
    return this.claimRecoveryService.cancel(user, recoveryId);
  }
}
