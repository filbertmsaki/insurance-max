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
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import {
  TIRAMIS_VERIFICATION_ROOT_ELEMENT,
  TIRAMIS_VERIFICATION_SERVICE_TYPE,
  TIRAMIS_VERIFICATION_STATUS,
  TIRAMIS_VERIFICATION_TYPE,
} from '../constants/tiramis-verification.constants';
import {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  DetailsVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';
import { TiramisVerificationRepository } from '../repositories/tiramis-verification.repository';
import { TiramisVerificationPayloadService } from './tiramis-verification-payload.service';

@Injectable()
export class TiramisVerificationService {
  constructor(
    private readonly verificationRepository: TiramisVerificationRepository,
    private readonly payloadService: TiramisVerificationPayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly requestIdService: TiramisRequestIdService,
    private readonly submissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  verifyCoverNote(dto: CoverNoteVerificationDto) {
    if (
      !dto.coverNoteReferenceNumber &&
      !dto.stickerNumber &&
      !dto.motorRegistrationNumber &&
      !dto.motorChassisNumber
    ) {
      throw new BadRequestException(
        'At least one search value is required for cover note verification',
      );
    }

    return this.resolveAndSubmit({
      dto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.COVER_NOTE,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.COVER_NOTE_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.COVER_NOTE,
      businessReference:
        dto.coverNoteReferenceNumber ||
        dto.stickerNumber ||
        dto.motorRegistrationNumber ||
        dto.motorChassisNumber ||
        'COVER_NOTE_VERIFICATION',
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildCoverNoteVerification(resolvedDto, requestId),
    });
  }

  verifyNin(dto: NinVerificationDto) {
    if (!dto.nin) {
      throw new BadRequestException('NIN is required');
    }

    return this.resolveAndSubmit({
      dto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.NIN,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.NIN_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.NIN,
      businessReference: dto.nin,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildNinVerification(resolvedDto, requestId),
    });
  }

  verifyCompany(dto: CompanyVerificationDto) {
    if (!dto.incorporationCertificateNumber) {
      throw new BadRequestException(
        'IncorporationCertificateNumber is required',
      );
    }

    return this.resolveAndSubmit({
      dto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.COMPANY,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.COMPANY_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.COMPANY,
      businessReference: dto.incorporationCertificateNumber,
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildCompanyVerification(resolvedDto, requestId),
    });
  }

  verifyMotor(dto: MotorVerificationDto) {
    if (!dto.motorRegistrationNumber && !dto.motorChassisNumber) {
      throw new BadRequestException(
        'RegistrationNumber or ChassisNumber is required',
      );
    }

    return this.resolveAndSubmit({
      dto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.MOTOR,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.MOTOR_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.MOTOR,
      businessReference:
        dto.motorRegistrationNumber ||
        dto.motorChassisNumber ||
        'MOTOR_VERIFICATION',
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildMotorVerification(resolvedDto, requestId),
    });
  }

  verifyDetails(dto: DetailsVerificationDto) {
    if (
      !dto.motorRegistrationNumber &&
      !dto.motorChassisNumber &&
      !dto.coverNoteReferenceNumber &&
      !dto.stickerNumber
    ) {
      throw new BadRequestException(
        'At least one detail verification search value is required',
      );
    }

    return this.resolveAndSubmit({
      dto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.DETAILS,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.DETAILS_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.DETAILS,
      businessReference:
        dto.motorRegistrationNumber ||
        dto.motorChassisNumber ||
        dto.coverNoteReferenceNumber ||
        dto.stickerNumber ||
        'DETAILS_VERIFICATION',
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildDetailsVerification(resolvedDto, requestId),
    });
  }

  async findByRequestId(requestId: string) {
    const request =
      await this.verificationRepository.findRequestByRequestId(requestId);

    if (!request) {
      throw new NotFoundException('TIRAMIS verification request not found');
    }

    return request;
  }

  private async resolveAndSubmit(params: {
    dto: any;
    verificationType: string;
    serviceType: string;
    rootElement: string;
    businessReference: string;
    buildPayload: (dto: any, requestId: string) => Record<string, any>;
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
    configuration: Awaited<ReturnType<TiramisConfigService['getActiveRuntimeConfiguration']>>;
    verificationType: string;
    serviceType: string;
    rootElement: string;
    businessReference: string;
    buildPayload: (dto: any, requestId: string) => Record<string, any>;
  }) {
    const requestId = this.requestIdService.generate('AIC');

    const transaction = await this.submissionService.createTransaction({
      clientConfigurationId: params.dto.clientConfigurationId,
      serviceType: params.serviceType,
      sourceModule: 'tiramis-verifications',
      sourceRecordId: params.dto.sourceRecordId,
      businessReference: params.businessReference,
    });

    const payload = params.buildPayload(params.dto, requestId);

    const contentXml = this.xmlBuilder.buildContentXml(
      params.rootElement,
      payload,
    );

    const pfxPaths = await this.tiramisConfigService.getPfxPathsForConfiguration(
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

    const requestEntity = this.verificationRepository.createRequest({
      transactionId: transaction.id,
      attemptId: attempt.id,
      verificationType: params.verificationType,
      requestId,
      companyCode: params.dto.companyCode,
      systemCode: params.dto.systemCode,
      coverNoteReferenceNumber: params.dto.coverNoteReferenceNumber || null,
      stickerNumber: params.dto.stickerNumber || null,
      motorRegistrationNumber: params.dto.motorRegistrationNumber || null,
      motorChassisNumber: params.dto.motorChassisNumber || null,
      nin: params.dto.nin || null,
      incorporationCertificateNumber:
        params.dto.incorporationCertificateNumber || null,
      rawRequestXml: requestXml,
      requestSignature: signature,
      status: TIRAMIS_VERIFICATION_STATUS.PENDING,
    });

    const savedRequest =
      await this.verificationRepository.saveRequest(requestEntity);

    const endpoint = await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
      configuration: params.configuration,
      serviceType: params.serviceType,
    });

    const headers = await this.tiramisConfigService.getRequestHeadersForConfiguration(
      params.configuration,
    );

    await this.submissionService.markSent(requestId);

    savedRequest.status = TIRAMIS_VERIFICATION_STATUS.SENT;
    await this.verificationRepository.saveRequest(savedRequest);

    const httpResponse = await this.httpClient.postXml({
      url: endpoint,
      xml: requestXml,
      headers,
    });

    const parsedMessage = this.xmlParser.parseTiraMessage(httpResponse.rawXml);
    const content = parsedMessage.content || {};
    const verificationHdr = (content as any).VerificationHdr || content;

    const responseId = (verificationHdr as any).ResponseId || null;
    const statusCode =
      (verificationHdr as any).ResponseStatusCode ||
      (content as any).ResponseStatusCode ||
      null;

    const statusDesc =
      (verificationHdr as any).ResponseStatusDesc ||
      (content as any).ResponseStatusDesc ||
      null;

    const isSuccess = statusCode
      ? await this.tiramisConfigService.isSuccessResponse(statusCode)
      : false;

    const responseEntity = this.verificationRepository.createResponse({
      verificationRequestId: savedRequest.id,
      responseId,
      requestId,
      responseStatusCode: statusCode,
      responseStatusDesc: statusDesc,
      rawResponseXml: httpResponse.rawXml,
      responseSignature: parsedMessage.signature,
      responsePayload: JSON.stringify(content),
      respondedAt: new Date(),
    });

    const savedResponse =
      await this.verificationRepository.saveResponse(responseEntity);

    savedRequest.status = isSuccess
      ? TIRAMIS_VERIFICATION_STATUS.SUCCESS
      : TIRAMIS_VERIFICATION_STATUS.FAILED;

    await this.verificationRepository.saveRequest(savedRequest);

    await this.submissionService.markFinalResponseReceived({
      requestId,
      responseId: responseId || undefined,
      statusCode: statusCode || 'UNKNOWN',
      statusDesc: statusDesc || undefined,
      rawXml: httpResponse.rawXml,
      responseSignature: parsedMessage.signature || undefined,
      isSuccess,
    });

    return {
      request: savedRequest,
      response: savedResponse,
      transaction,
      attempt,
      tiraHttpResponse: {
        statusCode: httpResponse.statusCode,
        statusText: httpResponse.statusText,
      },
    };
  }
}
