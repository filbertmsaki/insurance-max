import { BadRequestException, Injectable } from '@nestjs/common';

import {
  TiramisConfigService,
  type TiramisResolvedRequestDtoFields,
} from '../../config/services/tiramis-config.service';
import { TiramisCoverNoteRepository } from '../../cover-notes/repositories/tiramis-cover-note.repository';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import { CreateMotorCoverNoteDto } from '../dto/create-motor-cover-note.dto';
import { TiramisMotorRepository } from '../repositories/tiramis-motor.repository';
import { TiramisMotorPayloadService } from './tiramis-motor-payload.service';

@Injectable()
export class TiramisMotorService {
  private readonly rootElement = 'MotorCoverNoteRefReq';

  constructor(
    private readonly coverNoteRepository: TiramisCoverNoteRepository,
    private readonly motorRepository: TiramisMotorRepository,
    private readonly motorPayloadService: TiramisMotorPayloadService,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  async createDraft(
    dto:
      | CreateMotorCoverNoteDto
      | (CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields),
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

    this.validateMotorPayload(resolvedDto);

    const requestId = this.tiramisRequestIdService.generate('AIC');
    const serviceType = resolvedDto.isFleet
      ? 'MOTOR_COVER_NOTE_FLEET'
      : 'MOTOR_COVER_NOTE_NON_FLEET';

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType,
      sourceModule: 'tiramis-motor',
      sourceRecordId: resolvedDto.sourceRecordId,
      businessReference: resolvedDto.coverNoteNumber,
    });

    const coverNote = this.coverNoteRepository.create({
      transactionId: transaction.id,
      insuranceType: 'MOTOR',
      isFleet: resolvedDto.isFleet ? 1 : 0,
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

    if (resolvedDto.isFleet && resolvedDto.fleet) {
      const fleet = this.motorRepository.createFleet({
        coverNoteId: savedCoverNote.id,
        fleetId: resolvedDto.fleet.fleetId,
        fleetType: resolvedDto.fleet.fleetType || null,
        fleetSize: resolvedDto.fleet.fleetSize,
        comprehensiveInsured: resolvedDto.fleet.comprehensiveInsured || null,
      });

      const savedFleet = await this.motorRepository.saveFleet(fleet);

      for (const item of resolvedDto.fleet.items) {
        const fleetItem = this.motorRepository.createFleetItem({
          motorFleetId: savedFleet.id,
          coverNoteId: savedCoverNote.id,
          fleetEntry: item.fleetEntry || null,
          coverNoteNumber: item.coverNoteNumber,
          prevCoverNoteReferenceNumber:
            item.prevCoverNoteReferenceNumber || null,
          coverNoteDesc: item.coverNoteDesc || resolvedDto.coverNoteDesc,
          operativeClause: item.operativeClause || resolvedDto.operativeClause,
          endorsementType: item.endorsementType || null,
          endorsementReason: item.endorsementReason || null,
          endorsementPremiumEarned: item.endorsementPremiumEarned || null,
        });

        const savedFleetItem =
          await this.motorRepository.saveFleetItem(fleetItem);

        const motorDetail = this.motorRepository.createMotorDetail({
          coverNoteId: savedCoverNote.id,
          motorFleetItemId: savedFleetItem.id,
          ...this.mapMotorDetailForEntity(item.motorDetail),
        });

        await this.motorRepository.saveMotorDetail(motorDetail);
      }
    }

    if (!resolvedDto.isFleet && resolvedDto.motorDetail) {
      const motorDetail = this.motorRepository.createMotorDetail({
        coverNoteId: savedCoverNote.id,
        motorFleetItemId: null,
        ...this.mapMotorDetailForEntity(resolvedDto.motorDetail),
      });

      await this.motorRepository.saveMotorDetail(motorDetail);
    }

    return {
      transaction,
      coverNote: savedCoverNote,
    };
  }

  async submit(dto: CreateMotorCoverNoteDto) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.isFleet
          ? dto.fleet?.fleetId || dto.coverNoteNumber
          : dto.coverNoteNumber,
      );

    const { transaction, coverNote } = await this.createDraft(resolvedDto);

    const serviceType = dto.isFleet
      ? 'MOTOR_COVER_NOTE_FLEET'
      : 'MOTOR_COVER_NOTE_NON_FLEET';

    const payload = this.motorPayloadService.buildMotorCoverNotePayload({
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
        serviceType,
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

    const acknowledgementStatusCode =
      this.xmlParser.getStatusCode(response.rawXml) || 'UNKNOWN';
    const acknowledgementStatusDesc =
      this.xmlParser.getStatusDesc(response.rawXml) || undefined;
    const acknowledgementId =
      this.xmlParser.getAcknowledgementId(response.rawXml) || undefined;
    const isAcknowledgementSuccess =
      await this.tiramisConfigService.isSuccessResponse(
        acknowledgementStatusCode,
      );
    const acknowledgedAttempt =
      await this.tiramisSubmissionService.markAcknowledgementReceived({
        requestId: coverNote.requestId,
        acknowledgementId,
        statusCode: acknowledgementStatusCode,
        statusDesc: acknowledgementStatusDesc,
        rawXml: response.rawXml,
        isSuccess: isAcknowledgementSuccess,
      });

    return {
      coverNote,
      attempt: acknowledgedAttempt,
      tiraResponse: response,
    };
  }

  async findFleetByCoverNoteId(coverNoteId: string) {
    return this.motorRepository.findFleetByCoverNoteId(coverNoteId);
  }

  async findMotorDetailsByCoverNoteId(coverNoteId: string) {
    return this.motorRepository.findMotorDetailsByCoverNoteId(coverNoteId);
  }

  private validateMotorPayload(dto: CreateMotorCoverNoteDto) {
    if (dto.isFleet && !dto.fleet) {
      throw new BadRequestException(
        'Fleet details are required for fleet motor submission',
      );
    }

    if (dto.isFleet && (!dto.fleet?.items || dto.fleet.items.length === 0)) {
      throw new BadRequestException('At least one fleet item is required');
    }

    if (!dto.isFleet && !dto.motorDetail) {
      throw new BadRequestException(
        'Motor detail is required for non-fleet motor submission',
      );
    }
  }

  private mapMotorDetailForEntity(motor: any) {
    return {
      motorCategory: motor.motorCategory || null,
      motorType: motor.motorType || null,
      registrationNumber: motor.registrationNumber || null,
      chassisNumber: motor.chassisNumber,
      make: motor.make || null,
      model: motor.model || null,
      modelNumber: motor.modelNumber || null,
      bodyType: motor.bodyType || null,
      color: motor.color || null,
      engineNumber: motor.engineNumber || null,
      engineCapacity: motor.engineCapacity || null,
      fuelUsed: motor.fuelUsed || null,
      numberOfAxles: motor.numberOfAxles || null,
      axleDistance: motor.axleDistance || null,
      sittingCapacity: motor.sittingCapacity || null,
      yearOfManufacture: motor.yearOfManufacture || null,
      tareWeight: motor.tareWeight || null,
      grossWeight: motor.grossWeight || null,
      motorUsage: motor.motorUsage || null,
      ownerName: motor.ownerName || null,
      ownerCategory: motor.ownerCategory || null,
      ownerAddress: motor.ownerAddress || null,
    };
  }
}
