import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { InsuranceBusinessLine } from '../enums/insurance-business-line.enum';

export class FilterInsuranceCategoryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ enum: InsuranceBusinessLine })
  @IsOptional()
  @IsEnum(InsuranceBusinessLine)
  business_line?: InsuranceBusinessLine;
}
