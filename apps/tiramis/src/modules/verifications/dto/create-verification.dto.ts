import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { MotorCategory } from '../constants/tiramis-verification.constants';

export class BaseVerificationDto {}

export class CoverNoteVerificationDto extends BaseVerificationDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'TIRA-CN-000001',
  })
  coverNoteReferenceNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50, example: 'STK000001' })
  stickerNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50, example: 'T123ABC' })
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'MOCKCHASSIS123456',
  })
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
  @ApiProperty({
    enum: MotorCategory,
    enumName: 'MotorCategory',
    example: MotorCategory.MOTOR_VEHICLE,
    description: '1 = Motor vehicle, 2 = Motorcycle',
  })
  motorCategory!: MotorCategory;

  @ApiPropertyOptional({ nullable: true, maxLength: 50, example: 'T123ABC' })
  motorRegistrationNumber?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'MOCKCHASSIS123456',
  })
  motorChassisNumber?: string | null;
}
