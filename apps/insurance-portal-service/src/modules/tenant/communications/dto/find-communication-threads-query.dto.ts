import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindCommunicationThreadsQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  thread_type?: string;

  @IsOptional()
  @IsIn(['open', 'closed'])
  state?: 'open' | 'closed';
}
