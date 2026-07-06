import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

export class SubmitAnyTiramisBusinessDto {
  @ApiPropertyOptional({
    enum: TiramisRequestType,
    example: TiramisRequestType.NIN_VERIFICATION,
  })
  @IsOptional()
  @IsEnum(TiramisRequestType)
  requestType?: TiramisRequestType;

  @ApiPropertyOptional({
    example: 'verifications',
    description: 'Logical source module owning the business record.',
  })
  @IsOptional()
  @IsString()
  sourceModule?: string;

  @ApiPropertyOptional({
    example: '19900101123456789001',
  })
  @IsOptional()
  @IsString()
  sourceRecordId?: string;

  @ApiPropertyOptional({
    example: '19900101123456789001',
  })
  @IsOptional()
  @IsString()
  businessReference?: string;

  @ApiPropertyOptional({
    example: {
      nin: '19900101123456789001',
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceResubmit?: boolean;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  returnExisting?: boolean;
}
