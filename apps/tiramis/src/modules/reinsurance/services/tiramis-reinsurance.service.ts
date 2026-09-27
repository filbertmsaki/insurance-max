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
    private readonly businessSubmissionService: TiramisBusinessSubmissionService,
  ) {}

  async createDraft(
    dto:
      | CreateReinsuranceDto
      | (CreateReinsuranceDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
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

    const requestId =
      sourceMetadata?.requestId || this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-reinsurance',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.sourceRecordId ||
        resolvedDto.coverNoteReferenceNumber,
      businessReference:
        sourceMetadata?.businessReference ||
        resolvedDto.coverNoteReferenceNumber,
      originalRequestId: requestId,
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

  async submit(
    dto: CreateReinsuranceDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.coverNoteReferenceNumber,
      );

    const { transaction, reinsurance } = await this.createDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.reinsurancePayloadService.buildFromDto({
      dto: resolvedDto,
      requestId: reinsurance.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: reinsurance.requestId,
      rootElement: this.rootElement,
      serviceType: this.serviceType,
      payload,
      errorLabel: 'Reinsurance',
    });

    reinsurance.currentAttemptId = submission.attempt.id;
    await this.reinsuranceRepository.save(reinsurance);

    return {
      transaction,
      reinsurance,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewXml(dto: CreateReinsuranceDto, includeSignature = true) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.coverNoteReferenceNumber,
      );

    this.validatePayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const payload = this.reinsurancePayloadService.buildFromDto({
      dto: resolvedDto,
      requestId,
    });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.rootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.serviceType,
      rootElement: this.rootElement,
      requestId,
      payload,
      ...preview,
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
    const errors: string[] = [];

    if (!dto.coverNoteReferenceNumber) {
      errors.push('coverNoteReferenceNumber is required');
    }

    if (!dto.premiumIncludingTax) {
      errors.push('premiumIncludingTax is required');
    }

    if (!dto.currencyCode) {
      errors.push('currencyCode is required');
    }

    if (dto.currencyCode && dto.currencyCode.length !== 3) {
      errors.push('currencyCode must be a 3-letter code, example: TZS');
    }

    if (!dto.exchangeRate) {
      errors.push('exchangeRate is required');
    }

    if (!dto.authorizingOfficerName) {
      errors.push('authorizingOfficerName is required');
    }

    if (!dto.authorizingOfficerTitle) {
      errors.push('authorizingOfficerTitle is required');
    }

    if (!dto.reinsuranceCategory) {
      errors.push('reinsuranceCategory is required');
    }

    if (!dto.participants || dto.participants.length === 0) {
      errors.push('participants must contain at least one participant');
    }

    dto.participants?.forEach((participant, index) => {
      const path = `participants[${index}]`;

      if (!participant.participantCode) {
        errors.push(`${path}.participantCode is required`);
      }

      if (!participant.participantType) {
        errors.push(`${path}.participantType is required`);
      }

      if (!participant.reinsuranceForm) {
        errors.push(`${path}.reinsuranceForm is required`);
      }

      if (!participant.reinsuranceType) {
        errors.push(`${path}.reinsuranceType is required`);
      }

      if (!participant.brokerageCommission) {
        errors.push(`${path}.brokerageCommission is required`);
      }

      if (!participant.reinsuranceCommission) {
        errors.push(`${path}.reinsuranceCommission is required`);
      }

      if (!participant.premiumShare) {
        errors.push(`${path}.premiumShare is required`);
      }

      if (!participant.participationDate) {
        errors.push(`${path}.participationDate is required`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Reinsurance payload validation failed',
        errors,
      });
    }
  }
}
