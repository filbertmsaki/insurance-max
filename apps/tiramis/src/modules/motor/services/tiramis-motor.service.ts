import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import {
  TiramisConfigService,
  type TiramisResolvedRequestDtoFields,
} from '../../config/services/tiramis-config.service';
import { TiramisCoverNoteRepository } from '../../cover-notes/repositories/tiramis-cover-note.repository';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisPayloadValidationService } from '../../shared/services/tiramis-payload-validation.service';
import { TiramisProductWordingValidationService } from '../../../common/services/tiramis-product-wording-validation.service';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSourceMetadataDto } from '../../submissions/dto/tiramis-source-metadata.dto';
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
    private readonly payloadValidator: TiramisPayloadValidationService,
    private readonly productWordingValidator: TiramisProductWordingValidationService,
  ) {}

  async createDraft(
    dto:
      | CreateMotorCoverNoteDto
      | (CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields),
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

    this.validateMotorPayload(resolvedDto);

    const requestId =
      sourceMetadata?.requestId || this.tiramisRequestIdService.generate('AIC');
    const serviceType = resolvedDto.isFleet
      ? 'MOTOR_COVER_NOTE_FLEET'
      : 'MOTOR_COVER_NOTE_NON_FLEET';

    const transaction = await this.tiramisSubmissionService.createTransaction({
      clientConfigurationId: resolvedDto.clientConfigurationId,
      serviceType,
      sourceService: sourceMetadata?.sourceService || 'tiramis-service',
      sourceCompanyId: sourceMetadata?.sourceCompanyId || null,
      sourceUserId: sourceMetadata?.sourceUserId || null,
      sourceModule: sourceMetadata?.sourceModule || 'motor',
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

  async previewXml(dto: CreateMotorCoverNoteDto, includeSignature = true) {
    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.isFleet
          ? dto.fleet?.fleetId || dto.coverNoteNumber
          : dto.coverNoteNumber,
      );

    this.validateMotorPayload(resolvedDto);

    const serviceType = resolvedDto.isFleet
      ? 'MOTOR_COVER_NOTE_FLEET'
      : 'MOTOR_COVER_NOTE_NON_FLEET';

    const requestId = this.tiramisRequestIdService.generate('AIC');

    const payload = this.motorPayloadService.buildMotorCoverNotePayload({
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
        serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    return {
      previewOnly: true,
      submittedToTira: false,
      serviceType,
      rootElement: this.rootElement,
      requestId,
      environment: resolvedDto.environment,
      isFleet: !!resolvedDto.isFleet,
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
    dto: CreateMotorCoverNoteDto,
    sourceMetadata?: TiramisSourceMetadataDto,
  ) {
    this.productWordingValidator.assertCoverNoteWording(dto);

    const { configuration, dto: resolvedDto } =
      await this.tiramisConfigService.resolveSubmissionContext(
        dto,
        dto.isFleet
          ? dto.fleet?.fleetId || dto.coverNoteNumber
          : dto.coverNoteNumber,
      );

    const { transaction, coverNote } = await this.createDraft(
      resolvedDto,
      sourceMetadata,
    );

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
        serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    await this.tiramisSubmissionService.markSent(coverNote.requestId);

    try {
      const response = await this.httpClient.postXml({
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
            'Invalid motor acknowledgement received from TIRAMIS',
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
          error?.message || 'Failed to submit Motor request to TIRAMIS',
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

  async findFleetByCoverNoteId(coverNoteId: string) {
    return this.findCompleteSubmissionSnapshot(coverNoteId);
  }

  async findMotorDetailsByCoverNoteId(coverNoteId: string) {
    return this.findCompleteSubmissionSnapshot(coverNoteId);
  }

  private async findCompleteSubmissionSnapshot(identifier: string) {
    const coverNote = await this.resolveCoverNote(identifier);

    if (!coverNote) {
      throw new NotFoundException('TIRAMIS motor cover note not found');
    }

    const [fullCoverNote, fleet, motorDetails, submission] = await Promise.all([
      this.coverNoteRepository.findById(coverNote.id),
      this.motorRepository.findFleetByCoverNoteId(coverNote.id),
      this.motorRepository.findMotorDetailsByCoverNoteId(coverNote.id),
      this.tiramisSubmissionService.getSubmissionTrace({
        transactionId: coverNote.transactionId,
        includePayload: true,
      }),
    ]);

    return {
      coverNote: fullCoverNote,
      motorDetails,
      fleet,
      submission,
    };
  }

  private async resolveCoverNote(identifier: string) {
    let coverNote = isUUID(identifier)
      ? await this.coverNoteRepository.findById(identifier)
      : null;

    coverNote ||= await this.coverNoteRepository.findByRequestId(identifier);
    coverNote ||=
      await this.coverNoteRepository.findByCoverNoteNumber(identifier);
    coverNote ||=
      await this.coverNoteRepository.findByCoverNoteReferenceNumber(identifier);

    if (coverNote) {
      return coverNote;
    }

    const attempt =
      await this.tiramisSubmissionService.findAttemptByRequestId(identifier);

    return attempt
      ? this.coverNoteRepository.findByTransactionId(attempt.transactionId)
      : null;
  }

  private validateMotorPayload(
    dto: CreateMotorCoverNoteDto & Partial<TiramisResolvedRequestDtoFields>,
  ) {
    const errors: string[] = [];

    this.payloadValidator.validateCommonCoverNoteData(dto, errors);

    if (dto.isFleet) {
      this.validateFleet(dto, errors);
    } else {
      if (!dto.motorDetail) {
        errors.push('motorDetail is required for non-fleet motor submission');
      } else {
        this.validateMotorDetail(dto.motorDetail, 'motorDetail', errors);
      }

      this.payloadValidator.validateRisks(dto.risks || [], 'risks', errors);
      this.payloadValidator.validateSubjectMatters(
        dto.subjectMatters || [],
        'subjectMatters',
        errors,
      );
      this.payloadValidator.validateAddons(dto.addons || [], 'addons', errors);
    }

    this.payloadValidator.validatePolicyHolders(
      dto.policyHolders || [],
      errors,
    );

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Motor payload validation failed',
        validation_errors: errors,
        errors,
      });
    }

    this.payloadValidator.validateSignedPricingMatch(
      this.collectRisksForPricingMatch(dto),
    );
  }

  /**
   * Flattens the risk rows a signed pricing context could apply to: the
   * top-level risks for a non-fleet submission, or every fleet item's
   * effective risk rows (falling back to the shared dto.risks when an item
   * does not override them) for a fleet submission.
   */
  private collectRisksForPricingMatch(
    dto: CreateMotorCoverNoteDto & Partial<TiramisResolvedRequestDtoFields>,
  ): any[] {
    if (!dto.isFleet) {
      return dto.risks || [];
    }

    return (dto.fleet?.items || []).flatMap((item: any) =>
      item.risks && item.risks.length > 0 ? item.risks : dto.risks || [],
    );
  }

  private validateFleet(
    dto: CreateMotorCoverNoteDto & Partial<TiramisResolvedRequestDtoFields>,
    errors: string[],
  ) {
    if (!dto.fleet) {
      errors.push('fleet is required when isFleet is true');
      return;
    }

    this.payloadValidator.requireString(
      dto.fleet.fleetId,
      'fleet.fleetId',
      errors,
    );
    this.payloadValidator.requireNumber(
      dto.fleet.fleetType,
      'fleet.fleetType',
      errors,
    );
    this.payloadValidator.requirePositiveNumber(
      dto.fleet.fleetSize,
      'fleet.fleetSize',
      errors,
    );
    this.payloadValidator.requirePositiveNumber(
      dto.fleet.comprehensiveInsured,
      'fleet.comprehensiveInsured',
      errors,
    );

    if (!dto.fleet.items || dto.fleet.items.length === 0) {
      errors.push('fleet.items must contain at least one vehicle');
      return;
    }

    if (Number(dto.fleet.fleetSize) !== dto.fleet.items.length) {
      errors.push(
        `fleet.fleetSize (${dto.fleet.fleetSize}) must match fleet.items length (${dto.fleet.items.length})`,
      );
    }

    const coverNoteNumbers = new Set<string>();
    const fleetEntries = new Set<string>();

    dto.fleet.items.forEach((item: any, index) => {
      const path = `fleet.items[${index}]`;

      this.payloadValidator.requireString(
        item.coverNoteNumber,
        `${path}.coverNoteNumber`,
        errors,
      );

      if (!this.payloadValidator.isBlank(item.coverNoteNumber)) {
        const coverNoteNumber = String(item.coverNoteNumber).trim();

        if (coverNoteNumbers.has(coverNoteNumber)) {
          errors.push(`${path}.coverNoteNumber is duplicated`);
        }

        coverNoteNumbers.add(coverNoteNumber);
      }

      if (!this.payloadValidator.isBlank(item.fleetEntry)) {
        const fleetEntry = String(item.fleetEntry).trim();

        if (fleetEntries.has(fleetEntry)) {
          errors.push(`${path}.fleetEntry is duplicated`);
        }

        fleetEntries.add(fleetEntry);
      }

      if (!item.motorDetail) {
        errors.push(`${path}.motorDetail is required`);
      } else {
        this.validateMotorDetail(
          item.motorDetail,
          `${path}.motorDetail`,
          errors,
        );
      }

      const itemRisks =
        item.risks && item.risks.length > 0 ? item.risks : dto.risks || [];

      this.payloadValidator.validateRisks(itemRisks, `${path}.risks`, errors);

      const itemSubjectMatters =
        item.subjectMatters && item.subjectMatters.length > 0
          ? item.subjectMatters
          : dto.subjectMatters || [];

      this.payloadValidator.validateSubjectMatters(
        itemSubjectMatters,
        `${path}.subjectMatters`,
        errors,
      );

      const itemAddons =
        item.addons && item.addons.length > 0 ? item.addons : dto.addons || [];

      this.payloadValidator.validateAddons(
        itemAddons,
        `${path}.addons`,
        errors,
      );
    });
  }

  private validateMotorDetail(motor: any, path: string, errors: string[]) {
    this.payloadValidator.requireNumberIn(
      motor.motorCategory,
      `${path}.motorCategory`,
      [1, 2],
      errors,
    );
    this.payloadValidator.requireNumberIn(
      motor.motorType,
      `${path}.motorType`,
      [1, 2],
      errors,
    );

    if (Number(motor.motorType) === 1) {
      this.payloadValidator.requireString(
        motor.registrationNumber,
        `${path}.registrationNumber`,
        errors,
      );
    }

    this.payloadValidator.requireString(
      motor.chassisNumber,
      `${path}.chassisNumber`,
      errors,
    );
    this.payloadValidator.requireString(motor.make, `${path}.make`, errors);
    this.payloadValidator.requireString(motor.model, `${path}.model`, errors);
    this.payloadValidator.requireString(
      motor.bodyType,
      `${path}.bodyType`,
      errors,
    );
    this.payloadValidator.requireString(motor.color, `${path}.color`, errors);
    this.payloadValidator.requireString(
      motor.engineNumber,
      `${path}.engineNumber`,
      errors,
    );
    this.payloadValidator.requireString(
      motor.engineCapacity,
      `${path}.engineCapacity`,
      errors,
    );
    this.payloadValidator.requireString(
      motor.fuelUsed,
      `${path}.fuelUsed`,
      errors,
    );

    this.payloadValidator.requirePositiveNumber(
      motor.sittingCapacity,
      `${path}.sittingCapacity`,
      errors,
    );

    this.payloadValidator.requirePositiveNumber(
      motor.yearOfManufacture,
      `${path}.yearOfManufacture`,
      errors,
    );

    const year = Number(motor.yearOfManufacture);
    const currentYear = new Date().getFullYear();

    if (year && (year < 1900 || year > currentYear + 1)) {
      errors.push(`${path}.yearOfManufacture is not valid`);
    }

    this.payloadValidator.requireNumberIn(
      motor.motorUsage,
      `${path}.motorUsage`,
      [1, 2],
      errors,
    );
    this.payloadValidator.requireString(
      motor.ownerName,
      `${path}.ownerName`,
      errors,
    );
    this.payloadValidator.requireNumber(
      motor.ownerCategory,
      `${path}.ownerCategory`,
      errors,
    );
    this.payloadValidator.requireString(
      motor.ownerAddress,
      `${path}.ownerAddress`,
      errors,
    );
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
