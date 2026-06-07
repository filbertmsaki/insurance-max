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
    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: {
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber || '',
        StickerNumber: dto.stickerNumber || '',
        MotorRegistrationNumber: dto.motorRegistrationNumber || '',
        MotorChassisNumber: dto.motorChassisNumber || '',
      },
    };
  }

  buildNinVerification(
    dto: NinVerificationDto & TiramisResolvedRequestDtoFields,
    requestId: string,
  ): Record<string, any> {
    return {
      VerificationHdr: this.buildHeader(dto, requestId),
      VerificationDtl: {
        NIN: dto.nin,
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
        RegistrationNumber: dto.motorRegistrationNumber || '',
        ChassisNumber: dto.motorChassisNumber || '',
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
        RegistrationNumber: dto.motorRegistrationNumber || '',
        ChassisNumber: dto.motorChassisNumber || '',
        CoverNoteReferenceNumber: dto.coverNoteReferenceNumber || '',
        StickerNumber: dto.stickerNumber || '',
      },
    };
  }

  private buildHeader(
    dto: TiramisResolvedRequestDtoFields,
    requestId: string,
  ) {
    return {
      RequestId: requestId,
      CompanyCode: dto.companyCode,
      SystemCode: dto.systemCode,
    };
  }
}
