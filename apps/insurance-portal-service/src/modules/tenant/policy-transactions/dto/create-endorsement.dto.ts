import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEndorsementDto {
  @ApiProperty()
  @IsDateString()
  effective_date: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  endorsement_type_code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}
