import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { CancellationReasonType } from '@insurance-max/contracts';

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;
}
