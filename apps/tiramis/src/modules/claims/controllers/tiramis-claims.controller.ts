import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimNotificationDto,
  CreateClaimPaymentDto,
  CreateClaimRejectionDto,
  CreateDischargeVoucherDto,
} from '../dto/create-claim.dto';
import { TiramisClaimService } from '../services/tiramis-claim.service';

@ApiTags('Tiramis Claims')
@ApiConsumes('application/json')
@Controller('tiramis/claims')
export class TiramisClaimsController {
  constructor(private readonly tiramisClaimService: TiramisClaimService) {}

  @ApiOperation({ summary: 'Submit a claim notification' })
  @ApiBody({ type: CreateClaimNotificationDto })
  @Post('notifications/submit')
  submitClaimNotification(@Body() dto: CreateClaimNotificationDto) {
    return this.tiramisClaimService.submitClaimNotification(dto);
  }

  @ApiOperation({ summary: 'List claim notifications' })
  @Get('notifications')
  findAllClaimNotifications() {
    return this.tiramisClaimService.findAllClaimNotifications();
  }

  @ApiOperation({ summary: 'Get a claim notification by id' })
  @Get('notifications/:id')
  findClaimNotificationById(@Param('id') id: string) {
    return this.tiramisClaimService.findClaimNotificationById(id);
  }

  @ApiOperation({ summary: 'Get a claim notification by request id' })
  @Get('notifications/request/:requestId')
  findClaimNotificationByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findClaimNotificationByRequestId(requestId);
  }

  @ApiOperation({ summary: 'Submit a claim intimation' })
  @ApiBody({ type: CreateClaimIntimationDto })
  @Post('intimations/submit')
  submitClaimIntimation(@Body() dto: CreateClaimIntimationDto) {
    return this.tiramisClaimService.submitClaimIntimation(dto);
  }

  @ApiOperation({ summary: 'List claim intimations' })
  @Get('intimations')
  findAllClaimIntimations() {
    return this.tiramisClaimService.findAllClaimIntimations();
  }

  @ApiOperation({ summary: 'Get a claim intimation by id' })
  @Get('intimations/:id')
  findClaimIntimationById(@Param('id') id: string) {
    return this.tiramisClaimService.findClaimIntimationById(id);
  }

  @ApiOperation({ summary: 'Get a claim intimation by request id' })
  @Get('intimations/request/:requestId')
  findClaimIntimationByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findClaimIntimationByRequestId(requestId);
  }

  @ApiOperation({ summary: 'Submit a claim assessment' })
  @ApiBody({ type: CreateClaimAssessmentDto })
  @Post('assessments/submit')
  submitClaimAssessment(@Body() dto: CreateClaimAssessmentDto) {
    return this.tiramisClaimService.submitClaimAssessment(dto);
  }

  @ApiOperation({ summary: 'List claim assessments' })
  @Get('assessments')
  findAllClaimAssessments() {
    return this.tiramisClaimService.findAllClaimAssessments();
  }

  @ApiOperation({ summary: 'Get a claim assessment by id' })
  @Get('assessments/:id')
  findClaimAssessmentById(@Param('id') id: string) {
    return this.tiramisClaimService.findClaimAssessmentById(id);
  }

  @ApiOperation({ summary: 'Get a claim assessment by request id' })
  @Get('assessments/request/:requestId')
  findClaimAssessmentByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findClaimAssessmentByRequestId(requestId);
  }

  @ApiOperation({ summary: 'Submit a discharge voucher' })
  @ApiBody({ type: CreateDischargeVoucherDto })
  @Post('discharge-vouchers/submit')
  submitDischargeVoucher(@Body() dto: CreateDischargeVoucherDto) {
    return this.tiramisClaimService.submitDischargeVoucher(dto);
  }

  @ApiOperation({ summary: 'List discharge vouchers' })
  @Get('discharge-vouchers')
  findAllDischargeVouchers() {
    return this.tiramisClaimService.findAllClaimDischargeVouchers();
  }

  @ApiOperation({ summary: 'Get a discharge voucher by id' })
  @Get('discharge-vouchers/:id')
  findDischargeVoucherById(@Param('id') id: string) {
    return this.tiramisClaimService.findClaimDischargeVoucherById(id);
  }

  @ApiOperation({ summary: 'Get a discharge voucher by request id' })
  @Get('discharge-vouchers/request/:requestId')
  findDischargeVoucherByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findClaimDischargeVoucherByRequestId(requestId);
  }

  @ApiOperation({ summary: 'Submit a claim payment' })
  @ApiBody({ type: CreateClaimPaymentDto })
  @Post('payments/submit')
  submitClaimPayment(@Body() dto: CreateClaimPaymentDto) {
    return this.tiramisClaimService.submitClaimPayment(dto);
  }

  @ApiOperation({ summary: 'List claim payments' })
  @Get('payments')
  findAllClaimPayments() {
    return this.tiramisClaimService.findAllClaimPayments();
  }

  @ApiOperation({ summary: 'Get a claim payment by id' })
  @Get('payments/:id')
  findClaimPaymentById(@Param('id') id: string) {
    return this.tiramisClaimService.findClaimPaymentById(id);
  }

  @ApiOperation({ summary: 'Get a claim payment by request id' })
  @Get('payments/request/:requestId')
  findClaimPaymentByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findClaimPaymentByRequestId(requestId);
  }

  @ApiOperation({ summary: 'Submit a claim rejection' })
  @ApiBody({ type: CreateClaimRejectionDto })
  @Post('rejections/submit')
  submitClaimRejection(@Body() dto: CreateClaimRejectionDto) {
    return this.tiramisClaimService.submitClaimRejection(dto);
  }

  @ApiOperation({ summary: 'Get a claim rejection by request id' })
  @Get('rejections/request/:requestId')
  findClaimRejectionByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findClaimRejectionByRequestId(requestId);
  }

  @ApiOperation({ summary: 'List claim rejections' })
  @Get('rejections')
  findAllClaimRejections() {
    return this.tiramisClaimService.findAllClaimRejections();
  }

  @ApiOperation({ summary: 'Get a claim rejection by id' })
  @Get('rejections/:id')
  findClaimRejectionById(@Param('id') id: string) {
    return this.tiramisClaimService.findClaimRejectionById(id);
  }
}
