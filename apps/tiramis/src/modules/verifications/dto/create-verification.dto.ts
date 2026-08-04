import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

import { MotorCategory } from '../constants/tiramis-verification.constants';

export class BaseVerificationDto {}

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
