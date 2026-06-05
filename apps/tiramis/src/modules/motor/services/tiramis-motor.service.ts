import { BadRequestException, Injectable } from '@nestjs/common';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisCoverNoteRepository } from '../../cover-notes/repositories/tiramis-cover-note.repository';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
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
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  async createDraft(dto: CreateMotorCoverNoteDto) {
    this.validateMotorPayload(dto);

    const requestId = this.tiramisRequestIdService.generate('AIC');
    const serviceType = dto.isFleet
      ? 'MOTOR_COVER_NOTE_FLEET'
      : 'MOTOR_COVER_NOTE_NON_FLEET';

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: dto.clientConfigurationId,
      serviceType,
      sourceModule: dto.sourceModule || 'tiramis-motor',
      sourceRecordId: dto.sourceRecordId,
      businessReference: dto.coverNoteNumber,
    });

    const coverNote = this.coverNoteRepository.create({
      transactionId: transaction.id,
      insuranceType: 'MOTOR',
      isFleet: dto.isFleet ? 1 : 0,
      requestId,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
      callbackUrl: dto.callbackUrl,
      insurerCompanyCode: dto.insurerCompanyCode,
      tranCompanyCode: dto.tranCompanyCode || null,
      coverNoteType: dto.coverNoteType,
      coverNoteNumber: dto.coverNoteNumber,
      prevCoverNoteReferenceNumber: dto.prevCoverNoteReferenceNumber || null,
      salePointCode: dto.salePointCode,
      coverNoteStartDate: new Date(dto.coverNoteStartDate),
      coverNoteEndDate: new Date(dto.coverNoteEndDate),
      coverNoteDesc: dto.coverNoteDesc,
      operativeClause: dto.operativeClause,
      paymentMode: dto.paymentMode,
      currencyCode: dto.currencyCode,
      exchangeRate: dto.exchangeRate,
      totalPremiumExcludingTax: dto.totalPremiumExcludingTax,
      totalPremiumIncludingTax: dto.totalPremiumIncludingTax,
      commissionPaid: dto.commissionPaid || null,
      commissionRate: dto.commissionRate || null,
      officerName: dto.officerName,
      officerTitle: dto.officerTitle,
      productCode: dto.productCode,
      endorsementType: dto.endorsementType || null,
      endorsementReason: dto.endorsementReason || null,
      endorsementPremiumEarned: dto.endorsementPremiumEarned || null,
      policyHolders: dto.policyHolders.map((holder) => ({
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

    if (dto.isFleet && dto.fleet) {
      const fleet = this.motorRepository.createFleet({
        coverNoteId: savedCoverNote.id,
        fleetId: dto.fleet.fleetId,
        fleetType: dto.fleet.fleetType || null,
        fleetSize: dto.fleet.fleetSize,
        comprehensiveInsured: dto.fleet.comprehensiveInsured || null,
      });

      const savedFleet = await this.motorRepository.saveFleet(fleet);

      for (const item of dto.fleet.items) {
        const fleetItem = this.motorRepository.createFleetItem({
          motorFleetId: savedFleet.id,
          coverNoteId: savedCoverNote.id,
          fleetEntry: item.fleetEntry || null,
          coverNoteNumber: item.coverNoteNumber,
          prevCoverNoteReferenceNumber:
            item.prevCoverNoteReferenceNumber || null,
          coverNoteDesc: item.coverNoteDesc || dto.coverNoteDesc,
          operativeClause: item.operativeClause || dto.operativeClause,
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

    if (!dto.isFleet && dto.motorDetail) {
      const motorDetail = this.motorRepository.createMotorDetail({
        coverNoteId: savedCoverNote.id,
        motorFleetItemId: null,
        ...this.mapMotorDetailForEntity(dto.motorDetail),
      });

      await this.motorRepository.saveMotorDetail(motorDetail);
    }

    return {
      transaction,
      coverNote: savedCoverNote,
    };
  }

  async submit(dto: CreateMotorCoverNoteDto) {
    const { transaction, coverNote } = await this.createDraft(dto);

    const serviceType = dto.isFleet
      ? 'MOTOR_COVER_NOTE_FLEET'
      : 'MOTOR_COVER_NOTE_NON_FLEET';

    const payload = this.motorPayloadService.buildMotorCoverNotePayload({
      dto,
      requestId: coverNote.requestId,
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
      requestId: coverNote.requestId,
      rootElement: this.rootElement,
      requestXml,
      requestSignature: signature,
    });

    coverNote.currentAttemptId = attempt.id;
    await this.coverNoteRepository.save(coverNote);

    const endpoint = await this.tiramisConfigService.getFullEndpointUrl({
      environment: dto.environment,
      serviceType,
    });

    const headers = await this.tiramisConfigService.getRequestHeaders(
      dto.environment,
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
