import { Body, Controller, Post } from '@nestjs/common';

import type {
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimNotificationDto,
  CreateClaimPaymentDto,
  CreateClaimRejectionDto,
  CreateDischargeVoucherDto,
} from '../dto/create-claim.dto';
import { TiramisClaimService } from '../services/tiramis-claim.service';

@Controller('tiramis/claims')
export class TiramisClaimsController {
  constructor(private readonly tiramisClaimService: TiramisClaimService) {}

  @Post('notifications/submit')
  submitClaimNotification(@Body() dto: CreateClaimNotificationDto) {
    return this.tiramisClaimService.submitClaimNotification(dto);
  }

  @Post('intimations/submit')
  submitClaimIntimation(@Body() dto: CreateClaimIntimationDto) {
    return this.tiramisClaimService.submitClaimIntimation(dto);
  }

  @Post('assessments/submit')
  submitClaimAssessment(@Body() dto: CreateClaimAssessmentDto) {
    return this.tiramisClaimService.submitClaimAssessment(dto);
  }

  @Post('discharge-vouchers/submit')
  submitDischargeVoucher(@Body() dto: CreateDischargeVoucherDto) {
    return this.tiramisClaimService.submitDischargeVoucher(dto);
  }

  @Post('payments/submit')
  submitClaimPayment(@Body() dto: CreateClaimPaymentDto) {
    return this.tiramisClaimService.submitClaimPayment(dto);
  }

  @Post('rejections/submit')
  submitClaimRejection(@Body() dto: CreateClaimRejectionDto) {
    return this.tiramisClaimService.submitClaimRejection(dto);
  }
}
