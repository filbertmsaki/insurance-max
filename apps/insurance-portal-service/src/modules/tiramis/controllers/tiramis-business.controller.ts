import { Body, Controller, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireTiramisPermissions } from '../auth/tiramis-permission.decorator';
import { TiramisPermissionGuard } from '../auth/tiramis-permission.guard';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { SubmitBusinessRecordToTiramisDto } from '../dto/submit-business-record-to-tiramis.dto';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisBusinessSubmitService } from '../services/tiramis-business-submit.service';

@ApiTags('TIRAMIS Business')
@Controller('tiramis/business')
@UseGuards(AuthGuard('jwt'), TiramisPermissionGuard)
@RequireTiramisPermissions(TiramisPermissions.SUBMIT)
export class TiramisBusinessController {
  constructor(
    private readonly tiramisBusinessSubmitService: TiramisBusinessSubmitService,
  ) {}

  @ApiOperation({ summary: 'Submit cover note to TIRAMIS' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: [
      TiramisRequestType.NON_MOTOR,
      TiramisRequestType.MOTOR,
      TiramisRequestType.MOTOR_FLEET,
    ],
    example: TiramisRequestType.NON_MOTOR,
  })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('cover-notes/:id/submit')
  submitCoverNote(
    @Param('id') id: string,
    @Query('type') type: TiramisRequestType,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    const requestType = type || TiramisRequestType.NON_MOTOR;

    return this.tiramisBusinessSubmitService.submitCoverNote({
      id: dto.sourceRecordId || id,
      requestType: requestType as any,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit reinsurance to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('reinsurance/:id/submit')
  submitReinsurance(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitReinsurance({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit policy to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('policies/:id/submit')
  submitPolicy(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitPolicy({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim notification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/notification/submit')
  submitClaimNotification(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimNotification({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim intimation to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/intimation/submit')
  submitClaimIntimation(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimIntimation({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim assessment to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/assessment/submit')
  submitClaimAssessment(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimAssessment({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit discharge voucher to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/discharge-voucher/submit')
  submitDischargeVoucher(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitDischargeVoucher({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim payment to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/payment/submit')
  submitClaimPayment(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimPayment({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim rejection to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/rejection/submit')
  submitClaimRejection(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimRejection({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  private getAuthContext(req: any) {
    return {
      userId: req.user?.id || req.user?.sub || null,
      companyId:
        req.user?.companyId ||
        req.user?.active_company_id ||
        req.user?.activeCompanyId ||
        null,
      activeCompanyId:
        req.user?.active_company_id ||
        req.user?.activeCompanyId ||
        req.user?.companyId ||
        null,
      ipAddress:
        req.ip ||
        req.headers?.['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        null,
      userAgent: req.headers?.['user-agent'] || null,
    };
  }
}
