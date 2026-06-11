import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';

export class FilterInsuranceSubClassDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;
}
