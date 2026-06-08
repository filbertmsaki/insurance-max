import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';

export class FilterRatingFactorDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FactorDataType })
  @IsOptional()
  @IsEnum(FactorDataType)
  data_type?: FactorDataType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_required?: boolean;
}
