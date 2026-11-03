import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

/** A direct permission grant; a null data_scope inherits the user's scope. */
export class UserPermissionGrantDto {
  @IsUUID()
  permission_id: string;

  @IsOptional()
  @IsEnum(QuotationPolicyDataScope)
  data_scope?: QuotationPolicyDataScope | null;

  @IsOptional()
  @IsUUID()
  scope_branch_id?: string | null;

  @IsOptional()
  @IsUUID()
  scope_department_id?: string | null;
}

/**
 * Desired access for a company membership. Every section is optional; a
 * section that is present replaces the membership's current state for that
 * section. Each section requires its own permission (see UserAccessService).
 */
export class UpdateUserAccessDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  branch_ids?: string[];

  @ValidateIf((dto: UpdateUserAccessDto) => dto.branch_ids !== undefined)
  @IsUUID()
  active_branch_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  department_ids?: string[];

  @IsOptional()
  @IsUUID()
  active_department_id?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  role_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionGrantDto)
  permission_grants?: UserPermissionGrantDto[];

  /** Role permissions to withhold from this member; replaces the current list. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  excluded_permission_ids?: string[];

  @IsOptional()
  @IsEnum(QuotationPolicyDataScope)
  quotation_policy_data_scope?: QuotationPolicyDataScope;

  @IsOptional()
  @IsBoolean()
  insurance_channel_access?: boolean;
}
