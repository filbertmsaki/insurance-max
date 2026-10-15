import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/** Cover note list filters; paged (table contract) only when `page` is sent. */
export class CoverNoteListQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  quotation_id?: string;
}
