import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({ example: '+255712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+255[67]\d{8}$/, {
    message: 'Phone must be a valid Tanzanian number (+255XXXXXXXXX)',
  })
  phone: string;
}

export class PhoneLoginDto {
  @ApiProperty({ example: '+255712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+255[67]\d{8}$/, {
    message: 'Phone must be a valid Tanzanian number (+255XXXXXXXXX)',
  })
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP sent via SMS' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;

  @ApiProperty({ required: false, example: 'otp-verification-uuid' })
  @IsString()
  @IsNotEmpty()
  otp_id: string;
}
