import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimRegulatoryOperationType,
  validateClaimTiramisPayload,
} from '@insurance-max/contracts';

import {
  TiramisConfigService,
  type TiramisResolvedRequestDtoFields,
} from '../../config/services/tiramis-config.service';
import { TiramisBusinessSubmissionService } from '../../shared/services/tiramis-business-submission.service';
import { TiramisSourceMetadataDto } from '../../submissions/dto/tiramis-source-metadata.dto';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import { CreateClaimAssessmentDto } from '../dto/create-claim-assessment.dto';
import { CreateClaimPaymentDto } from '../dto/create-claim-payment.dto';
import { CreateClaimIntimationDto } from '../dto/create-claim-intimation.dto';
import { CreateClaimNotificationDto } from '../dto/create-claim-notification.dto';
import { CreateClaimRejectionDto } from '../dto/create-claim-rejection.dto';
import { TiramisClaimRepository } from '../repositories/tiramis-claim.repository';
import { TiramisClaimPayloadService } from './tiramis-claim-payload.service';

@Injectable()
export class TiramisClaimService {
  private readonly claimNotificationRootElement = 'ClaimNotificationRefReq';
  private readonly claimNotificationServiceType = 'CLAIM_NOTIFICATION';
  private readonly claimIntimationRootElement = 'ClaimIntimationReq';
  private readonly claimIntimationServiceType = 'CLAIM_INTIMATION';
  private readonly claimAssessmentRootElement = 'ClaimAssessmentReq';
  private readonly claimAssessmentServiceType = 'CLAIM_ASSESSMENT';
  private readonly claimPaymentRootElement = 'ClaimPaymentReq';
  private readonly claimPaymentServiceType = 'CLAIM_PAYMENT';
  private readonly claimRejectionRootElement = 'ClaimRejectionReq';
  private readonly claimRejectionServiceType = 'CLAIM_REJECTION';

  constructor(
    private readonly claimRepository: TiramisClaimRepository,
    private readonly claimPayloadService: TiramisClaimPayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly businessSubmissionService: TiramisBusinessSubmissionService,
  ) {}

  async createClaimNotificationDraft(
    dto:
      | CreateClaimNotificationDto
      | (CreateClaimNotificationDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.claimNotificationNumber,
            )
          ).dto;

