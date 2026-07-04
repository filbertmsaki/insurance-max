import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

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

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimNotificationServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
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

    const { transaction, record } =
      await this.createClaimNotificationDraft(resolvedDto, sourceMetadata);

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

    const requestId = this.tiramisRequestIdService.generate('AIC');

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

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimIntimationServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.claimIntimationNumber,
      businessReference:
        sourceMetadata?.businessReference ||
        resolvedDto.claimIntimationNumber,
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

    const requestId = this.tiramisRequestIdService.generate('AIC');

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
    const claim = await this.claimRepository.findByClaimPaymentNumber(
      claimPaymentNumber,
    );

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

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimPaymentServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
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

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimAssessmentServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.claimAssessmentNumber,
      businessReference:
        sourceMetadata?.businessReference ||
        resolvedDto.claimAssessmentNumber,
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

    const requestId = this.tiramisRequestIdService.generate('AIC');

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

    const requestId = this.tiramisRequestIdService.generate('AIC');

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
    const claim = await this.claimRepository.findByClaimRejectionNumber(
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

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.claimRejectionServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        (resolvedDto as any).sourceRecordId ||
        resolvedDto.claimRejectionNumber,
      businessReference:
        sourceMetadata?.businessReference ||
        resolvedDto.claimRejectionNumber,
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

    const requestId = this.tiramisRequestIdService.generate('AIC');

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
    const claim = await this.claimRepository.findByClaimReferenceNumber(
      claimReferenceNumber,
    );

    if (!claim) {
      throw new NotFoundException('TIRAMIS claim reference not found');
    }

    return claim;
  }

  validateClaimNotificationPayload(dto: CreateClaimNotificationDto) {
    const errors: string[] = [];

    this.requireString(
      dto.claimNotificationNumber,
      'claimNotificationNumber',
      errors,
    );

    this.requireString(
      dto.coverNoteReferenceNumber,
      'coverNoteReferenceNumber',
      errors,
    );

    this.requireDate(dto.claimReportDate, 'claimReportDate', errors);

    this.requireString(
      dto.claimFormDullyFilled,
      'claimFormDullyFilled',
      errors,
    );

    if (
      dto.claimFormDullyFilled &&
      !['Y', 'N'].includes(String(dto.claimFormDullyFilled).toUpperCase())
    ) {
      errors.push('claimFormDullyFilled must be Y or N');
    }

    this.requireDate(dto.lossDate, 'lossDate', errors);
    this.requireString(dto.lossNature, 'lossNature', errors);
    this.requireString(dto.lossType, 'lossType', errors);
    this.requireString(dto.lossLocation, 'lossLocation', errors);
    this.requireString(dto.officerName, 'officerName', errors);
    this.requireString(dto.officerTitle, 'officerTitle', errors);

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Claim Notification payload validation failed',
        errors,
      });
    }
  }

  private validateClaimAssessmentPayload(dto: CreateClaimAssessmentDto) {
    const errors: string[] = [];

    this.requireString(
      dto.claimAssessmentNumber,
      'claimAssessmentNumber',
      errors,
    );
    this.requireString(
      dto.claimIntimationNumber,
      'claimIntimationNumber',
      errors,
    );
    this.requireString(dto.claimReferenceNumber, 'claimReferenceNumber', errors);
    this.requireString(
      dto.coverNoteReferenceNumber,
      'coverNoteReferenceNumber',
      errors,
    );

    this.requireDate(dto.assessmentReceivedDate, 'assessmentReceivedDate', errors);
    this.requireString(
      dto.assessmentReportSummary,
      'assessmentReportSummary',
      errors,
    );

    this.requireString(dto.currencyCode, 'currencyCode', errors);

    if (dto.currencyCode && String(dto.currencyCode).length !== 3) {
      errors.push('currencyCode must be a 3-letter code, example: TZS');
    }

    this.requireString(dto.exchangeRate, 'exchangeRate', errors);
    this.requireString(dto.assessmentAmount, 'assessmentAmount', errors);
    this.requireString(dto.approvedClaimAmount, 'approvedClaimAmount', errors);

    this.requireDate(dto.claimApprovalDate, 'claimApprovalDate', errors);
    this.requireString(
      dto.claimApprovalAuthority,
      'claimApprovalAuthority',
      errors,
    );

    this.requireString(dto.isReAssessment, 'isReAssessment', errors);

    if (
      dto.isReAssessment &&
      !['Y', 'N'].includes(String(dto.isReAssessment).toUpperCase())
    ) {
      errors.push('isReAssessment must be Y or N');
    }

    if (!dto.claimants || !Array.isArray(dto.claimants) || dto.claimants.length === 0) {
      errors.push('claimants must contain at least one claimant');
    }

    dto.claimants?.forEach((claimant, index) => {
      const path = `claimants[${index}]`;

      if (
        claimant.claimantCategory === null ||
        claimant.claimantCategory === undefined
      ) {
        errors.push(`${path}.claimantCategory is required`);
      }

      if (
        claimant.claimantType === null ||
        claimant.claimantType === undefined
      ) {
        errors.push(`${path}.claimantType is required`);
      }

      this.requireString(
        claimant.claimantIdNumber,
        `${path}.claimantIdNumber`,
        errors,
      );

      if (
        claimant.claimantIdType === null ||
        claimant.claimantIdType === undefined
      ) {
        errors.push(`${path}.claimantIdType is required`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Claim Assessment payload validation failed',
        errors,
      });
    }
  }

  private validateClaimIntimationPayload(dto: CreateClaimIntimationDto) {
    const errors: string[] = [];

    this.requireString(
      dto.claimIntimationNumber,
      'claimIntimationNumber',
      errors,
    );
    this.requireString(dto.claimReferenceNumber, 'claimReferenceNumber', errors);
    this.requireString(
      dto.coverNoteReferenceNumber,
      'coverNoteReferenceNumber',
      errors,
    );

    this.requireDate(dto.claimIntimationDate, 'claimIntimationDate', errors);

    this.requireString(dto.currencyCode, 'currencyCode', errors);

    if (dto.currencyCode && String(dto.currencyCode).length !== 3) {
      errors.push('currencyCode must be a 3-letter code, example: TZS');
    }

    this.requireString(dto.exchangeRate, 'exchangeRate', errors);
    this.requireString(dto.claimEstimatedAmount, 'claimEstimatedAmount', errors);
    this.requireString(dto.claimReserveAmount, 'claimReserveAmount', errors);
    this.requireString(dto.claimReserveMethod, 'claimReserveMethod', errors);

    if (
      dto.lossAssessmentOption === null ||
      dto.lossAssessmentOption === undefined
    ) {
      errors.push('lossAssessmentOption is required');
    }

    if (
      dto.lossAssessmentOption &&
      ![1, 2].includes(Number(dto.lossAssessmentOption))
    ) {
      errors.push('lossAssessmentOption must be 1 or 2');
    }

    this.requireString(dto.assessorName, 'assessorName', errors);
    this.requireString(dto.assessorIdNumber, 'assessorIdNumber', errors);

    if (dto.assessorIdType === null || dto.assessorIdType === undefined) {
      errors.push('assessorIdType is required');
    }

    if (!dto.claimants || !Array.isArray(dto.claimants) || dto.claimants.length === 0) {
      errors.push('claimants must contain at least one claimant');
    }

    dto.claimants?.forEach((claimant, index) => {
      const path = `claimants[${index}]`;

      this.requireString(claimant.claimantName, `${path}.claimantName`, errors);
      this.requireString(claimant.countryCode, `${path}.countryCode`, errors);

      if (claimant.countryCode && claimant.countryCode.length !== 3) {
        errors.push(`${path}.countryCode must be a 3-letter ISO alpha-3 code`);
      }

      this.requireString(claimant.district, `${path}.district`, errors);
      this.requireString(
        claimant.claimantPhoneNumber,
        `${path}.claimantPhoneNumber`,
        errors,
      );

      if (
        claimant.gender &&
        !['M', 'F'].includes(String(claimant.gender).toUpperCase())
      ) {
        errors.push(`${path}.gender must be M or F`);
      }

      if (
        claimant.claimantBirthDate &&
        Number.isNaN(new Date(claimant.claimantBirthDate).getTime())
      ) {
        errors.push(`${path}.claimantBirthDate must be a valid date`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Claim Intimation payload validation failed',
        errors,
      });
    }
  }

  private validateClaimPaymentPayload(dto: CreateClaimPaymentDto) {
    const errors: string[] = [];

    this.requireString(dto.claimPaymentNumber, 'claimPaymentNumber', errors);
    this.requireString(dto.claimReferenceNumber, 'claimReferenceNumber', errors);
    this.requireString(
      dto.claimIntimationNumber,
      'claimIntimationNumber',
      errors,
    );
    this.requireString(
      dto.coverNoteReferenceNumber,
      'coverNoteReferenceNumber',
      errors,
    );

    this.requireDate(dto.paymentDate, 'paymentDate', errors);
    this.requireString(dto.paidAmount, 'paidAmount', errors);
    this.requireString(dto.paymentMode, 'paymentMode', errors);

    if (dto.paymentMode && !['1', '2', '3'].includes(String(dto.paymentMode))) {
      errors.push('paymentMode must be 1, 2, or 3');
    }

    this.requireString(dto.partiesNotified, 'partiesNotified', errors);

    if (
      dto.partiesNotified &&
      !['Y', 'N'].includes(String(dto.partiesNotified).toUpperCase())
    ) {
      errors.push('partiesNotified must be Y or N');
    }

    this.requireString(dto.netPremiumEarned, 'netPremiumEarned', errors);

    this.requireString(
      dto.claimResultedLitigation,
      'claimResultedLitigation',
      errors,
    );

    if (
      dto.claimResultedLitigation &&
      !['Y', 'N'].includes(String(dto.claimResultedLitigation).toUpperCase())
    ) {
      errors.push('claimResultedLitigation must be Y or N');
    }

    this.requireString(dto.litigationReason, 'litigationReason', errors);
    this.requireString(dto.currencyCode, 'currencyCode', errors);

    if (dto.currencyCode && String(dto.currencyCode).length !== 3) {
      errors.push('currencyCode must be a 3-letter code, example: TZS');
    }

    this.requireString(dto.exchangeRate, 'exchangeRate', errors);

    if (
      !dto.claimants ||
      !Array.isArray(dto.claimants) ||
      dto.claimants.length === 0
    ) {
      errors.push('claimants must contain at least one claimant');
    }

    dto.claimants?.forEach((claimant, index) => {
      const path = `claimants[${index}]`;

      if (
        claimant.claimantCategory === null ||
        claimant.claimantCategory === undefined
      ) {
        errors.push(`${path}.claimantCategory is required`);
      }

      if (claimant.claimantType === null || claimant.claimantType === undefined) {
        errors.push(`${path}.claimantType is required`);
      }

      this.requireString(
        claimant.claimantIdNumber,
        `${path}.claimantIdNumber`,
        errors,
      );

      if (
        claimant.claimantIdType === null ||
        claimant.claimantIdType === undefined
      ) {
        errors.push(`${path}.claimantIdType is required`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Claim Payment payload validation failed',
        errors,
      });
    }
  }

  private validateClaimRejectionPayload(dto: CreateClaimRejectionDto) {
    const errors: string[] = [];

    this.requireString(
      dto.claimRejectionNumber,
      'claimRejectionNumber',
      errors,
    );
    this.requireString(dto.claimReferenceNumber, 'claimReferenceNumber', errors);
    this.requireString(
      dto.claimIntimationNumber,
      'claimIntimationNumber',
      errors,
    );
    this.requireString(
      dto.coverNoteReferenceNumber,
      'coverNoteReferenceNumber',
      errors,
    );

    this.requireDate(dto.rejectionDate, 'rejectionDate', errors);
    this.requireString(dto.rejectionReason, 'rejectionReason', errors);

    if (dto.rejectionReason && String(dto.rejectionReason).length > 100) {
      errors.push('rejectionReason must not exceed 100 characters');
    }

    this.requireString(
      dto.claimResultedLitigation,
      'claimResultedLitigation',
      errors,
    );

    if (
      dto.claimResultedLitigation &&
      !['Y', 'N'].includes(String(dto.claimResultedLitigation).toUpperCase())
    ) {
      errors.push('claimResultedLitigation must be Y or N');
    }

    this.requireString(dto.claimAmount, 'claimAmount', errors);
    this.requireString(dto.currencyCode, 'currencyCode', errors);

    if (dto.currencyCode && String(dto.currencyCode).length !== 3) {
      errors.push('currencyCode must be a 3-letter code, example: TZS');
    }

    this.requireString(dto.exchangeRate, 'exchangeRate', errors);

    if (
      !dto.claimants ||
      !Array.isArray(dto.claimants) ||
      dto.claimants.length === 0
    ) {
      errors.push('claimants must contain at least one claimant');
    }

    dto.claimants?.forEach((claimant, index) => {
      const path = `claimants[${index}]`;

      if (
        claimant.claimantCategory === null ||
        claimant.claimantCategory === undefined
      ) {
        errors.push(`${path}.claimantCategory is required`);
      }

      if (claimant.claimantType === null || claimant.claimantType === undefined) {
        errors.push(`${path}.claimantType is required`);
      }

      this.requireString(
        claimant.claimantIdNumber,
        `${path}.claimantIdNumber`,
        errors,
      );

      if (
        claimant.claimantIdType === null ||
        claimant.claimantIdType === undefined
      ) {
        errors.push(`${path}.claimantIdType is required`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Claim Rejection payload validation failed',
        errors,
      });
    }
  }

  private requireString(value: unknown, fieldName: string, errors: string[]) {
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      errors.push(`${fieldName} is required`);
    }
  }

  private requireDate(value: unknown, fieldName: string, errors: string[]) {
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      errors.push(`${fieldName} is required`);
      return;
    }

    const date = new Date(value as any);

    if (Number.isNaN(date.getTime())) {
      errors.push(`${fieldName} must be a valid date`);
    }
  }
}
