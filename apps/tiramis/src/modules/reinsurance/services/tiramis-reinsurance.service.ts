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
import { CreateReinsuranceDto } from '../dto/create-reinsurance.dto';
import { TiramisReinsuranceRepository } from '../repositories/tiramis-reinsurance.repository';
import { TiramisReinsurancePayloadService } from './tiramis-reinsurance-payload.service';

@Injectable()
export class TiramisReinsuranceService {
  private readonly rootElement = 'ReinsuranceReq';
  private readonly serviceType = 'REINSURANCE';

  constructor(
    private readonly reinsuranceRepository: TiramisReinsuranceRepository,
    private readonly reinsurancePayloadService: TiramisReinsurancePayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  async createDraft(
    dto:
      | CreateReinsuranceDto
      | (CreateReinsuranceDto & TiramisResolvedRequestDtoFields),
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.coverNoteReferenceNumber,
            )
          ).dto;

    this.validatePayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceModule: 'tiramis-reinsurance',
      sourceRecordId: resolvedDto.sourceRecordId,
      businessReference: resolvedDto.coverNoteReferenceNumber,
    });

    const reinsurance = this.reinsuranceRepository.create({
      transactionId: transaction.id,
      requestId,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      premiumIncludingTax: resolvedDto.premiumIncludingTax,
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      authorizingOfficerName: resolvedDto.authorizingOfficerName,
      authorizingOfficerTitle: resolvedDto.authorizingOfficerTitle,
      reinsuranceCategory: resolvedDto.reinsuranceCategory,
      participants: resolvedDto.participants.map((participant) => ({
        participantCode: participant.participantCode,
        participantType: participant.participantType,
        reinsuranceForm: participant.reinsuranceForm,
        reinsuranceType: participant.reinsuranceType,
        reBrokerCode: participant.reBrokerCode || null,
        brokerageCommission: participant.brokerageCommission,
        reinsuranceCommission: participant.reinsuranceCommission,
        premiumShare: participant.premiumShare,
        participationDate: new Date(participant.participationDate),
      })) as any,
    });

    const savedReinsurance = await this.reinsuranceRepository.save(reinsurance);

    return {
      transaction,
      reinsurance: savedReinsurance,
    };
  }

  async submit(dto: CreateReinsuranceDto) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.coverNoteReferenceNumber,
      );

    const { transaction, reinsurance } = await this.createDraft(resolvedDto);

    const payload = this.reinsurancePayloadService.buildFromDto({
      dto: resolvedDto,
      requestId: reinsurance.requestId,
    });

    const contentXml = this.xmlBuilder.buildContentXml(
      this.rootElement,
      payload,
    );

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        configuration,
      );

    const signature = this.signatureService.signXmlContent({
      contentXml,
      privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
      privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
    });

    const requestXml = this.xmlBuilder.buildSignedTiraMessage({
      rootName: this.rootElement,
      payload,
      signature,
    });

    const attempt = await this.tiramisSubmissionService.createAttempt({
      transactionId: transaction.id,
      requestId: reinsurance.requestId,
      rootElement: this.rootElement,
      requestXml,
      requestSignature: signature,
    });

    reinsurance.currentAttemptId = attempt.id;
    await this.reinsuranceRepository.save(reinsurance);

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration,
        serviceType: this.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    await this.tiramisSubmissionService.markSent(reinsurance.requestId);

    const response = await this.httpClient.postXml({
      url: endpoint,
      xml: requestXml,
      headers,
    });

    return {
      reinsurance,
      attempt,
      tiraResponse: response,
    };
  }

  async findById(id: string) {
    const reinsurance = await this.reinsuranceRepository.findById(id);

    if (!reinsurance) {
      throw new NotFoundException('TIRAMIS reinsurance record not found');
    }

    return reinsurance;
  }

  async findByRequestId(requestId: string) {
    const reinsurance =
      await this.reinsuranceRepository.findByRequestId(requestId);

    if (!reinsurance) {
      throw new NotFoundException('TIRAMIS reinsurance record not found');
    }

    return reinsurance;
  }

  async findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.reinsuranceRepository.findByCoverNoteReferenceNumber(
      coverNoteReferenceNumber,
    );
  }

  private validatePayload(dto: CreateReinsuranceDto) {
    if (!dto.participants || dto.participants.length === 0) {
      throw new BadRequestException(
        'At least one reinsurance participant is required',
      );
    }

    if (!dto.coverNoteReferenceNumber) {
      throw new BadRequestException(
        'CoverNoteReferenceNumber is required for reinsurance submission',
      );
    }
  }
}
