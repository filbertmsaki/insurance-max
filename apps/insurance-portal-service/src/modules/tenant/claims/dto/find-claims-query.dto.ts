import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

import { ClaimQueue, ClaimStatus } from '../enums/claim.enums';

export class FindClaimsQueryDto extends TableQueryDto {
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  /** Stage menu: a predefined set of statuses (claim-lifecycle.ts). */
  @IsOptional()
  @IsEnum(ClaimQueue)
  queue?: ClaimQueue;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;

  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PolicyLookupQueryDto {
  @IsString()
  @MaxLength(120)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