    this.validateClaimNotificationPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId ||
      (await this.tiramisRequestIdService.generate('AIC'));

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimNotificationServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.claimNotificationNumber,
      businessReference:
        sourceMetadata?.businessReference ||
        resolvedDto.claimNotificationNumber,
      originalRequestId: requestId,
    });

    const claim = this.claimRepository.create({
      transactionId: transaction.id,
      requestId,
      claimType: 'CLAIM_NOTIFICATION',
      serviceType: this.claimNotificationServiceType,
      rootElement: this.claimNotificationRootElement,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      tranCompanyCode: resolvedDto.tranCompanyCode,
      claimNotificationNumber: resolvedDto.claimNotificationNumber,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      claimReportDate: new Date(resolvedDto.claimReportDate),
      claimFormDullyFilled: resolvedDto.claimFormDullyFilled,
      lossDate: new Date(resolvedDto.lossDate),
      lossNature: resolvedDto.lossNature,
      lossType: resolvedDto.lossType,
      lossLocation: resolvedDto.lossLocation,
      officerName: resolvedDto.officerName,
      officerTitle: resolvedDto.officerTitle,
      rawData: resolvedDto as any,
    });

    const savedClaim = await this.claimRepository.save(claim);

    return {
      transaction,
      record: savedClaim,
    };
  }

  async submitClaimNotification(
    dto: CreateClaimNotificationDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.claimNotificationNumber,
      );

    const { transaction, record } = await this.createClaimNotificationDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.claimPayloadService.buildClaimNotificationPayload({
      dto: resolvedDto,
      requestId: record.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: record.requestId,
      rootElement: this.claimNotificationRootElement,
      serviceType: this.claimNotificationServiceType,
      payload,
      errorLabel: 'Claim Notification',
    });

    record.currentAttemptId = submission.attempt.id;
    await this.claimRepository.save(record);

    return {
      transaction,
      record,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewClaimNotificationXml(
    dto: CreateClaimNotificationDto,
    includeSignature = true,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.claimNotificationNumber,
      );

    this.validateClaimNotificationPayload(resolvedDto);

    const requestId = await this.tiramisRequestIdService.generate('AIC');

    const payload = this.claimPayloadService.buildClaimNotificationPayload({
      dto: resolvedDto,
      requestId,
    });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.claimNotificationRootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.claimNotificationServiceType,
      rootElement: this.claimNotificationRootElement,
      requestId,
      payload,
      ...preview,
    };
  }

  async createClaimIntimationDraft(
    dto:
      | CreateClaimIntimationDto
      | (CreateClaimIntimationDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.claimIntimationNumber,
            )
          ).dto;

    this.validateClaimIntimationPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId ||
      (await this.tiramisRequestIdService.generate('AIC'));

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimIntimationServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.claimIntimationNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.claimIntimationNumber,
      originalRequestId: requestId,
    });

    const claim = this.claimRepository.create({
      transactionId: transaction.id,
      requestId,
      claimType: 'CLAIM_INTIMATION',
      serviceType: this.claimIntimationServiceType,
      rootElement: this.claimIntimationRootElement,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      claimIntimationNumber: resolvedDto.claimIntimationNumber,
      claimReferenceNumber: resolvedDto.claimReferenceNumber,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      claimIntimationDate: new Date(resolvedDto.claimIntimationDate),
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      claimEstimatedAmount: resolvedDto.claimEstimatedAmount,
      claimReserveAmount: resolvedDto.claimReserveAmount,
      claimReserveMethod: resolvedDto.claimReserveMethod,
      lossAssessmentOption: resolvedDto.lossAssessmentOption,
      assessorName: resolvedDto.assessorName,
      assessorIdNumber: resolvedDto.assessorIdNumber,
      assessorIdType: resolvedDto.assessorIdType,
      claimants: resolvedDto.claimants as any,
      rawData: resolvedDto as any,
    });

    const savedClaim = await this.claimRepository.save(claim);

    return {
      transaction,
      record: savedClaim,
    };
  }

  async submitClaimIntimation(
    dto: CreateClaimIntimationDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.claimIntimationNumber,
      );

    const { transaction, record } = await this.createClaimIntimationDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.claimPayloadService.buildClaimIntimationPayload({
      dto: resolvedDto,
      requestId: record.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: record.requestId,
      rootElement: this.claimIntimationRootElement,
      serviceType: this.claimIntimationServiceType,
      payload,
      errorLabel: 'Claim Intimation',
    });

    record.currentAttemptId = submission.attempt.id;
    await this.claimRepository.save(record);

    return {
      transaction,
      record,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewClaimIntimationXml(
    dto: CreateClaimIntimationDto,
    includeSignature = true,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.claimIntimationNumber,
      );

    this.validateClaimIntimationPayload(resolvedDto);

    const requestId = await this.tiramisRequestIdService.generate('AIC');

    const payload = this.claimPayloadService.buildClaimIntimationPayload({
      dto: resolvedDto,
      requestId,
    });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.claimIntimationRootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.claimIntimationServiceType,
      rootElement: this.claimIntimationRootElement,
      requestId,
      payload,
      ...preview,
    };
  }

  async findById(id: string) {
    const claim = await this.claimRepository.findById(id);

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim record not found');
    }

    return claim;
  }

  async findByRequestId(requestId: string) {
    const claim = await this.claimRepository.findByRequestId(requestId);

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim record not found');
    }

    return claim;
  }

  async findByClaimNotificationNumber(claimNotificationNumber: string) {
    const claim = await this.claimRepository.findByClaimNotificationNumber(
      claimNotificationNumber,
    );

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim notification not found');
    }

    return claim;
  }

  async findByClaimIntimationNumber(claimIntimationNumber: string) {
    const claim = await this.claimRepository.findByClaimIntimationNumber(
      claimIntimationNumber,
    );

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim intimation not found');
    }

    return claim;
  }

  async findByClaimPaymentNumber(claimPaymentNumber: string) {
    const claim =
      await this.claimRepository.findByClaimPaymentNumber(claimPaymentNumber);

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim payment not found');
    }

    return claim;
  }

  async createClaimPaymentDraft(
    dto:
      | CreateClaimPaymentDto
      | (CreateClaimPaymentDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.claimPaymentNumber,
            )
          ).dto;

    this.validateClaimPaymentPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId ||
      (await this.tiramisRequestIdService.generate('AIC'));

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimPaymentServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        (resolvedDto as any).sourceRecordId ||
        resolvedDto.claimPaymentNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.claimPaymentNumber,
      originalRequestId: requestId,
    });

    const claim = this.claimRepository.create({
      transactionId: transaction.id,
      requestId,
      claimType: 'CLAIM_PAYMENT',
      serviceType: this.claimPaymentServiceType,
      rootElement: this.claimPaymentRootElement,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      claimPaymentNumber: resolvedDto.claimPaymentNumber,
      claimReferenceNumber: resolvedDto.claimReferenceNumber,
      claimIntimationNumber: resolvedDto.claimIntimationNumber,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      paymentDate: new Date(resolvedDto.paymentDate),
      paidAmount: resolvedDto.paidAmount,
      paymentMode: resolvedDto.paymentMode,
      partiesNotified: resolvedDto.partiesNotified,
      netPremiumEarned: resolvedDto.netPremiumEarned,
      claimResultedLitigation: resolvedDto.claimResultedLitigation,
      litigationReason: resolvedDto.litigationReason,
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      claimants: resolvedDto.claimants as any,
      rawData: resolvedDto as any,
    });

    const savedClaim = await this.claimRepository.save(claim);

    return {
      transaction,
      record: savedClaim,
    };
  }

  async createClaimAssessmentDraft(
    dto:
      | CreateClaimAssessmentDto
      | (CreateClaimAssessmentDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.claimAssessmentNumber,
            )
          ).dto;

    this.validateClaimAssessmentPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId ||
      (await this.tiramisRequestIdService.generate('AIC'));

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimAssessmentServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.claimAssessmentNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.claimAssessmentNumber,
      originalRequestId: requestId,
    });

    const claim = this.claimRepository.create({
      transactionId: transaction.id,
      requestId,
      claimType: 'CLAIM_ASSESSMENT',
      serviceType: this.claimAssessmentServiceType,
      rootElement: this.claimAssessmentRootElement,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      claimAssessmentNumber: resolvedDto.claimAssessmentNumber,
      claimIntimationNumber: resolvedDto.claimIntimationNumber,
      claimReferenceNumber: resolvedDto.claimReferenceNumber,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      assessmentReceivedDate: new Date(resolvedDto.assessmentReceivedDate),
      assessmentReportSummary: resolvedDto.assessmentReportSummary,
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      assessmentAmount: resolvedDto.assessmentAmount,
      approvedClaimAmount: resolvedDto.approvedClaimAmount,
      claimApprovalDate: new Date(resolvedDto.claimApprovalDate),
      claimApprovalAuthority: resolvedDto.claimApprovalAuthority,
      isReAssessment: resolvedDto.isReAssessment,
      claimants: resolvedDto.claimants as any,
      rawData: resolvedDto as any,
    });

    const savedClaim = await this.claimRepository.save(claim);

    return {
      transaction,
      record: savedClaim,
    };
  }

  async submitClaimAssessment(
    dto: CreateClaimAssessmentDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.claimAssessmentNumber,
      );

    const { transaction, record } = await this.createClaimAssessmentDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.claimPayloadService.buildClaimAssessmentPayload({
      dto: resolvedDto,
      requestId: record.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: record.requestId,
      rootElement: this.claimAssessmentRootElement,
      serviceType: this.claimAssessmentServiceType,
      payload,
      errorLabel: 'Claim Assessment',
    });

    record.currentAttemptId = submission.attempt.id;
    await this.claimRepository.save(record);

    return {
      transaction,
      record,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewClaimAssessmentXml(
    dto: CreateClaimAssessmentDto,
    includeSignature = true,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.claimAssessmentNumber,
      );

    this.validateClaimAssessmentPayload(resolvedDto);

    const requestId = await this.tiramisRequestIdService.generate('AIC');

    const payload = this.claimPayloadService.buildClaimAssessmentPayload({
      dto: resolvedDto,
      requestId,
    });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.claimAssessmentRootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.claimAssessmentServiceType,
      rootElement: this.claimAssessmentRootElement,
      requestId,
      payload,
      ...preview,
    };
  }

  async submitClaimPayment(
    dto: CreateClaimPaymentDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.claimPaymentNumber,
      );

    const { transaction, record } = await this.createClaimPaymentDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.claimPayloadService.buildClaimPaymentPayload({
      dto: resolvedDto,
      requestId: record.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: record.requestId,
      rootElement: this.claimPaymentRootElement,
      serviceType: this.claimPaymentServiceType,
      payload,
      errorLabel: 'Claim Payment',
    });

    record.currentAttemptId = submission.attempt.id;
    await this.claimRepository.save(record);

    return {
      transaction,
      record,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewClaimPaymentXml(
    dto: CreateClaimPaymentDto,
    includeSignature = true,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.claimPaymentNumber,
      );

    this.validateClaimPaymentPayload(resolvedDto);

    const requestId = await this.tiramisRequestIdService.generate('AIC');

    const payload = this.claimPayloadService.buildClaimPaymentPayload({
      dto: resolvedDto,
      requestId,
    });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.claimPaymentRootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.claimPaymentServiceType,
      rootElement: this.claimPaymentRootElement,
      requestId,
      payload,
      ...preview,
    };
  }

  async findByClaimRejectionNumber(claimRejectionNumber: string) {
    const claim =
      await this.claimRepository.findByClaimRejectionNumber(
        claimRejectionNumber,
      );

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim rejection not found');
    }

    return claim;
  }

  async createClaimRejectionDraft(
    dto:
      | CreateClaimRejectionDto
      | (CreateClaimRejectionDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.claimRejectionNumber,
            )
          ).dto;

    this.validateClaimRejectionPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId ||
      (await this.tiramisRequestIdService.generate('AIC'));

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimRejectionServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        (resolvedDto as any).sourceRecordId ||
        resolvedDto.claimRejectionNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.claimRejectionNumber,
      originalRequestId: requestId,
    });

    const claim = this.claimRepository.create({
      transactionId: transaction.id,
      requestId,
      claimType: 'CLAIM_REJECTION',
      serviceType: this.claimRejectionServiceType,
      rootElement: this.claimRejectionRootElement,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      claimRejectionNumber: resolvedDto.claimRejectionNumber,
      claimReferenceNumber: resolvedDto.claimReferenceNumber,
      claimIntimationNumber: resolvedDto.claimIntimationNumber,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      rejectionDate: new Date(resolvedDto.rejectionDate),
      rejectionReason: resolvedDto.rejectionReason,
      claimResultedLitigation: resolvedDto.claimResultedLitigation,
      claimAmount: resolvedDto.claimAmount,
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      claimants: resolvedDto.claimants as any,
      rawData: resolvedDto as any,
    });

    const savedClaim = await this.claimRepository.save(claim);

    return {
      transaction,
      record: savedClaim,
    };
  }

  async submitClaimRejection(
    dto: CreateClaimRejectionDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.claimRejectionNumber,
      );

    const { transaction, record } = await this.createClaimRejectionDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.claimPayloadService.buildClaimRejectionPayload({
      dto: resolvedDto,
      requestId: record.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: record.requestId,
      rootElement: this.claimRejectionRootElement,
      serviceType: this.claimRejectionServiceType,
      payload,
      errorLabel: 'Claim Rejection',
    });

    record.currentAttemptId = submission.attempt.id;
    await this.claimRepository.save(record);

    return {
      transaction,
      record,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewClaimRejectionXml(
    dto: CreateClaimRejectionDto,
    includeSignature = true,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.claimRejectionNumber,
      );

    this.validateClaimRejectionPayload(resolvedDto);

    const requestId = await this.tiramisRequestIdService.generate('AIC');

    const payload = this.claimPayloadService.buildClaimRejectionPayload({
      dto: resolvedDto,
      requestId,
    });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.claimRejectionRootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.claimRejectionServiceType,
      rootElement: this.claimRejectionRootElement,
      requestId,
      payload,
      ...preview,
    };
  }

  async findByClaimAssessmentNumber(claimAssessmentNumber: string) {
    const claim = await this.claimRepository.findByClaimAssessmentNumber(
      claimAssessmentNumber,
    );

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim assessment not found');
    }

    return claim;
  }

  async findByClaimReferenceNumber(claimReferenceNumber: string) {
    const claim =
      await this.claimRepository.findByClaimReferenceNumber(
        claimReferenceNumber,
      );

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim reference not found');
    }

    return claim;
  }

  validateClaimNotificationPayload(dto: CreateClaimNotificationDto) {
    this.assertValid(
      ClaimRegulatoryOperationType.NOTIFICATION,
      dto,
      'Claim Notification',
    );
  }

  private validateClaimAssessmentPayload(dto: CreateClaimAssessmentDto) {
    this.assertValid(
      ClaimRegulatoryOperationType.ASSESSMENT,
      dto,
      'Claim Assessment',
    );
  }

  private validateClaimIntimationPayload(dto: CreateClaimIntimationDto) {
    this.assertValid(
      ClaimRegulatoryOperationType.INTIMATION,
      dto,
      'Claim Intimation',
    );
  }

  private validateClaimPaymentPayload(dto: CreateClaimPaymentDto) {
    this.assertValid(
      ClaimRegulatoryOperationType.PAYMENT,
      dto,
      'Claim Payment',
    );
  }

  private validateClaimRejectionPayload(dto: CreateClaimRejectionDto) {
    this.assertValid(
      ClaimRegulatoryOperationType.REJECTION,
      dto,
      'Claim Rejection',
    );
  }

  private assertValid(
    type: ClaimRegulatoryOperationType,
    dto: object,
    label: string,
  ) {
    const errors = validateClaimTiramisPayload(
      type,
      dto as Record<string, unknown>,
    );

    if (errors.length > 0) {
      throw new BadRequestException({
        message: `${label} payload validation failed`,
        errors,
      });
    }
  }
}
