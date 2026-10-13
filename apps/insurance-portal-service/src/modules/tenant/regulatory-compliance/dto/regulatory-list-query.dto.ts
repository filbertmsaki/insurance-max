import { IsOptional, IsString, MaxLength } from 'class-validator';

import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/** Server-side table query for obligations, returns and levy assessments. */
export class RegulatoryListQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}
