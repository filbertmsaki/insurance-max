import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  TIRAMIS_CLAIM_ROOT_ELEMENT,
  TIRAMIS_CLAIM_SERVICE_TYPE,
} from '../constants/tiramis-claim.constants';
import type { CreateDischargeVoucherDto } from '../dto/create-discharge-voucher.dto';
import { TiramisDischargeVoucherEntity } from '../entities/tiramis-discharge-voucher.entity';
import { TiramisDischargeVoucherRepository } from '../repositories/tiramis-discharge-voucher.repository';
import { TiramisDischargeVoucherPayloadService } from './tiramis-discharge-voucher-payload.service';

import {
  TiramisConfigService,
  type TiramisResolvedRequestDtoFields,
} from '../../config/services/tiramis-config.service';
import { TiramisBusinessSubmissionService } from '../../shared/services/tiramis-business-submission.service';
import { TiramisSourceMetadataDto } from '../../submissions/dto/tiramis-source-metadata.dto';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';

@Injectable()
export class TiramisDischargeVoucherService {
  private readonly dischargeVoucherRootElement =
    TIRAMIS_CLAIM_ROOT_ELEMENT.DISCHARGE_VOUCHER;
  private readonly dischargeVoucherServiceType =
    TIRAMIS_CLAIM_SERVICE_TYPE.DISCHARGE_VOUCHER;

  constructor(
    private readonly dischargeVoucherRepository: TiramisDischargeVoucherRepository,
    private readonly dischargeVoucherPayloadService: TiramisDischargeVoucherPayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly businessSubmissionService: TiramisBusinessSubmissionService,
  ) {}

  async createDischargeVoucherDraft(
    dto:
      | CreateDischargeVoucherDto
      | (CreateDischargeVoucherDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.dischargeVoucherNumber,
            )
          ).dto;

