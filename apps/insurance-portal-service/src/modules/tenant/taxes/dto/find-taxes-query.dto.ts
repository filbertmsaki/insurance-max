import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindTaxesQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  is_active?: 'true' | 'false';
}
