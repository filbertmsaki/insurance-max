import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum MotorVerificationCategory { MOTOR_VEHICLE = 1, MOTORCYCLE = 2 }
export class MotorVerificationDto {
  @ApiProperty({ enum: MotorVerificationCategory, example: 1 }) @IsEnum(MotorVerificationCategory) motorCategory!: MotorVerificationCategory;
  @ApiPropertyOptional({ example: 'T123ABC' }) @IsOptional() @IsString() @MaxLength(50) motorRegistrationNumber?: string;
  @ApiPropertyOptional({ example: 'MOCKCHASSIS123456' }) @IsOptional() @IsString() @MaxLength(50) motorChassisNumber?: string;
}
export class CoverNoteVerificationDto {
  @ApiPropertyOptional({ example: 'TIRA-CN-000001' }) @IsOptional() @IsString() @MaxLength(50) coverNoteReferenceNumber?: string;
  @ApiPropertyOptional({ example: 'STK000001' }) @IsOptional() @IsString() @MaxLength(50) stickerNumber?: string;
  @ApiPropertyOptional({ example: 'T123ABC' }) @IsOptional() @IsString() @MaxLength(50) motorRegistrationNumber?: string;
  @ApiPropertyOptional({ example: 'MOCKCHASSIS123456' }) @IsOptional() @IsString() @MaxLength(50) motorChassisNumber?: string;
}
