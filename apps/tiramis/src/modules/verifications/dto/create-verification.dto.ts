import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BaseVerificationDto {}

export class CoverNoteVerificationDto extends BaseVerificationDto {
  @ApiPropertyOptional({ nullable: true, example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'STK000001' })
  stickerNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'T123ABC' })
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MOCKCHASSIS123456' })
  motorChassisNumber?: string | null;
}

export class NinVerificationDto extends BaseVerificationDto {
  @ApiProperty({ example: '19900101123456789000' })
  nin!: string;
}

export class CompanyVerificationDto extends BaseVerificationDto {
  @ApiProperty({ example: 'INC-123456' })
  incorporationCertificateNumber!: string;
}

export class MotorVerificationDto extends BaseVerificationDto {
  @ApiPropertyOptional({ nullable: true, example: 'T123ABC' })
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MOCKCHASSIS123456' })
  motorChassisNumber?: string | null;
}

export class DetailsVerificationDto extends BaseVerificationDto {
  @ApiPropertyOptional({ nullable: true, example: 'T123ABC' })
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MOCKCHASSIS123456' })
  motorChassisNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'TIRA-CN-000001' })
  coverNoteReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'STK000001' })
  stickerNumber?: string | null;
}
