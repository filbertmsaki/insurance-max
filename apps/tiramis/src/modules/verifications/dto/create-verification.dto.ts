import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

import { MotorCategory } from '../constants/tiramis-verification.constants';

export class BaseVerificationDto {
  @ApiPropertyOptional({ nullable: true, example: 'ICC110' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  companyCode?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'LSYS_ALLIANCE_003' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  systemCode?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'insurance-portal-service' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceService?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'verifications' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceModule?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '19900101123456789001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  clientConfigurationId?: string | null;
}

export class CoverNoteVerificationDto extends BaseVerificationDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'TIRA-CN-000001',
  })
  @IsOptional()
  coverNoteReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50, example: 'STK000001' })
  @IsOptional()
  stickerNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50, example: 'T123ABC' })
  @IsOptional()
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'MOCKCHASSIS123456',
  })
  @IsOptional()
  motorChassisNumber?: string | null;
}

export class NinVerificationDto extends BaseVerificationDto {
  @ApiProperty({ example: '19900101123456789000' })
  @IsOptional()
  nin!: string;
}

export class CompanyVerificationDto extends BaseVerificationDto {
  @ApiProperty({ example: 'INC-123456' })
  @IsOptional()
  incorporationCertificateNumber!: string;
}

export class MotorVerificationDto extends BaseVerificationDto {
  @ApiProperty({
    enum: MotorCategory,
    enumName: 'MotorCategory',
    example: MotorCategory.MOTOR_VEHICLE,
    description: '1 = Motor vehicle, 2 = Motorcycle',
  })
  @IsOptional()
  motorCategory!: MotorCategory;

  @ApiPropertyOptional({ nullable: true, maxLength: 50, example: 'T123ABC' })
  @IsOptional()
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'MOCKCHASSIS123456',
  })
  @IsOptional()
  motorChassisNumber?: string | null;
}
