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

  async createDraft(dto: CreatePolicyDto) {
    this.validatePayload(dto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: dto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceModule: dto.sourceModule || 'tiramis-policies',
      sourceRecordId: dto.sourceRecordId,
      businessReference: dto.policyNumber,
    });

    const policy = this.policyRepository.create({
      transactionId: transaction.id,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      policyNumber: dto.policyNumber,
      policyOperativeClause: dto.policyOperativeClause,
      specialConditions: dto.specialConditions,
      exclusions: dto.exclusions || null,
      coverNotes: dto.coverNoteReferenceNumbers.map((referenceNumber) => ({
        coverNoteReferenceNumber: referenceNumber,
      })) as any,
    });

    const savedPolicy = await this.policyRepository.save(policy);

    return {
      transaction,
      policy: savedPolicy,
    };
  }

  async submit(dto: CreatePolicyDto) {
    const { transaction, policy } = await this.createDraft(dto);

    const payload = this.policyPayloadService.buildFromDto({
      dto,
      requestId: policy.requestId,
    });

    const contentXml = this.xmlBuilder.buildContentXml(
      this.rootElement,
      payload,
    );

    const pfxPaths = await this.tiramisConfigService.getPfxPaths(
      dto.environment,
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

    const endpoint = await this.tiramisConfigService.getFullEndpointUrl({
      environment: dto.environment,
      serviceType: this.serviceType,
    });

    const headers = await this.tiramisConfigService.getRequestHeaders(
      dto.environment,
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
