import { Injectable } from '@nestjs/common';

import type {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  DetailsVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';
import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';

@Injectable()
export class TiramisVerificationPayloadService {
  buildCoverNoteVerification(
    dto: CoverNoteVerificationDto & TiramisResolvedRequestDtoFields,
    requestId: string,
  ): Record<string, any> {
    // TIRA permits any supported verification criterion. Preserve the
    // contract order while omitting values that were not supplied.
    const verificationDtl: Record<string, any> = {};

    if (dto.coverNoteReferenceNumber) {
      verificationDtl.CoverNoteReferenceNumber = dto.coverNoteReferenceNumber;
    }

    if (dto.stickerNumber) {
      verificationDtl.StickerNumber = dto.stickerNumber;
    }

    if (dto.motorRegistrationNumber) {
      verificationDtl.MotorRegistrationNumber = dto.motorRegistrationNumber;
    }

    if (dto.motorChassisNumber) {
      verificationDtl.MotorChassisNumber = dto.motorChassisNumber;
    }

    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: verificationDtl,
    };
  }

  buildNinVerification(
    dto: NinVerificationDto & TiramisResolvedRequestDtoFields,
    requestId: string,
  ): Record<string, any> {
    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: {
        NationalIdentificationNumber: dto.nin,
      },
    };
  }

  buildCompanyVerification(
    dto: CompanyVerificationDto & TiramisResolvedRequestDtoFields,
    requestId: string,
  ): Record<string, any> {
    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: {
        IncorporationCertificateNumber: dto.incorporationCertificateNumber,
      },
    };
  }

  buildMotorVerification(
    dto: MotorVerificationDto & TiramisResolvedRequestDtoFields,
    requestId: string,
  ): Record<string, any> {
    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: {
        MotorCategory: dto.motorCategory,
        MotorRegistrationNumber: dto.motorRegistrationNumber || '',
        MotorChassisNumber: dto.motorChassisNumber || '',
      },
    };
  }

  buildDetailsVerification(
    dto: DetailsVerificationDto & TiramisResolvedRequestDtoFields,
    requestId: string,
  ): Record<string, any> {
    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: {
        MotorRegistrationNumber: dto.motorRegistrationNumber || '',
        MotorChassisNumber: dto.motorChassisNumber || '',
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber || '',
        StickerNumber: dto.stickerNumber || '',
      },
    };
  }

  private buildHeader(dto: TiramisResolvedRequestDtoFields, requestId: string) {
    return {
      RequestId: requestId,
      CompanyCode: dto.companyCode,
      SystemCode: dto.systemCode,
    };
  }
}
