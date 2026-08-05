import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  } from '@nestjs/common';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { ClaimsPermissions } from './claims.permissions';
import { ClaimsService } from './claims.service';
import { FindClaimsQueryDto } from './dto/find-claims-query.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { TenantScoped } from '@insurance-max/portal-shared';
import {
  AddClaimDocumentDto,
  AssignClaimDto,
  CloseClaimDto,
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimPaymentDto,
  CreateClaimReserveDto,
  CreateDischargeVoucherDto,
  CreateServiceAssignmentDto,
  MarkClaimPaymentPaidDto,
  RejectClaimDto,
  RespondToDischargeDto,
  VerifyClaimDocumentDto,
} from './dto/claim-workflow.dto';

@Controller('tenant/claims')
@TenantScoped()
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

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

  @Post(':id/assign')
  @Permissions(ClaimsPermissions.ASSIGN)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignClaimDto,
  ) {
    return this.claimsService.assignClaim(user, id, dto);
  }

  @Post(':id/documents')
  @Permissions(ClaimsPermissions.DOCUMENT_UPLOAD)
  addDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClaimDocumentDto,
  ) {
    return this.claimsService.addDocument(user, id, dto);
  }

  @Post('documents/:id/verify')
  @Permissions(ClaimsPermissions.DOCUMENT_VERIFY)
  verifyDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyClaimDocumentDto,
  ) {
    return this.claimsService.verifyDocument(user, id, dto);
  }

  @Post(':id/intimations')
  @Permissions(ClaimsPermissions.UPDATE)
  createIntimation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimIntimationDto,
  ) {
    return this.claimsService.createIntimation(user, id, dto);
  }

  @Post(':id/reserves')
  @Permissions(ClaimsPermissions.RESERVE_CREATE)
  createReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimReserveDto,
  ) {
    return this.claimsService.createReserve(user, id, dto);
  }

  @Post('reserves/:id/submit')
  @Permissions(ClaimsPermissions.RESERVE_CREATE)
  submitReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitReserve(user, id);
  }

  @Post('reserves/:id/approve')
  @Permissions(ClaimsPermissions.RESERVE_APPROVE)
  approveReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.approveReserve(user, id);
  }

  @Post(':id/service-assignments')
  @Permissions(ClaimsPermissions.ASSIGN)
  createServiceAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceAssignmentDto,
  ) {
    return this.claimsService.createServiceAssignment(user, id, dto);
  }

  @Post(':id/assessments')
  @Permissions(ClaimsPermissions.ASSESSMENT_CREATE)
  createAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimAssessmentDto,
  ) {
    return this.claimsService.createAssessment(user, id, dto);
  }

  @Post('assessments/:id/submit')
  @Permissions(ClaimsPermissions.ASSESSMENT_CREATE)
  submitAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitAssessment(user, id);
  }

  @Post('assessments/:id/approve')
  @Permissions(ClaimsPermissions.ASSESSMENT_APPROVE)
  approveAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.approveAssessment(user, id);
  }

  @Post(':id/discharge-vouchers')
  @Permissions(ClaimsPermissions.DISCHARGE_CREATE)
  createDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDischargeVoucherDto,
  ) {
    return this.claimsService.createDischargeVoucher(user, id, dto);
  }

  @Post('discharge-vouchers/:id/submit')
  @Permissions(ClaimsPermissions.DISCHARGE_CREATE)
  submitDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitDischargeVoucher(user, id);
  }

  @Post('discharge-vouchers/:id/approve')
  @Permissions(ClaimsPermissions.DISCHARGE_APPROVE)
  approveDischargeVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.approveDischargeVoucher(user, id);
  }

  @Post('discharge-vouchers/:id/respond')
  @Permissions(ClaimsPermissions.DISCHARGE_APPROVE)
  respondToDischarge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToDischargeDto,
  ) {
    return this.claimsService.respondToDischarge(user, id, dto);
  }

  @Post(':id/payments')
  @Permissions(ClaimsPermissions.PAYMENT_CREATE)
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimPaymentDto,
  ) {
    return this.claimsService.createPayment(user, id, dto);
  }

  @Post('payments/:id/submit')
  @Permissions(ClaimsPermissions.PAYMENT_CREATE)
  submitPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitPayment(user, id);
  }

  @Post('payments/:id/approve')
  @Permissions(ClaimsPermissions.PAYMENT_APPROVE)
  approvePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.approvePayment(user, id);
  }

  @Post('payments/:id/mark-paid')
  @Permissions(ClaimsPermissions.PAYMENT_MARK_PAID)
  markPaymentPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkClaimPaymentPaidDto,
  ) {
    return this.claimsService.markPaymentPaid(user, id, dto);
  }

  @Post(':id/reject')
  @Permissions(ClaimsPermissions.REJECT)
  rejectClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectClaimDto,
  ) {
    return this.claimsService.rejectClaim(user, id, dto);
  }

  @Post(':id/close')
  @Permissions(ClaimsPermissions.CLOSE)
  closeClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseClaimDto,
  ) {
    return this.claimsService.closeClaim(user, id, dto);
  }

  @Post(':id/tiramis/notification')
  @Permissions(ClaimsPermissions.TIRAMIS_SUBMIT)
  submitNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitNotificationToTiramis(user, id);
  }

  @Post('intimations/:id/tiramis')
  @Permissions(ClaimsPermissions.TIRAMIS_SUBMIT)
  submitIntimation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitIntimationToTiramis(user, id);
  }

  @Post('assessments/:id/tiramis')
  @Permissions(ClaimsPermissions.TIRAMIS_SUBMIT)
  submitAssessmentToTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitAssessmentToTiramis(user, id);
  }

  @Post('payments/:id/tiramis')
  @Permissions(ClaimsPermissions.TIRAMIS_SUBMIT)
  submitPaymentToTiramis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.claimsService.submitPaymentToTiramis(user, id);
  }
}
