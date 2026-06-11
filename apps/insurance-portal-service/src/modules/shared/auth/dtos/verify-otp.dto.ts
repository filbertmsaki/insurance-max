import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { OtpPurpose } from '../../otp/entities/otp-verification.entity';

export class VerifyOtpDto {
  @ApiProperty({ example: 'uuid-of-otp-record' })
  @IsString()
  @IsNotEmpty()
  otp_id: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code: string;

  @ApiProperty({ example: 'user@example.com or +255712345678' })
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiProperty({ enum: OtpPurpose })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
