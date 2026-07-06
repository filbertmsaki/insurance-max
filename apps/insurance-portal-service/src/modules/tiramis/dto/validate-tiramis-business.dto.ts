import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

export class ValidateTiramisBusinessDto {
  @ApiPropertyOptional({
    enum: TiramisRequestType,
    example: TiramisRequestType.NIN_VERIFICATION,
  })
  @IsEnum(TiramisRequestType)
  requestType!: TiramisRequestType;

  @ApiPropertyOptional({
    example: 'verifications',
  })
  @IsString()
  sourceModule!: string;

  @ApiPropertyOptional({
    example: '19900101123456789001',
  })
  @IsString()
  sourceRecordId!: string;

  @ApiPropertyOptional({
    example: {
      nin: '19900101123456789001',
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
