import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/** Server-side table query for report jobs and schedules. */
export class ReportListQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsUUID()
  definition_id?: string;

  /**
   * Report category (e.g. CLAIMS). Matches the definition category or a
   * `<CATEGORY>_` code prefix, mirroring how module report pages group reports.
   */
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_]{0,39}$/)
  category?: string;
}