    this.validateDischargeVoucherPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId || this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.dischargeVoucherServiceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      sourceModule: sourceMetadata?.sourceModule || 'tiramis-claims',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.dischargeVoucherNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.dischargeVoucherNumber,
      originalRequestId: requestId,
    });

    const dischargeVoucher = this.dischargeVoucherRepository.create({
      transactionId: transaction.id,
      requestId,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      dischargeVoucherNumber: resolvedDto.dischargeVoucherNumber,
      claimAssessmentNumber: resolvedDto.claimAssessmentNumber,
      claimReferenceNumber: resolvedDto.claimReferenceNumber,
      coverNoteReferenceNumber: resolvedDto.coverNoteReferenceNumber,
      dischargeVoucherDate: new Date(resolvedDto.dischargeVoucherDate),
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      claimOfferCommunicationDate: resolvedDto.claimOfferCommunicationDate
        ? new Date(resolvedDto.claimOfferCommunicationDate)
        : null,
      claimOfferAmount: resolvedDto.claimOfferAmount,
      claimantResponseDate: resolvedDto.claimantResponseDate
        ? new Date(resolvedDto.claimantResponseDate)
        : null,
      adjustmentDate: resolvedDto.adjustmentDate
        ? new Date(resolvedDto.adjustmentDate)
        : null,
      adjustmentReason: resolvedDto.adjustmentReason,
      adjustmentAmount: resolvedDto.adjustmentAmount,
      reconciliationDate: resolvedDto.reconciliationDate
        ? new Date(resolvedDto.reconciliationDate)
        : null,
      reconciliationSummary: resolvedDto.reconciliationSummary,
      reconciledAmount: resolvedDto.reconciledAmount,
      offerAccepted: resolvedDto.offerAccepted,
      claimants: resolvedDto.claimants as any,
    });

    const savedDischargeVoucher =
      await this.dischargeVoucherRepository.save(dischargeVoucher);

    return {
      transaction,
      record: savedDischargeVoucher,
    };
  }

  async submitDischargeVoucher(
    dto: CreateDischargeVoucherDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        sourceMetadata?.businessReference || dto.dischargeVoucherNumber,
      );

    const { transaction, record } = await this.createDischargeVoucherDraft(
      resolvedDto,
      sourceMetadata,
    );

    const payload =
      this.dischargeVoucherPayloadService.buildDischargeVoucherPayload({
        dto: resolvedDto,
        requestId: record.requestId,
      });

    const submission = await this.businessSubmissionService.submitSignedXml({
      configuration,
      transactionId: transaction.id,
      requestId: record.requestId,
      rootElement: this.dischargeVoucherRootElement,
      serviceType: this.dischargeVoucherServiceType,
      payload,
      errorLabel: 'Discharge Voucher',
    });

    record.currentAttemptId = submission.attempt.id;
    await this.dischargeVoucherRepository.save(record);

    return {
      transaction,
      record,
      attempt: submission.attempt,
      tiraResponse: submission.tiraResponse,
    };
  }

  async previewDischargeVoucherXml(
    dto: CreateDischargeVoucherDto,
    includeSignature = true,
  ) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.dischargeVoucherNumber,
      );

    this.validateDischargeVoucherPayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const payload =
      this.dischargeVoucherPayloadService.buildDischargeVoucherPayload({
        dto: resolvedDto,
        requestId,
      });

    const preview = await this.businessSubmissionService.previewSignedXml({
      configuration,
      rootElement: this.dischargeVoucherRootElement,
      payload,
      includeSignature,
    });

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.dischargeVoucherServiceType,
      rootElement: this.dischargeVoucherRootElement,
      requestId,
      payload,
      ...preview,
    };
  }

  async findById(id: string) {
    const record = await this.dischargeVoucherRepository.findById(id);

    if (!record) {
      throw new NotFoundException('TIRAMIS discharge voucher record not found');
    }

    return record;
  }

  async findByRequestId(requestId: string) {
    const record =
      await this.dischargeVoucherRepository.findByRequestId(requestId);

    if (!record) {
      throw new NotFoundException('TIRAMIS discharge voucher record not found');
    }

    return record;
  }

  async findByDischargeVoucherNumber(dischargeVoucherNumber: string) {
    const record =
      await this.dischargeVoucherRepository.findByDischargeVoucherNumber(
        dischargeVoucherNumber,
      );

    if (!record) {
      throw new NotFoundException('TIRAMIS discharge voucher not found');
    }

    return record;
  }

  validateDischargeVoucherPayload(dto: CreateDischargeVoucherDto) {
    const errors: string[] = [];

    this.requireString(
      dto.dischargeVoucherNumber,
      'dischargeVoucherNumber',
      errors,
    );
    this.requireString(
      dto.claimAssessmentNumber,
      'claimAssessmentNumber',
      errors,
    );
    this.requireString(
      dto.claimReferenceNumber,
      'claimReferenceNumber',
      errors,
    );
    this.requireString(
      dto.coverNoteReferenceNumber,
      'coverNoteReferenceNumber',
      errors,
    );
    this.requireDate(dto.dischargeVoucherDate, 'dischargeVoucherDate', errors);
    this.requireString(dto.currencyCode, 'currencyCode', errors);

    if (dto.currencyCode && String(dto.currencyCode).length !== 3) {
      errors.push('currencyCode must be a 3-letter code, example: TZS');
    }

    this.requireString(dto.exchangeRate, 'exchangeRate', errors);
    this.requireString(dto.claimOfferAmount, 'claimOfferAmount', errors);

    if (
      dto.offerAccepted &&
      !['Y', 'N'].includes(String(dto.offerAccepted).toUpperCase())
    ) {
      errors.push('offerAccepted must be Y or N');
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Discharge Voucher payload validation failed',
        errors,
      });
    }
  }

  private requireString(value: unknown, fieldName: string, errors: string[]) {
    if (value === null || value === undefined || String(value).trim() === '') {
      errors.push(`${fieldName} is required`);
    }
  }

  private requireDate(value: unknown, fieldName: string, errors: string[]) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === '' ||
      Number.isNaN(new Date(value as any).getTime())
    ) {
      errors.push(`${fieldName} must be a valid date`);
    }
  }
}
