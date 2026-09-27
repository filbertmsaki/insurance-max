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
import { TiramisSourceMetadataDto } from '../../submissions/dto/tiramis-source-metadata.dto';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import { TiramisPayloadValidationService } from '../../shared/services/tiramis-payload-validation.service';
import { TiramisCoverPeriodService } from '../../shared/services/tiramis-cover-period.service';
import { TiramisProductWordingValidationService } from '../../../common/services/tiramis-product-wording-validation.service';
import { CreateCoverNoteDto } from '../dto/create-cover-note.dto';
import { TiramisCoverNoteRepository } from '../repositories/tiramis-cover-note.repository';
import { TiramisCoverNotePayloadService } from './tiramis-cover-note-payload.service';

@Injectable()
export class TiramisCoverNoteService {
  private readonly rootElement = 'CoverNoteRefReq';
  private readonly serviceType = 'COVER_NOTE_NON_MOTOR';

  constructor(
    private readonly coverNoteRepository: TiramisCoverNoteRepository,
    private readonly payloadService: TiramisCoverNotePayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
    private readonly payloadValidator: TiramisPayloadValidationService,
    private readonly productWordingValidator: TiramisProductWordingValidationService,
    private readonly coverPeriodService: TiramisCoverPeriodService,
  ) {}

  async createDraft(
    dto:
      | CreateCoverNoteDto
      | (CreateCoverNoteDto & TiramisResolvedRequestDtoFields),
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    const resolvedDto =
      'clientConfigurationId' in dto
        ? dto
        : (
            await this.tiramisConfigService.resolveSubmissionContext(
              dto,
              dto.coverNoteNumber,
            )
          ).dto;

    this.normalizeCoverPeriod(resolvedDto);
    this.validateNonMotorPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId || this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      portalWebhookUrl: sourceMetadata?.portalWebhookUrl || null,
      sourceModule: sourceMetadata?.sourceModule || 'cover-notes',
      sourceRecordId:
        sourceMetadata?.sourceRecordId ||
        sourceMetadata?.policyId ||
        sourceMetadata?.quotationId ||
        resolvedDto.coverNoteNumber,
      businessReference:
        sourceMetadata?.businessReference || resolvedDto.coverNoteNumber,
    });

    const coverNote = this.coverNoteRepository.create({
      transactionId: transaction.id,
      insuranceType: 'NON_MOTOR',
      isFleet: 0,
      requestId,
      companyCode: resolvedDto.companyCode,
      systemCode: resolvedDto.systemCode,
      callbackUrl: resolvedDto.callbackUrl,
      insurerCompanyCode: resolvedDto.insurerCompanyCode,
      tranCompanyCode: resolvedDto.tranCompanyCode || null,
      coverNoteType: resolvedDto.coverNoteType,
      coverNoteNumber: resolvedDto.coverNoteNumber,
      prevCoverNoteReferenceNumber:
        resolvedDto.prevCoverNoteReferenceNumber || null,
      salePointCode: resolvedDto.salePointCode,
      coverNoteStartDate: new Date(resolvedDto.coverNoteStartDate),
      coverNoteEndDate: new Date(resolvedDto.coverNoteEndDate),
      coverNoteDesc: resolvedDto.coverNoteDesc,
      operativeClause: resolvedDto.operativeClause,
      paymentMode: resolvedDto.paymentMode,
      currencyCode: resolvedDto.currencyCode,
      exchangeRate: resolvedDto.exchangeRate,
      totalPremiumExcludingTax: resolvedDto.totalPremiumExcludingTax,
      totalPremiumIncludingTax: resolvedDto.totalPremiumIncludingTax,
      commissionPaid: resolvedDto.commissionPaid || null,
      commissionRate: resolvedDto.commissionRate || null,
      officerName: resolvedDto.officerName,
      officerTitle: resolvedDto.officerTitle,
      productCode: resolvedDto.productCode,
      endorsementType: resolvedDto.endorsementType || null,
      endorsementReason: resolvedDto.endorsementReason || null,
      endorsementPremiumEarned: resolvedDto.endorsementPremiumEarned || null,
      risks: resolvedDto.risks.map((risk) => ({
        riskCode: risk.riskCode,
        sumInsured: risk.sumInsured,
        sumInsuredEquivalent: risk.sumInsuredEquivalent,
        premiumRate: risk.premiumRate,
        premiumBeforeDiscount: risk.premiumBeforeDiscount,
        premiumAfterDiscount: risk.premiumAfterDiscount,
        premiumExcludingTaxEquivalent: risk.premiumExcludingTaxEquivalent,
        premiumIncludingTax: risk.premiumIncludingTax,
        discounts: (risk.discounts || []).map((discount) => ({
          discountType: discount.discountType || null,
          discountRate: discount.discountRate || null,
          discountAmount: discount.discountAmount || null,
        })),
        taxes: (risk.taxes || []).map((tax) => ({
          taxCode: tax.taxCode,
          isTaxExempted: tax.isTaxExempted || 'N',
          taxExemptionType: tax.taxExemptionType || null,
          taxExemptionReference: tax.taxExemptionReference || null,
          taxRate: tax.taxRate,
          taxAmount: tax.taxAmount,
        })),
      })) as any,
      subjectMatters: (resolvedDto.subjectMatters || []).map((subject) => ({
        subjectMatterReference: subject.subjectMatterReference,
        subjectMatterDesc: subject.subjectMatterDesc,
      })) as any,
      addons: (resolvedDto.addons || []).map((addon) => ({
        addonReference: addon.addonReference,
        addonDesc: addon.addonDesc,
        addonAmount: addon.addonAmount,
        addonPremiumRate: addon.addonPremiumRate,
        premiumExcludingTax: addon.premiumExcludingTax,
        premiumExcludingTaxEquivalent: addon.premiumExcludingTaxEquivalent,
        premiumIncludingTax: addon.premiumIncludingTax,
        taxes: (addon.taxes || []).map((tax) => ({
          taxCode: tax.taxCode,
          isTaxExempted: tax.isTaxExempted || 'N',
          taxExemptionType: tax.taxExemptionType || null,
          taxExemptionReference: tax.taxExemptionReference || null,
          taxRate: tax.taxRate,
          taxAmount: tax.taxAmount,
        })),
      })) as any,
      policyHolders: resolvedDto.policyHolders.map((holder) => ({
        policyHolderName: holder.policyHolderName,
        policyHolderBirthDate: holder.policyHolderBirthDate
          ? new Date(holder.policyHolderBirthDate)
          : null,
        policyHolderType: holder.policyHolderType,
        policyHolderIdNumber: holder.policyHolderIdNumber,
        policyHolderIdType: holder.policyHolderIdType,
        gender: holder.gender || null,
        countryCode: holder.countryCode,
        region: holder.region,
        district: holder.district,
        street: holder.street || null,
        phoneNumber: holder.phoneNumber,
        fax: holder.fax || null,
        postalAddress: holder.postalAddress || null,
        emailAddress: holder.emailAddress || null,
      })) as any,
    });

    const savedCoverNote = await this.coverNoteRepository.save(coverNote);

    return {
      transaction,
      coverNote: savedCoverNote,
    };
  }

  async previewXml(dto: CreateCoverNoteDto, includeSignature = true) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.coverNoteNumber,
      );

    this.validateNonMotorPayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const payload = this.payloadService.buildFromDto({
      dto: resolvedDto,
      requestId,
    });

    const contentXml = this.xmlBuilder.buildContentXml(
      this.rootElement,
      payload,
    );

    let signature: string | null = null;
    let tiraMessageXml: string;

    if (includeSignature) {
      const pfxPaths =
        await this.tiramisConfigService.getPfxPathsForConfiguration(
          configuration,
        );

      signature = this.signatureService.signXmlContent({
        contentXml,
        privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
        privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
      });

      tiraMessageXml = this.xmlBuilder.buildSignedTiraMessageFromContent({
        contentXml,
        signature,
      });
    } else {
      tiraMessageXml = this.xmlBuilder.buildTiraMessage({
        rootName: this.rootElement,
        payload,
        signature: '',
      });
    }

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration,
        serviceType: this.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType: this.serviceType,
      rootElement: this.rootElement,
      requestId,
      environment: resolvedDto.environment,
      endpoint,
      headers: this.maskTiraHeaders(headers),
      businessIdentifiers: {
        companyCode: resolvedDto.companyCode,
        systemCode: resolvedDto.systemCode,
        callbackUrl: resolvedDto.callbackUrl,
        insurerCompanyCode: resolvedDto.insurerCompanyCode,
        tranCompanyCode: resolvedDto.tranCompanyCode,
        salePointCode: resolvedDto.salePointCode,
        productCode: resolvedDto.productCode,
      },
      payload,
      contentXml,
      signature,
      tiraMessageXml,
    };
  }

  async submit(
    dto: CreateCoverNoteDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    this.productWordingValidator.assertCoverNoteWording(dto);

    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.coverNoteNumber,
      );

    const { transaction, coverNote } = await this.createDraft(
      resolvedDto,
      sourceMetadata,
    );

    // Re-check against a fresh server timestamp immediately before building
    // and signing the outbound XML.
    this.normalizeCoverPeriod(resolvedDto);
    coverNote.coverNoteStartDate = new Date(resolvedDto.coverNoteStartDate);
    coverNote.coverNoteEndDate = new Date(resolvedDto.coverNoteEndDate);

    const payload = this.payloadService.buildFromDto({
      dto: resolvedDto,
      requestId: coverNote.requestId,
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

    const requestXml = this.xmlBuilder.buildSignedTiraMessageFromContent({
      contentXml,
      signature,
    });

    const attempt = await this.tiramisSubmissionService.createAttempt({
      transactionId: transaction.id,
      requestId: coverNote.requestId,
      rootElement: this.rootElement,
      requestXml,
      requestSignature: signature,
    });

    coverNote.currentAttemptId = attempt.id;
    await this.coverNoteRepository.save(coverNote);

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration,
        serviceType: this.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    await this.tiramisSubmissionService.markSent(coverNote.requestId);

    try {
      const response = await this.httpClient.postXml({
        requestId: coverNote.requestId,
        url: endpoint,
        xml: requestXml,
        headers,
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const failedAttempt = await this.tiramisSubmissionService.markFailed({
          requestId: coverNote.requestId,
          errorMessage: `TIRAMIS HTTP error: ${response.statusCode}`,
          rawPayload: response.rawXml,
          isRetryable: true,
        });

        return {
          transaction,
          coverNote,
          attempt: failedAttempt,
          tiraResponse: response,
        };
      }

      const acknowledgement = this.xmlParser.extractAcknowledgement(
        response.rawXml,
      );

      if (!acknowledgement.ok || !acknowledgement.statusCode) {
        const failedAttempt = await this.tiramisSubmissionService.markFailed({
          requestId: coverNote.requestId,
          errorMessage:
            acknowledgement.error ||
            'Invalid acknowledgement received from TIRAMIS',
          rawPayload: response.rawXml,
        });

        return {
          transaction,
          coverNote,
          attempt: failedAttempt,
          tiraResponse: response,
        };
      }

      const isAcknowledgementSuccess =
        await this.tiramisConfigService.isSuccessResponse(
          acknowledgement.statusCode,
        );

      const acknowledgedAttempt =
        await this.tiramisSubmissionService.markAcknowledgementReceived({
          requestId: coverNote.requestId,
          acknowledgementId: acknowledgement.acknowledgementId,
          statusCode: acknowledgement.statusCode,
          statusDesc: acknowledgement.statusDesc,
          rawXml: response.rawXml,
          isSuccess: isAcknowledgementSuccess,
        });

      return {
        transaction,
        coverNote,
        attempt: acknowledgedAttempt,
        tiraResponse: response,
      };
    } catch (error: any) {
      const failedAttempt = await this.tiramisSubmissionService.markFailed({
        requestId: coverNote.requestId,
        errorMessage:
          error?.message || 'Failed to submit Non-Motor request to TIRAMIS',
        rawPayload: error?.response?.data || null,
        isRetryable: true,
      });

      return {
        transaction,
        coverNote,
        attempt: failedAttempt,
        tiraResponse: null,
      };
    }
  }

  async findById(id: string) {
    const coverNote = await this.coverNoteRepository.findById(id);

    if (!coverNote) {
      throw new NotFoundException('TIRAMIS cover note not found');
    }

    return coverNote;
  }

  listSubmittedCoverNotes(page?: string, limit?: string) {
    const parsedPage = Number.parseInt(page || '1', 10);
    const parsedLimit = Number.parseInt(limit || '50', 10);

    return this.coverNoteRepository.findSubmittedByInsuranceType({
      insuranceType: 'NON_MOTOR',
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      limit:
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(parsedLimit, 100)
          : 50,
    });
  }

  async findByRequestId(requestId: string) {
    const coverNote = await this.coverNoteRepository.findByRequestId(requestId);

    if (!coverNote) {
      throw new NotFoundException('TIRAMIS cover note not found');
    }

    return coverNote;
  }

  private validateNonMotorPayload(
    dto: CreateCoverNoteDto & Partial<TiramisResolvedRequestDtoFields>,
  ) {
    const errors: string[] = [];

    this.payloadValidator.validateCommonCoverNoteData(dto, errors);
    this.payloadValidator.validateRisks(dto.risks || [], 'risks', errors);
    this.payloadValidator.validateSubjectMatters(
      dto.subjectMatters || [],
      'subjectMatters',
      errors,
    );
    this.payloadValidator.validateAddons(dto.addons || [], 'addons', errors);
    this.payloadValidator.validatePolicyHolders(
      dto.policyHolders || [],
      errors,
    );

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Non-Motor payload validation failed',
        errors,
      });
    }

    this.payloadValidator.validateSignedPricingMatch(dto.risks || []);
  }

  private normalizeCoverPeriod(
    dto: CreateCoverNoteDto & Partial<TiramisResolvedRequestDtoFields>,
  ) {
    const period = this.coverPeriodService.normalize(
      dto.coverNoteStartDate,
      dto.coverNoteEndDate,
    );

    dto.coverNoteStartDate = period.startDateTime;
    dto.coverNoteEndDate = period.endDateTime;
  }

  private maskTiraHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    return {
      ...headers,
      ClientKey: this.maskSecret(headers.ClientKey),
    };
  }

  private maskSecret(value?: string | null): string {
    if (!value) {
      return '';
    }

    if (value.length <= 4) {
      return '****';
    }

    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }
}
