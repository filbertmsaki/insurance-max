import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  TiramisConfigService,
  type TiramisResolvedRequestDtoFields,
} from '../../config/services/tiramis-config.service';
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
    return this.resolveAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_NOTIFICATION,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_NOTIFICATION,
      businessReference: dto.claimNotificationNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildClaimNotification(resolvedDto, requestId),
      saveDraft: (resolvedDto, requestId, transactionId) =>
        this.createNotificationDraft(resolvedDto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveNotification(record);
      },
    });
  }

  submitClaimIntimation(dto: CreateClaimIntimationDto) {
    return this.resolveAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_INTIMATION,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_INTIMATION,
      businessReference: dto.claimIntimationNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildClaimIntimation(resolvedDto, requestId),
      saveDraft: (resolvedDto, requestId, transactionId) =>
        this.createIntimationDraft(resolvedDto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveIntimation(record);
      },
    });
  }

  submitClaimAssessment(dto: CreateClaimAssessmentDto) {
    return this.resolveAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_ASSESSMENT,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_ASSESSMENT,
      businessReference: dto.claimAssessmentNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildClaimAssessment(resolvedDto, requestId),
      saveDraft: (resolvedDto, requestId, transactionId) =>
        this.createAssessmentDraft(resolvedDto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveAssessment(record);
      },
    });
  }

  submitDischargeVoucher(dto: CreateDischargeVoucherDto) {
    return this.resolveAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.DISCHARGE_VOUCHER,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.DISCHARGE_VOUCHER,
      businessReference: dto.dischargeVoucherNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildDischargeVoucher(resolvedDto, requestId),
      saveDraft: (resolvedDto, requestId, transactionId) =>
        this.createDischargeVoucherDraft(resolvedDto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.saveDischargeVoucher(record);
      },
    });
  }

  submitClaimPayment(dto: CreateClaimPaymentDto) {
    return this.resolveAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_PAYMENT,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_PAYMENT,
      businessReference: dto.claimPaymentNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildClaimPayment(resolvedDto, requestId),
      saveDraft: (resolvedDto, requestId, transactionId) =>
        this.createPaymentDraft(resolvedDto, requestId, transactionId),
      updateAttempt: (record, attemptId) => {
        record.currentAttemptId = attemptId;
        return this.claimRepository.savePayment(record);
      },
    });
  }

  submitClaimRejection(dto: CreateClaimRejectionDto) {
    return this.resolveAndSubmit({
      dto,
      serviceType: TIRAMIS_CLAIM_SERVICE_TYPE.CLAIM_REJECTION,
      rootElement: TIRAMIS_CLAIM_ROOT_ELEMENT.CLAIM_REJECTION,
      businessReference: dto.claimRejectionNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildClaimRejection(resolvedDto, requestId),
      saveDraft: (resolvedDto, requestId, transactionId) =>
        this.createRejectionDraft(resolvedDto, requestId, transactionId),
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

  async findClaimNotificationByRequestId(requestId: string) {
    const notification =
      await this.claimRepository.findNotificationByRequestId(requestId);

    if (!notification) {
      throw new NotFoundException('TIRAMIS claim notification not found');
    }

    return notification;
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

  async findClaimIntimationByRequestId(requestId: string) {
    const intimation =
      await this.claimRepository.findIntimationByRequestId(requestId);

    if (!intimation) {
      throw new NotFoundException('TIRAMIS claim intimation not found');
    }

    return intimation;
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

  async findClaimAssessmentByRequestId(requestId: string) {
    const assessment =
      await this.claimRepository.findAssessmentByRequestId(requestId);

    if (!assessment) {
      throw new NotFoundException('TIRAMIS claim assessment not found');
    }

    return assessment;
  }

  async findClaimDischargeVoucherById(id: string) {
    const dischargeVoucher =
      await this.claimRepository.findDischargeVoucherById(id);

    if (!dischargeVoucher) {
      throw new NotFoundException('TIRAMIS discharge voucher not found');
    }

    return dischargeVoucher;
  }

  async findAllClaimDischargeVouchers() {
    return this.claimRepository.findAllDischargeVouchers();
  }

  async findClaimDischargeVoucherByRequestId(requestId: string) {
    const dischargeVoucher =
      await this.claimRepository.findDischargeVoucherByRequestId(requestId);

    if (!dischargeVoucher) {
      throw new NotFoundException('TIRAMIS discharge voucher not found');
    }

    return dischargeVoucher;
  }

  async findClaimPaymentById(id: string) {
    const payment = await this.claimRepository.findPaymentById(id);

    if (!payment) {
      throw new NotFoundException('TIRAMIS claim payment not found');
    }

    return payment;
  }

  async findAllClaimPayments() {
    return this.claimRepository.findAllPayments();
  }

  async findClaimPaymentByRequestId(requestId: string) {
    const payment =
      await this.claimRepository.findPaymentByRequestId(requestId);

    if (!payment) {
      throw new NotFoundException('TIRAMIS claim payment not found');
    }

    return payment;
  }

  async findClaimRejectionByRequestId(requestId: string) {
    const rejection =
      await this.claimRepository.findRejectionByRequestId(requestId);

    if (!rejection) {
      throw new NotFoundException('TIRAMIS claim rejection not found');
    }

    return rejection;
  }

  async findClaimRejectionById(id: string) {
    const rejection = await this.claimRepository.findRejectionById(id);

    if (!rejection) {
      throw new NotFoundException('TIRAMIS claim rejection not found');
    }

    return rejection;
  }

  async findAllClaimRejections() {
    return this.claimRepository.findAllRejections();
  }

  private async resolveAndSubmit(params: {
    dto: any;
    serviceType: string;
    rootElement: string;
    businessReference: string;
    buildPayload: (dto: any, requestId: string) => Record<string, any>;
    saveDraft: (
      dto: any,
      requestId: string,
      transactionId: string,
    ) => Promise<any>;
    updateAttempt: (record: any, attemptId: string) => Promise<any>;
  }) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        params.dto,
        params.businessReference,
      );

    return this.createAndSubmit({
      ...params,
      configuration,
      dto: resolvedDto,
    });
  }

  private async createAndSubmit(params: {
    dto: any;
    configuration: Awaited<
      ReturnType<TiramisConfigService['getActiveRuntimeConfiguration']>
    >;
    serviceType: string;
    rootElement: string;
    businessReference: string;
    buildPayload: (
      dto:
        | (CreateClaimNotificationDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimIntimationDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimAssessmentDto & TiramisResolvedRequestDtoFields)
        | (CreateDischargeVoucherDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimPaymentDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimRejectionDto & TiramisResolvedRequestDtoFields),
      requestId: string,
    ) => Record<string, any>;
    saveDraft: (
      dto:
        | (CreateClaimNotificationDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimIntimationDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimAssessmentDto & TiramisResolvedRequestDtoFields)
        | (CreateDischargeVoucherDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimPaymentDto & TiramisResolvedRequestDtoFields)
        | (CreateClaimRejectionDto & TiramisResolvedRequestDtoFields),
      requestId: string,
      transactionId: string,
    ) => Promise<any>;
    updateAttempt: (record: any, attemptId: string) => Promise<any>;
  }) {
    if (!params.businessReference) {
      throw new BadRequestException('Business reference is required');
    }

    const requestId = this.requestIdService.generate('AIC');

    const transaction = await this.submissionService.createTransaction({
      clientConfigurationId: params.dto.clientConfigurationId,
      serviceType: params.serviceType,
      sourceModule: 'tiramis-claims',
      sourceRecordId: params.dto.sourceRecordId,
      businessReference: params.businessReference,
    });

    const record = await params.saveDraft(
      params.dto,
      requestId,
      transaction.id,
    );
    const payload = params.buildPayload(params.dto, requestId);
    const contentXml = this.xmlBuilder.buildContentXml(
      params.rootElement,
      payload,
    );

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        params.configuration,
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

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration: params.configuration,
        serviceType: params.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        params.configuration,
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
    dto: CreateClaimNotificationDto & TiramisResolvedRequestDtoFields,
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
    dto: CreateClaimIntimationDto & TiramisResolvedRequestDtoFields,
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
    dto: CreateClaimAssessmentDto & TiramisResolvedRequestDtoFields,
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
    dto: CreateDischargeVoucherDto & TiramisResolvedRequestDtoFields,
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
    dto: CreateClaimPaymentDto & TiramisResolvedRequestDtoFields,
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
    dto: CreateClaimRejectionDto & TiramisResolvedRequestDtoFields,
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
