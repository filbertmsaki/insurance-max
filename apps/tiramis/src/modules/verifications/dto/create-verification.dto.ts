export interface BaseVerificationDto {
  environment: string;
  clientConfigurationId: string;
  sourceModule?: string;
  sourceRecordId?: string;
  companyCode: string;
  systemCode: string;
}

export interface CoverNoteVerificationDto extends BaseVerificationDto {
  coverNoteReferenceNumber?: string | null;
  stickerNumber?: string | null;
  motorRegistrationNumber?: string | null;
  motorChassisNumber?: string | null;
}

export interface NinVerificationDto extends BaseVerificationDto {
  nin: string;
}

export interface CompanyVerificationDto extends BaseVerificationDto {
  incorporationCertificateNumber: string;
}

export interface MotorVerificationDto extends BaseVerificationDto {
  motorRegistrationNumber?: string | null;
  motorChassisNumber?: string | null;
}

export interface DetailsVerificationDto extends BaseVerificationDto {
  motorRegistrationNumber?: string | null;
  motorChassisNumber?: string | null;
  coverNoteReferenceNumber?: string | null;
  stickerNumber?: string | null;
}
