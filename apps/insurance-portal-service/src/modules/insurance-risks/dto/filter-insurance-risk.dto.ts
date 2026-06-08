import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';

export class FilterInsuranceRiskDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @Transform(({ value, obj }) => value ?? obj?.categoryId)
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @Transform(({ value, obj }) => value ?? obj?.productId)
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Filter by sub-class UUID' })
  @Transform(({ value, obj }) => value ?? obj?.subClassId)
  @IsOptional()
  @IsUUID()
  sub_class_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;
}
