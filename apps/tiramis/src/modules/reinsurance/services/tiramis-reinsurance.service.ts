import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
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

  async createDraft(dto: CreateReinsuranceDto) {
    this.validatePayload(dto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: dto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceModule: dto.sourceModule || 'tiramis-reinsurance',
      sourceRecordId: dto.sourceRecordId,
      businessReference: dto.coverNoteReferenceNumber,
    });

    const reinsurance = this.reinsuranceRepository.create({
      transactionId: transaction.id,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      coverNoteReferenceNumber: dto.coverNoteReferenceNumber,
      premiumIncludingTax: dto.premiumIncludingTax,
      currencyCode: dto.currencyCode,
      exchangeRate: dto.exchangeRate,
      authorizingOfficerName: dto.authorizingOfficerName,
      authorizingOfficerTitle: dto.authorizingOfficerTitle,
      reinsuranceCategory: dto.reinsuranceCategory,
      participants: dto.participants.map((participant) => ({
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

    const savedReinsurance =
      await this.reinsuranceRepository.save(reinsurance);

    return {
      transaction,
      reinsurance: savedReinsurance,
    };
  }

  async submit(dto: CreateReinsuranceDto) {
    const { transaction, reinsurance } = await this.createDraft(dto);

    const payload = this.reinsurancePayloadService.buildFromDto({
      dto,
      requestId: reinsurance.requestId,
    });

    const contentXml = this.xmlBuilder.buildContentXml(
      this.rootElement,
      payload,
    );

    const certificatePaths =
      await this.tiramisConfigService.getCertificatePaths(dto.environment);

    const signature = this.signatureService.signXmlContent({
      contentXml,
      privateKeyPath: certificatePaths.privateKeyPath!,
      privateKeyPassword: certificatePaths.privateKeyPassword,
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

    const endpoint = await this.tiramisConfigService.getFullEndpointUrl({
      environment: dto.environment,
      serviceType: this.serviceType,
    });

    const headers = await this.tiramisConfigService.getRequestHeaders(
      dto.environment,
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
