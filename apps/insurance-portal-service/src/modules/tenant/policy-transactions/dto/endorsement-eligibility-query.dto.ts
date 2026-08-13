import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class EndorsementEligibilityQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effective_date?: string;
}
