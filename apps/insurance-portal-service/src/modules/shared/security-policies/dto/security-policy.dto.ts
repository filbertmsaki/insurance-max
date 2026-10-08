import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const CODE_PATTERN = /^[A-Za-z0-9_:.-]+$/;

/**
 * Two-factor requirements a company adds on top of the platform baseline.
 * Company policies can only tighten: these are combined with the baseline.
 */
export class TwoFactorPolicyDto {
  @IsOptional()
  @IsBoolean()
  require_for_all_users?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @Matches(CODE_PATTERN, { each: true })
  require_for_roles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(150, { each: true })
  @Matches(CODE_PATTERN, { each: true })
  require_for_permissions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Matches(CODE_PATTERN, { each: true })
  require_for_user_types?: string[];

  /** false forbids trusted-device bypass; true cannot re-allow it. */
  @IsOptional()
  @IsBoolean()
  allow_trusted_device_bypass?: boolean;
}

export class CreateSecurityPolicyDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  profile_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ValidateNested()
  @Type(() => TwoFactorPolicyDto)
  two_factor: TwoFactorPolicyDto;
}
