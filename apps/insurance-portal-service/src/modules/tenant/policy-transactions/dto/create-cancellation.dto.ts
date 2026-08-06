import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CancellationMethod,
  CancellationReasonType,
} from '@insurance-max/contracts';

export class CreateCancellationDto {
  @ApiProperty()
  @IsDateString()
  effective_date: string;

  @ApiProperty({ enum: CancellationReasonType })
  @IsEnum(CancellationReasonType)
  reason_type: CancellationReasonType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiPropertyOptional({ enum: CancellationMethod })
  @IsOptional()
  @IsEnum(CancellationMethod)
  requested_method?: CancellationMethod;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;
}
