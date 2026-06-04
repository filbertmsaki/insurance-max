import { Injectable } from '@nestjs/common';

import {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  DetailsVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';

@Injectable()
export class TiramisVerificationPayloadService {
  buildCoverNoteVerification(
    dto: CoverNoteVerificationDto,
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
    dto: NinVerificationDto,
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
    dto: CompanyVerificationDto,
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
    dto: MotorVerificationDto,
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
    dto: DetailsVerificationDto,
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
    dto: {
      companyCode: string;
      systemCode: string;
    },
    requestId: string,
  ) {
    return {
      RequestId: requestId,
      CompanyCode: dto.companyCode,
      SystemCode: dto.systemCode,
    };
  }
}
