import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  OtpChannel,
  OtpPurpose,
} from '../../otp/entities/otp-verification.entity';

export class SendOtpDto {
  @ApiProperty({ enum: OtpChannel, example: OtpChannel.SMS })
  @IsEnum(OtpChannel)
  channel: OtpChannel;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.LOGIN })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @ApiPropertyOptional({ example: '+255712345678' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'Invalid phone number format' })
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
