import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimNotificationDto,
  CreateClaimPaymentDto,
  CreateClaimRejectionDto,
  CreateDischargeVoucherDto,
} from '../dto/create-claim.dto';
import {
  claimAssessmentRequestBody,
  claimIntimationRequestBody,
  claimNotificationRequestBody,
  claimPaymentRequestBody,
  claimRejectionRequestBody,
  dischargeVoucherRequestBody,
} from '../swagger/create-claim.swagger';
import { TiramisClaimService } from '../services/tiramis-claim.service';

@ApiTags('Tiramis Claims')
@ApiConsumes('application/json')
@Controller('tiramis/claims')
export class TiramisClaimsController {
  constructor(private readonly tiramisClaimService: TiramisClaimService) {}

  @ApiOperation({ summary: 'Submit a claim notification' })
  @ApiBody(claimNotificationRequestBody)
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

  @ApiOperation({ summary: 'Submit a claim intimation' })
  @ApiBody(claimIntimationRequestBody)
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

  @ApiOperation({ summary: 'Submit a claim assessment' })
  @ApiBody(claimAssessmentRequestBody)
  @Post('assessments/submit')
  submitClaimAssessment(@Body() dto: CreateClaimAssessmentDto) {
    return this.tiramisClaimService.submitClaimAssessment(dto);
  }

  @ApiOperation({ summary: 'Submit a discharge voucher' })
  @ApiBody(dischargeVoucherRequestBody)
  @Post('discharge-vouchers/submit')
  submitDischargeVoucher(@Body() dto: CreateDischargeVoucherDto) {
    return this.tiramisClaimService.submitDischargeVoucher(dto);
  }

  @ApiOperation({ summary: 'Submit a claim payment' })
  @ApiBody(claimPaymentRequestBody)
  @Post('payments/submit')
  submitClaimPayment(@Body() dto: CreateClaimPaymentDto) {
    return this.tiramisClaimService.submitClaimPayment(dto);
  }

  @ApiOperation({ summary: 'Submit a claim rejection' })
  @ApiBody(claimRejectionRequestBody)
  @Post('rejections/submit')
  submitClaimRejection(@Body() dto: CreateClaimRejectionDto) {
    return this.tiramisClaimService.submitClaimRejection(dto);
  }
}
