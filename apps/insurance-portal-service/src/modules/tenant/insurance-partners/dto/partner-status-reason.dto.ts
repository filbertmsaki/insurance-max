import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PartnerStatusReasonDto {
  @ApiProperty({ description: 'Reason for the status change' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
