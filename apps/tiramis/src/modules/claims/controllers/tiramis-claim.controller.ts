import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CreateClaimNotificationDto } from '../dto/create-claim-notification.dto';
import { CreateClaimIntimationDto } from '../dto/create-claim-intimation.dto';
import { CreateClaimAssessmentDto } from '../dto/create-claim-assessment.dto';
import { CreateClaimPaymentDto } from '../dto/create-claim-payment.dto';
import { CreateClaimRejectionDto } from '../dto/create-claim-rejection.dto';
import { TiramisClaimService } from '../services/tiramis-claim.service';

import { ServiceScopes } from '@insurance-max/shared-kernel';

@ApiTags('Tiramis Claims')
@ApiConsumes('application/json')
@Controller('tiramis/claims')
@ServiceScopes('tiramis:invoke')
export class TiramisClaimController {
  constructor(private readonly tiramisClaimService: TiramisClaimService) {}

  @ApiOperation({ summary: 'Create Claim Notification draft' })
  @ApiBody({ type: CreateClaimNotificationDto })
  @Post('notification/draft')
  createClaimNotificationDraft(@Body() dto: CreateClaimNotificationDto) {
    return this.tiramisClaimService.createClaimNotificationDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Claim Notification XML without sending to TIRA',
  })
  @ApiBody({ type: CreateClaimNotificationDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('notification/preview/xml')
  previewClaimNotificationXml(
    @Body() dto: CreateClaimNotificationDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisClaimService.previewClaimNotificationXml(
      dto,
      signed !== 'false',
    );
  }

  @ApiOperation({ summary: 'Submit Claim Notification to TIRA' })
  @ApiBody({ type: CreateClaimNotificationDto })
  @Post('notification/submit')
  submitClaimNotification(@Body() dto: CreateClaimNotificationDto) {
    return this.tiramisClaimService.submitClaimNotification(dto);
  }

  @ApiOperation({ summary: 'Create Claim Intimation draft' })
  @ApiBody({ type: CreateClaimIntimationDto })
  @Post('intimation/draft')
  createClaimIntimationDraft(@Body() dto: CreateClaimIntimationDto) {
    return this.tiramisClaimService.createClaimIntimationDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Claim Intimation XML without sending to TIRA',
  })
  @ApiBody({ type: CreateClaimIntimationDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('intimation/preview/xml')
  previewClaimIntimationXml(
    @Body() dto: CreateClaimIntimationDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisClaimService.previewClaimIntimationXml(
      dto,
      signed !== 'false',
    );
  }

  @ApiOperation({ summary: 'Submit Claim Intimation to TIRA' })
  @ApiBody({ type: CreateClaimIntimationDto })
  @Post('intimation/submit')
  submitClaimIntimation(@Body() dto: CreateClaimIntimationDto) {
    return this.tiramisClaimService.submitClaimIntimation(dto);
  }

  @ApiOperation({ summary: 'Create Claim Assessment draft' })
  @ApiBody({ type: CreateClaimAssessmentDto })
  @Post('assessment/draft')
  createClaimAssessmentDraft(@Body() dto: CreateClaimAssessmentDto) {
    return this.tiramisClaimService.createClaimAssessmentDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Claim Assessment XML without sending to TIRA',
  })
  @ApiBody({ type: CreateClaimAssessmentDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('assessment/preview/xml')
  previewClaimAssessmentXml(
    @Body() dto: CreateClaimAssessmentDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisClaimService.previewClaimAssessmentXml(
      dto,
      signed !== 'false',
    );
  }

  @ApiOperation({ summary: 'Submit Claim Assessment to TIRA' })
  @ApiBody({ type: CreateClaimAssessmentDto })
  @Post('assessment/submit')
  submitClaimAssessment(@Body() dto: CreateClaimAssessmentDto) {
    return this.tiramisClaimService.submitClaimAssessment(dto);
  }

  @ApiOperation({ summary: 'Create Claim Payment draft' })
  @ApiBody({ type: CreateClaimPaymentDto })
  @Post('payment/draft')
  createClaimPaymentDraft(@Body() dto: CreateClaimPaymentDto) {
    return this.tiramisClaimService.createClaimPaymentDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Claim Payment XML without sending to TIRA',
  })
  @ApiBody({ type: CreateClaimPaymentDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('payment/preview/xml')
  previewClaimPaymentXml(
    @Body() dto: CreateClaimPaymentDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisClaimService.previewClaimPaymentXml(
      dto,
      signed !== 'false',
    );
  }

  @ApiOperation({ summary: 'Submit Claim Payment to TIRA' })
  @ApiBody({ type: CreateClaimPaymentDto })
  @Post('payment/submit')
  submitClaimPayment(@Body() dto: CreateClaimPaymentDto) {
    return this.tiramisClaimService.submitClaimPayment(dto);
  }

  @ApiOperation({ summary: 'Create Claim Rejection draft' })
  @ApiBody({ type: CreateClaimRejectionDto })
  @Post('rejection/draft')
  createClaimRejectionDraft(@Body() dto: CreateClaimRejectionDto) {
    return this.tiramisClaimService.createClaimRejectionDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Claim Rejection XML without sending to TIRA',
  })
  @ApiBody({ type: CreateClaimRejectionDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('rejection/preview/xml')
  previewClaimRejectionXml(
    @Body() dto: CreateClaimRejectionDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisClaimService.previewClaimRejectionXml(
      dto,
      signed !== 'false',
    );
  }

  @ApiOperation({ summary: 'Submit Claim Rejection to TIRA' })
  @ApiBody({ type: CreateClaimRejectionDto })
  @Post('rejection/submit')
  submitClaimRejection(@Body() dto: CreateClaimRejectionDto) {
    return this.tiramisClaimService.submitClaimRejection(dto);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisClaimService.findByRequestId(requestId);
  }

  @Get('notification/:claimNotificationNumber')
  findByClaimNotificationNumber(
    @Param('claimNotificationNumber') claimNotificationNumber: string,
  ) {
    return this.tiramisClaimService.findByClaimNotificationNumber(
      claimNotificationNumber,
    );
  }

  @Get('intimation/:claimIntimationNumber')
  findByClaimIntimationNumber(
    @Param('claimIntimationNumber') claimIntimationNumber: string,
  ) {
    return this.tiramisClaimService.findByClaimIntimationNumber(
      claimIntimationNumber,
    );
  }

  @Get('assessment/:claimAssessmentNumber')
  findByClaimAssessmentNumber(
    @Param('claimAssessmentNumber') claimAssessmentNumber: string,
  ) {
    return this.tiramisClaimService.findByClaimAssessmentNumber(
      claimAssessmentNumber,
    );
  }

  @Get('payment/:claimPaymentNumber')
  findByClaimPaymentNumber(
    @Param('claimPaymentNumber') claimPaymentNumber: string,
  ) {
    return this.tiramisClaimService.findByClaimPaymentNumber(
      claimPaymentNumber,
    );
  }

  @Get('rejection/:claimRejectionNumber')
  findByClaimRejectionNumber(
    @Param('claimRejectionNumber') claimRejectionNumber: string,
  ) {
    return this.tiramisClaimService.findByClaimRejectionNumber(
      claimRejectionNumber,
    );
  }

  @Get('reference/:claimReferenceNumber')
  findByClaimReferenceNumber(
    @Param('claimReferenceNumber') claimReferenceNumber: string,
  ) {
    return this.tiramisClaimService.findByClaimReferenceNumber(
      claimReferenceNumber,
    );
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisClaimService.findById(id);
  }
}
