import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import {
  TIRAMIS_CLAIM_ROOT_ELEMENT,
  TIRAMIS_CLAIM_SERVICE_TYPE,
} from '../constants/tiramis-claim.constants';
import {
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimNotificationDto,
  CreateClaimPaymentDto,
  CreateClaimRejectionDto,
  CreateDischargeVoucherDto,
} from '../dto/create-claim.dto';
import { TiramisClaimRepository } from '../repositories/tiramis-claim.repository';
import { TiramisClaimPayloadService } from './tiramis-claim-payload.service';

@Injectable()
export class TiramisClaimService {
  constructor(
    private readonly claimRepository: TiramisClaimRepository,
    private readonly payloadService: TiramisClaimPayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly requestIdService: TiramisRequestIdService,
    private readonly submissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  submitClaimNotification(dto: CreateClaimNotificationDto) {
    return this.createAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_NOTIFICATION,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_NOTIFICATION,
      businessReference: dto.claimNotificationNumber,
      buildPayload: (requestId) =>
        this.payloadService.buildClaimNotification(dto, requestId),
      saveDraft: (requestId, transactionId) =>
        this.createNotificationDraft(dto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveNotification(record);
      },
    });
  }

  submitClaimIntimation(dto: CreateClaimIntimationDto) {
    return this.createAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_INTIMATION,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_INTIMATION,
      businessReference: dto.claimIntimationNumber,
      buildPayload: (requestId) =>
        this.payloadService.buildClaimIntimation(dto, requestId),
      saveDraft: (requestId, transactionId) =>
        this.createIntimationDraft(dto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveIntimation(record);
      },
    });
  }

  submitClaimAssessment(dto: CreateClaimAssessmentDto) {
    return this.createAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_ASSESSMENT,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_ASSESSMENT,
      businessReference: dto.claimAssessmentNumber,
      buildPayload: (requestId) =>
        this.payloadService.buildClaimAssessment(dto, requestId),
      saveDraft: (requestId, transactionId) =>
        this.createAssessmentDraft(dto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveAssessment(record);
      },
    });
  }

  submitDischargeVoucher(dto: CreateDischargeVoucherDto) {
    return this.createAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.DISCHARGE_VOUCHER,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.DISCHARGE_VOUCHER,
      businessReference: dto.dischargeVoucherNumber,
      buildPayload: (requestId) =>
        this.payloadService.buildDischargeVoucher(dto, requestId),
      saveDraft: (requestId, transactionId) =>
        this.createDischargeVoucherDraft(dto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveDischargeVoucher(record);
      },
    });
  }

  submitClaimPayment(dto: CreateClaimPaymentDto) {
    return this.createAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_PAYMENT,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_PAYMENT,
      businessReference: dto.claimPaymentNumber,
      buildPayload: (requestId) =>
        this.payloadService.buildClaimPayment(dto, requestId),
      saveDraft: (requestId, transactionId) =>
        this.createPaymentDraft(dto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.savePayment(record);
      },
    });
  }

  submitClaimRejection(dto: CreateClaimRejectionDto) {
    return this.createAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_REJECTION,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_REJECTION,
      businessReference: dto.claimRejectionNumber,
      buildPayload: (requestId) =>
        this.payloadService.buildClaimRejection(dto, requestId),
      saveDraft: (requestId, transactionId) =>
        this.createRejectionDraft(dto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveRejection(record);
      },
    });
  }

  async findClaimNotificationById(id: string) {
    const notification = await this.claimRepository.findNotificationById(id);

    if (!notification) {
      throw new NotFoundException('TIRAMIS claim notification not found');
    }

    return notification;
  }

  async findAllClaimNotifications() {
    return this.claimRepository.findAllNotifications();
  }

  async findClaimIntimationById(id: string) {
    const intimation = await this.claimRepository.findIntimationById(id);

    if (!intimation) {
      throw new NotFoundException('TIRAMIS claim intimation not found');
    }

    return intimation;
  }

  async findAllClaimIntimations() {
    return this.claimRepository.findAllIntimations();
  }

  async findClaimAssessmentById(id: string) {
    const assessment = await this.claimRepository.findAssessmentById(id);

    if (!assessment) {
      throw new NotFoundException('TIRAMIS claim assessment not found');
    }

    return assessment;
  }

  async findAllClaimAssessments() {
    return this.claimRepository.findAllAssessments();
  }

  async findClaimDischargeVoucherById(id: string) {
    const dischargeVoucher = await this.claimRepository.findDischargeVoucherById(id);

    if (!dischargeVoucher) {
      throw new NotFoundException('TIRAMIS discharge voucher not found');
    }

    return dischargeVoucher;
  }

  async findAllClaimDischargeVouchers() {
    return this.claimRepository.findAllDischargeVouchers();
  }

  private async createAndSubmit(params: {
    dto: any;
    serviceType: string;
    rootElement: string;
    businessReference: string;
    buildPayload: (requestId: string) => Record<string, any>;
    saveDraft: (requestId: string, transactionId: string) => Promise<any>;
    updateAttempt: (record: any, attemptId: string) => Promise<any>;
  }) {
    if (!params.businessReference) {
      throw new BadRequestException('Business reference is required');
    }

    const requestId = this.requestIdService.generate('AIC');

    const transaction = await this.submissionService.createTransaction({
      clientConfigurationId: params.dto.clientConfigurationId,
      serviceType: params.serviceType,
      sourceModule: params.dto.sourceModule || 'tiramis-claims',
      sourceRecordId: params.dto.sourceRecordId,
      businessReference: params.businessReference,
    });

    const record = await params.saveDraft(requestId, transaction.id);
    const payload = params.buildPayload(requestId);
    const contentXml = this.xmlBuilder.buildContentXml(
      params.rootElement,
      payload,
    );

    const pfxPaths = await this.tiramisConfigService.getPfxPaths(
      params.dto.environment,
    );

    const signature = this.signatureService.signXmlContent({
      contentXml,
      privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
      privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
    });

    const requestXml = this.xmlBuilder.buildSignedTiraMessage({
      rootName: params.rootElement,
      payload,
      signature,
    });

    const attempt = await this.submissionService.createAttempt({
      transactionId: transaction.id,
      requestId,
      rootElement: params.rootElement,
      requestXml,
      requestSignature: signature,
    });

    await params.updateAttempt(record, attempt.id);

    const endpoint = await this.tiramisConfigService.getFullEndpointUrl({
      environment: params.dto.environment,
      serviceType: params.serviceType,
    });

    const headers = await this.tiramisConfigService.getRequestHeaders(
      params.dto.environment,
    );

    await this.submissionService.markSent(requestId);

    const response = await this.httpClient.postXml({
      url: endpoint,
      xml: requestXml,
      headers,
    });

    return {
      record,
      transaction,
      attempt,
      tiraResponse: response,
    };
  }

  private createNotificationDraft(
    dto: CreateClaimNotificationDto,
    requestId: string,
    transactionId: string,
  ) {
    const entity = this.claimRepository.createNotification({
      transactionId,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      tranCompanyCode: dto.tranCompanyCode || null,
      claimNotificationNumber: dto.claimNotificationNumber,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      claimReportDate: new Date(dto.claimReportDate),
      claimFormDullyFilled: dto.claimFormDullyFilled || null,
      lossDate: new Date(dto.lossDate),
      lossNature: dto.lossNature || null,
      lossType: dto.lossType || null,
      lossLocation: dto.lossLocation || null,
      officerName: dto.officerName,
      officerTitle: dto.officerTitle,
    });

    return this.claimRepository.saveNotification(entity);
  }

  private createIntimationDraft(
    dto: CreateClaimIntimationDto,
    requestId: string,
    transactionId: string,
  ) {
    const entity = this.claimRepository.createIntimation({
      transactionId,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      claimIntimationNumber: dto.claimIntimationNumber,
      claimReferenceNumber: dto.claimReferenceNumber,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      claimIntimationDate: new Date(dto.claimIntimationDate),
      currencyCode: dto.currencyCode,
      exchangeRate: dto.exchangeRate,
      claimEstimatedAmount: dto.claimEstimatedAmount,
      claimReserveAmount: dto.claimReserveAmount,
      claimReserveMethod: dto.claimReserveMethod,
      lossAssessmentOption: dto.lossAssessmentOption,
      assessorName: dto.assessorName || null,
      assessorIdNumber: dto.assessorIdNumber || null,
      assessorIdType: dto.assessorIdType || null,
      claimants: this.mapClaimants(dto.claimants) as any,
    });

    return this.claimRepository.saveIntimation(entity);
  }

  private createAssessmentDraft(
    dto: CreateClaimAssessmentDto,
    requestId: string,
    transactionId: string,
  ) {
    const entity = this.claimRepository.createAssessment({
      transactionId,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      claimAssessmentNumber: dto.claimAssessmentNumber,
      claimIntimationNumber: dto.claimIntimationNumber,
      claimReferenceNumber: dto.claimReferenceNumber,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      assessmentReceivedDate: new Date(dto.assessmentReceivedDate),
      assessmentReportSummary: dto.assessmentReportSummary || null,
      currencyCode: dto.currencyCode,
      exchangeRate: dto.exchangeRate,
      assessmentAmount: dto.assessmentAmount,
      approvedClaimAmount: dto.approvedClaimAmount,
      claimApprovalDate: dto.claimApprovalDate
        ? new Date(dto.claimApprovalDate)
        : null,
      claimApprovalAuthority: dto.claimApprovalAuthority || null,
      isReAssessment: dto.isReAssessment || null,
      claimants: this.mapClaimants(dto.claimants || []) as any,
    });

    return this.claimRepository.saveAssessment(entity);
  }

  private createDischargeVoucherDraft(
    dto: CreateDischargeVoucherDto,
    requestId: string,
    transactionId: string,
  ) {
    const entity = this.claimRepository.createDischargeVoucher({
      transactionId,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      dischargeVoucherNumber: dto.dischargeVoucherNumber,
      claimAssessmentNumber: dto.claimAssessmentNumber,
      claimReferenceNumber: dto.claimReferenceNumber,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      dischargeVoucherDate: new Date(dto.dischargeVoucherDate),
      currencyCode: dto.currencyCode,
      exchangeRate: dto.exchangeRate,
      claimOfferCommunicationDate: dto.claimOfferCommunicationDate
        ? new Date(dto.claimOfferCommunicationDate)
        : null,
      claimOfferAmount: dto.claimOfferAmount,
      claimantResponseDate: dto.claimantResponseDate
        ? new Date(dto.claimantResponseDate)
        : null,
      adjustmentDate: dto.adjustmentDate ? new Date(dto.adjustmentDate) : null,
      adjustmentReason: dto.adjustmentReason || null,
      adjustmentAmount: dto.adjustmentAmount || null,
      reconciliationDate: dto.reconciliationDate
        ? new Date(dto.reconciliationDate)
        : null,
      reconciliationSummary: dto.reconciliationSummary || null,
      reconciledAmount: dto.reconciledAmount || null,
      offerAccepted: dto.offerAccepted || null,
      claimants: this.mapClaimants(dto.claimants || []) as any,
    });

    return this.claimRepository.saveDischargeVoucher(entity);
  }

  private createPaymentDraft(
    dto: CreateClaimPaymentDto,
    requestId: string,
    transactionId: string,
  ) {
    const entity = this.claimRepository.createPayment({
      transactionId,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      claimPaymentNumber: dto.claimPaymentNumber,
      claimReferenceNumber: dto.claimReferenceNumber,
      claimIntimationNumber: dto.claimIntimationNumber,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      paymentDate: new Date(dto.paymentDate),
      paidAmount: dto.paidAmount,
      paymentMode: dto.paymentMode,
      partiesNotified: dto.partiesNotified || null,
      netPremiumEarned: dto.netPremiumEarned || null,
      claimResultedLitigation: dto.claimResultedLitigation || null,
      litigationReason: dto.litigationReason || null,
      currencyCode: dto.currencyCode,
      exchangeRate: dto.exchangeRate,
      claimants: this.mapClaimants(dto.claimants || []) as any,
    });

    return this.claimRepository.savePayment(entity);
  }

  private createRejectionDraft(
    dto: CreateClaimRejectionDto,
    requestId: string,
    transactionId: string,
  ) {
    const entity = this.claimRepository.createRejection({
      transactionId,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      claimRejectionNumber: dto.claimRejectionNumber,
      claimReferenceNumber: dto.claimReferenceNumber,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      rejectionDate: new Date(dto.rejectionDate),
      rejectionReason: dto.rejectionReason,
      claimants: this.mapClaimants(dto.claimants || []) as any,
    });

    return this.claimRepository.saveRejection(entity);
  }

  private mapClaimants(claimants: any[]) {
    return claimants.map((claimant) => ({
      claimantName: claimant.claimantName,
      claimantBirthDate: claimant.claimantBirthDate
        ? new Date(claimant.claimantBirthDate)
        : null,
      claimantCategory: claimant.claimantCategory,
      claimantType: claimant.claimantType,
      claimantIdNumber: claimant.claimantIdNumber,
      claimantIdType: claimant.claimantIdType,
      gender: claimant.gender || null,
      countryCode: claimant.countryCode,
      region: claimant.region,
      district: claimant.district,
      street: claimant.street || null,
      claimantPhoneNumber: claimant.claimantPhoneNumber,
      claimantFax: claimant.claimantFax || null,
      postalAddress: claimant.postalAddress || null,
      emailAddress: claimant.emailAddress || null,
    }));
  }
}
