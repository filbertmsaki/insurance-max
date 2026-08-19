import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { MotorCategory } from '../constants/tiramis-verification.constants';

export class BaseVerificationDto {
  /**
   * Optional local correlator for this verification (e.g. your own record
   * id) used for tracking/idempotency. Everything else needed to route and
   * authorize the request (companyCode, systemCode, callbackUrl,
   * clientConfigurationId, environment) is resolved server-side from the
   * authenticated API key's bound TIRAMIS configuration and is never
   * accepted from the caller.
   */
  @ApiPropertyOptional({ nullable: true, example: '19900101123456789001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string | null;
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
