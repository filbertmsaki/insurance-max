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
import { CreatePolicyDto } from '../dto/create-policy.dto';
import { TiramisPolicyRepository } from '../repositories/tiramis-policy.repository';
import { TiramisPolicyPayloadService } from './tiramis-policy-payload.service';

@Injectable()
export class TiramisPolicyService {
  private readonly rootElement = 'PolicyReq';
  private readonly serviceType = 'POLICY';

  constructor(
    private readonly policyRepository: TiramisPolicyRepository,
    private readonly policyPayloadService: TiramisPolicyPayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  async createDraft(
    dto: CreatePolicyDto | (CreatePolicyDto & TiramisResolvedRequestDtoFields),
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.policyNumber,
            )
          ).dto;

    this.validatePayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceModule: 'tiramis-policies',
      sourceRecordId: resolvedDto.sourceRecordId,
      businessReference: resolvedDto.policyNumber,
    });

    const policy = this.policyRepository.create({
      transactionId: transaction.id,
      requestId,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      policyNumber: resolvedDto.policyNumber,
      policyOperativeClause: resolvedDto.policyOperativeClause,
      specialConditions: resolvedDto.specialConditions,
      exclusions: resolvedDto.exclusions || null,
      coverNotes: resolvedDto.coverNoteReferenceNumbers.map(
        (referenceNumber) => ({
          coverNoteReferenceNumber: referenceNumber,
        }),
      ) as any,
    });

    const savedPolicy = await this.policyRepository.save(policy);

    return {
      transaction,
      policy: savedPolicy,
    };
  }

  async submit(dto: CreatePolicyDto) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.policyNumber,
      );

    const { transaction, policy } = await this.createDraft(resolvedDto);

    const payload = this.policyPayloadService.buildFromDto({
      dto: resolvedDto,
      requestId: policy.requestId,
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
      requestId: policy.requestId,
      rootElement: this.rootElement,
      requestXml,
      requestSignature: signature,
    });

    policy.currentAttemptId = attempt.id;
    await this.policyRepository.save(policy);

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration,
        serviceType: this.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    await this.tiramisSubmissionService.markSent(policy.requestId);

    const response = await this.httpClient.postXml({
      url: endpoint,
      xml: requestXml,
      headers,
    });

    return {
      policy,
      attempt,
      tiraResponse: response,
    };
  }

  async findById(id: string) {
    const policy = await this.policyRepository.findById(id);

    if (!policy) {
      throw new NotFoundException('TIRAMIS policy record not found');
    }

    return policy;
  }

  async findByRequestId(requestId: string) {
    const policy = await this.policyRepository.findByRequestId(requestId);

    if (!policy) {
      throw new NotFoundException('TIRAMIS policy record not found');
    }

    return policy;
  }

  async findByPolicyNumber(policyNumber: string) {
    const policy = await this.policyRepository.findByPolicyNumber(policyNumber);

    if (!policy) {
      throw new NotFoundException('TIRAMIS policy record not found');
    }

    return policy;
  }

  async findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.policyRepository.findByCoverNoteReferenceNumber(
      coverNoteReferenceNumber,
    );
  }

  private validatePayload(dto: CreatePolicyDto) {
    if (!dto.policyNumber) {
      throw new BadRequestException('PolicyNumber is required');
    }

    if (!dto.coverNoteReferenceNumbers?.length) {
      throw new BadRequestException(
        'At least one CoverNoteReferenceNumber is required',
      );
    }

    if (!dto.policyOperativeClause) {
      throw new BadRequestException('PolicyOperativeClause is required');
    }

    if (!dto.specialConditions) {
      throw new BadRequestException('SpecialConditions is required');
    }
  }
}
