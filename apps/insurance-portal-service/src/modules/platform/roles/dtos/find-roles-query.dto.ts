import { IsEnum, IsOptional } from 'class-validator';
import { RoleScope } from '@insurance-max/contracts';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindRolesQueryDto extends TableQueryDto {
  @IsOptional()
  @IsEnum(RoleScope)
  scope?: RoleScope;
}
