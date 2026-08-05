import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class AssignDepartmentUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  company_user_ids: string[];

  @IsOptional()
  @IsBoolean()
  make_active?: boolean;

  @IsOptional()
  @IsBoolean()
  make_primary?: boolean;
}
