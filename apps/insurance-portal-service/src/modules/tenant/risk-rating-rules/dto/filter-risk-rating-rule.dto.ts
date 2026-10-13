import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export class FilterRiskRatingRuleDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by risk UUID' })
  @IsOptional()
  @IsUUID()
  risk_id?: string;

  @ApiPropertyOptional({ description: 'Filter by pricing rate book UUID' })
  @IsOptional()
  @IsUUID()
  rate_book_id?: string;

  @ApiPropertyOptional({ enum: RateType })
  @IsOptional()
  @IsEnum(RateType)
  rate_type?: RateType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;
}
