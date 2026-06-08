import { Injectable, NotFoundException } from '@nestjs/common';

import {
  TiramisConfigService,
  type TiramisResolvedRequestDtoFields,
} from '../../config/services/tiramis-config.service';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
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
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  async createDraft(
    dto:
      | CreateCoverNoteDto
      | (CreateCoverNoteDto & TiramisResolvedRequestDtoFields),
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

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType: this.serviceType,
      sourceModule: 'tiramis-cover-notes',
      sourceRecordId: resolvedDto.sourceRecordId,
      businessReference: resolvedDto.coverNoteNumber,
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

  async submit(dto: CreateCoverNoteDto) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.coverNoteNumber,
      );

    const { transaction, coverNote } = await this.createDraft(resolvedDto);

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

    const requestXml = this.xmlBuilder.buildSignedTiraMessage({
      rootName: this.rootElement,
      payload,
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

    const response = await this.httpClient.postXml({
      url: endpoint,
      xml: requestXml,
      headers,
    });

    return {
      coverNote,
      attempt,
      tiraResponse: response,
    };
  }

  async findById(id: string) {
    const coverNote = await this.coverNoteRepository.findById(id);

    if (!coverNote) {
      throw new NotFoundException('TIRAMIS cover note not found');
    }

    return coverNote;
  }

  async findByRequestId(requestId: string) {
    const coverNote = await this.coverNoteRepository.findByRequestId(requestId);

    if (!coverNote) {
      throw new NotFoundException('TIRAMIS cover note not found');
    }

    return coverNote;
  }
}
