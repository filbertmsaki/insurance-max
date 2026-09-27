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
import { TiramisProductWordingValidationService } from '../../../common/services/tiramis-product-wording-validation.service';
import { TiramisSourceMetadataDto } from '../../submissions/dto/tiramis-source-metadata.dto';
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
    private readonly businessSubmissionService: TiramisBusinessSubmissionService,
    private readonly productWordingValidator: TiramisProductWordingValidationService,
  ) {}

  async createDraft(
    dto: CreatePolicyDto | (CreatePolicyDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
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

    const requestId =
      sourceMetadata?.requestId || this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-policy',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.policyNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.policyNumber,
      originalRequestId: requestId,
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

  async submit(
    dto: CreatePolicyDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    this.productWordingValidator.assertPolicyWording(dto);

    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.policyNumber,
      );

    const { transaction, policy } = await this.createDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload = this.policyPayloadService.buildFromDto({
      dto: resolvedDto,
      requestId: policy.requestId,
    });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: policy.requestId,
      rootElement: this.rootElement,
      serviceType: this.serviceType,
      payload,
      errorLabel: 'Policy',
    });

    policy.currentAttemptId = submission.attempt.id;
    await this.policyRepository.save(policy);

    return {
      transaction,
      policy,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewXml(dto: CreatePolicyDto, includeSignature = true) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.policyNumber,
      );

    this.validatePayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const payload = this.policyPayloadService.buildFromDto({
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
    const errors: string[] = [];

    if (!dto.policyNumber) {
      errors.push('policyNumber is required');
    }

    if (!dto.policyOperativeClause) {
      errors.push('policyOperativeClause is required');
    }

    if (!dto.specialConditions) {
      errors.push('specialConditions is required');
    }

    if (
      !dto.coverNoteReferenceNumbers ||
      !Array.isArray(dto.coverNoteReferenceNumbers) ||
      dto.coverNoteReferenceNumbers.length === 0
    ) {
      errors.push(
        'coverNoteReferenceNumbers must contain at least one cover note reference number',
      );
    }

    dto.coverNoteReferenceNumbers?.forEach((reference, index) => {
      if (!reference || String(reference).trim() === '') {
        errors.push(`coverNoteReferenceNumbers[${index}] is required`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Policy payload validation failed',
        errors,
      });
    }
  }
}
