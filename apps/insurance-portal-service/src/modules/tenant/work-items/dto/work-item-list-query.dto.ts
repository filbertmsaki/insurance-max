import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindWorkItemsQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  view?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  priority?: string;
}

export class FindNotificationsQueryDto extends TableQueryDto {
  @IsOptional()
  @IsIn(['unread', 'read', 'dismissed'])
  state?: 'unread' | 'read' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  priority?: string;
}
