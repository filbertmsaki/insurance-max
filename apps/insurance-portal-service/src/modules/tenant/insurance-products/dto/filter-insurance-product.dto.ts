import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';

export class FilterInsuranceProductDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ enum: InsuranceBusinessLine })
  @IsOptional()
  @IsEnum(InsuranceBusinessLine)
  business_line?: InsuranceBusinessLine;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  supports_fleet?: boolean;
}
