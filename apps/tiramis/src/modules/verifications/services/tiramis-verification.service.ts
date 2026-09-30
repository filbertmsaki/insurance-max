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
  isMotorCategory,
} from '../constants/tiramis-verification.constants';
import {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
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
    const normalizedDto = this.normalizeCoverNoteVerificationDto(dto);

    return this.resolveAndSubmit({
      dto: normalizedDto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.COVER_NOTE,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.COVER_NOTE_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.COVER_NOTE,
      businessReference:
        normalizedDto.coverNoteReferenceNumber ||
        normalizedDto.stickerNumber ||
        normalizedDto.motorRegistrationNumber ||
        normalizedDto.motorChassisNumber ||
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
    const normalizedDto = this.normalizeMotorVerificationDto(dto);

    return this.resolveAndSubmit({
      dto: normalizedDto,
      verificationType: TIRAMIS_VERIFICATION_TYPE.MOTOR,
      serviceType: TIRAMIS_VERIFICATION_SERVICE_TYPE.MOTOR_VERIFICATION,
      rootElement: TIRAMIS_VERIFICATION_ROOT_ELEMENT.MOTOR,
      businessReference:
        normalizedDto.motorRegistrationNumber ||
        normalizedDto.motorChassisNumber ||
        'MOTOR_VERIFICATION',
      buildPayload: (resolvedDto, requestId) =>
        this.payloadService.buildMotorVerification(resolvedDto, requestId),
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
    configuration: Awaited<
      ReturnType<TiramisConfigService['getActiveRuntimeConfiguration']>
    >;
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
      portalWebhookUrl: params.dto.portalWebhookUrl,
      businessReference: params.businessReference,
    });

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

    const requestXml = this.xmlBuilder.buildSignedTiraMessageFromContent({
      contentXml,
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
      motorCategory: params.dto.motorCategory,
      nin: params.dto.nin || null,
      incorporationCertificateNumber:
        params.dto.incorporationCertificateNumber || null,
      rawRequestXml: requestXml,
      requestSignature: signature,
      status: TIRAMIS_VERIFICATION_STATUS.PENDING,
    });

    const savedRequest =
      await this.verificationRepository.saveRequest(requestEntity);

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

    savedRequest.status = TIRAMIS_VERIFICATION_STATUS.SENT;
    await this.verificationRepository.saveRequest(savedRequest);

    let httpResponse;

    try {
      httpResponse = await this.httpClient.postXml({
        requestId,
        url: endpoint,
        xml: requestXml,
        headers,
        logRequest: false,
      });
    } catch (error: any) {
      const failedAttempt = await this.submissionService.markFailed({
        requestId,
        errorMessage: error?.message || 'Failed to communicate with TIRAMIS',
        rawPayload: error?.response?.data || null,
        isRetryable: true,
      });

      savedRequest.status = TIRAMIS_VERIFICATION_STATUS.FAILED;
      await this.verificationRepository.saveRequest(savedRequest);

      return {
        request: savedRequest,
        response: null,
        transaction,
        attempt: failedAttempt,
        tiraHttpResponse: null,
      };
    }

    if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
      const failedAttempt = await this.submissionService.markFailed({
        requestId,
        errorMessage: `TIRAMIS HTTP error: ${httpResponse.statusCode}`,
        rawPayload: httpResponse.rawXml,
        isRetryable: true,
      });

      savedRequest.status = TIRAMIS_VERIFICATION_STATUS.FAILED;
      await this.verificationRepository.saveRequest(savedRequest);

      return {
        request: savedRequest,
        response: null,
        transaction,
        attempt: failedAttempt,
        tiraHttpResponse: {
          statusCode: httpResponse.statusCode,
          statusText: httpResponse.statusText,
        },
      };
    }

    const parsedMessage = this.xmlParser.parseTiraMessage(httpResponse.rawXml);
    const content = parsedMessage.content || {};
    const responseHeader =
      params.rootElement === TIRAMIS_VERIFICATION_ROOT_ELEMENT.COVER_NOTE
        ? (content as any).CoverNoteHdr || content
        : (content as any).VerificationHdr || content;

    const responseId = responseHeader.ResponseId || null;
    const statusCode =
      responseHeader.ResponseStatusCode ||
      (content as any).ResponseStatusCode ||
      null;

    const statusDesc =
      responseHeader.ResponseStatusDesc ||
      (content as any).ResponseStatusDesc ||
      null;

    const responseSignatureValid =
      !!parsedMessage.signature &&
      !!parsedMessage.contentXml &&
      this.signatureService.verifyXmlContent({
        contentXml: parsedMessage.contentXml,
        signature: parsedMessage.signature,
        publicCertificatePfxPath: pfxPaths.tiraPublicCertificatePath!,
        publicCertificatePfxPassword: pfxPaths.tiraPublicCertificatePassword,
      });

    const isBusinessSuccess = statusCode
      ? await this.tiramisConfigService.isSuccessResponse(statusCode)
      : false;
    const isSuccess = responseSignatureValid && isBusinessSuccess;
    const normalizedVerification = this.buildNormalizedVerificationResult({
      verificationType: params.verificationType,
      content,
      statusCode,
      statusDesc,
      signatureVerified: responseSignatureValid,
      respondedAt: new Date(),
    });

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

    const finalAttempt = await this.submissionService.markFinalResponseReceived(
      {
        requestId,
        responseId: responseId || undefined,
        statusCode: statusCode || 'UNKNOWN',
        statusDesc: statusDesc || undefined,
        rawXml: httpResponse.rawXml,
        responseSignature: parsedMessage.signature || undefined,
        isSuccess,
      },
    );

    return {
      signatureVerified: responseSignatureValid,
      verification: normalizedVerification,
      request: savedRequest,
      response: savedResponse,
      transaction,
      attempt: finalAttempt,
      tiraHttpResponse: {
        statusCode: httpResponse.statusCode,
        statusText: httpResponse.statusText,
      },
    };
  }

  private normalizeMotorVerificationDto(
    dto: MotorVerificationDto,
  ): MotorVerificationDto {
    if (!isMotorCategory(dto?.motorCategory)) {
      throw new BadRequestException(
        'motorCategory must be either 1 for Motor vehicle or 2 for Motorcycle',
      );
    }

    const registrationNumber = this.normalizeMotorField(
      dto.motorRegistrationNumber,
      'motorRegistrationNumber',
    );
    const chassisNumber = this.normalizeMotorField(
      dto.motorChassisNumber,
      'motorChassisNumber',
    );

    if (!registrationNumber && !chassisNumber) {
      throw new BadRequestException(
        'Either motorRegistrationNumber or motorChassisNumber must be provided',
      );
    }

    return {
      ...dto,
      motorCategory: dto.motorCategory,
      motorRegistrationNumber: registrationNumber,
      motorChassisNumber: chassisNumber,
    };
  }

  private normalizeCoverNoteVerificationDto(
    dto: CoverNoteVerificationDto,
  ): CoverNoteVerificationDto {
    const normalizedDto: CoverNoteVerificationDto = {
      ...dto,
      coverNoteReferenceNumber: this.normalizeCoverNoteField(
        dto?.coverNoteReferenceNumber,
        'coverNoteReferenceNumber',
      ),
      stickerNumber: this.normalizeCoverNoteField(
        dto?.stickerNumber,
        'stickerNumber',
      ),
      motorRegistrationNumber: this.normalizeCoverNoteField(
        dto?.motorRegistrationNumber,
        'motorRegistrationNumber',
      ),
      motorChassisNumber: this.normalizeCoverNoteField(
        dto?.motorChassisNumber,
        'motorChassisNumber',
      ),
    };

    if (
      !normalizedDto.coverNoteReferenceNumber &&
      !normalizedDto.stickerNumber &&
      !normalizedDto.motorRegistrationNumber &&
      !normalizedDto.motorChassisNumber
    ) {
      throw new BadRequestException(
        'At least one Cover Note verification value must be provided',
      );
    }

    return normalizedDto;
  }

  private normalizeCoverNoteField(
    value: string | null | undefined,
    fieldName: string,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalized = value.trim();

    if (normalized.length > 50) {
      throw new BadRequestException(
        `${fieldName} must not exceed 50 characters`,
      );
    }

    return normalized || null;
  }

  private normalizeMotorField(
    value: string | null | undefined,
    fieldName: string,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalized = value.trim();

    if (normalized.length > 50) {
      throw new BadRequestException(
        `${fieldName} must not exceed 50 characters`,
      );
    }

    return normalized || null;
  }

  private buildNormalizedVerificationResult(params: {
    verificationType: string;
    content: Record<string, unknown>;
    statusCode: string | null;
    statusDesc: string | null;
    signatureVerified: boolean;
    respondedAt: Date;
  }) {
    const responseHeader =
      params.verificationType === TIRAMIS_VERIFICATION_TYPE.COVER_NOTE
        ? this.asPlainRecord(params.content.CoverNoteHdr)
        : this.asPlainRecord(params.content.VerificationHdr);

    const responseDetails =
      params.verificationType === TIRAMIS_VERIFICATION_TYPE.COVER_NOTE
        ? this.normalizeResponseValue(params.content.CoverNoteDtl)
        : this.normalizeResponseValue(params.content.VerificationDtl);

    return {
      verificationType: params.verificationType,
      status: this.resolveVerificationStatus(
        params.statusCode,
        params.signatureVerified,
      ),
      responseCode: params.statusCode,
      responseMessage: params.statusDesc,
      signatureVerified: params.signatureVerified,
      respondedAt: params.respondedAt.toISOString(),
      details: {
        responseHeader,
        responseDetails,
      },
    };
  }

  private resolveVerificationStatus(
    statusCode: string | null,
    signatureVerified: boolean,
  ) {
    if (!statusCode) {
      return TIRAMIS_VERIFICATION_STATUS.PENDING;
    }

    if (!signatureVerified) {
      return TIRAMIS_VERIFICATION_STATUS.FAILED;
    }

    return statusCode === 'TIRA001'
      ? TIRAMIS_VERIFICATION_STATUS.SUCCESS
      : TIRAMIS_VERIFICATION_STATUS.FAILED;
  }

  private asPlainRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return this.normalizeResponseValue(value) as Record<string, unknown>;
  }

  private normalizeResponseValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeResponseValue(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        this.normalizeResponseValue(entry),
      ]),
    );
  }
}
