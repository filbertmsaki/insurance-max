import { IsOptional, IsString, IsUUID } from 'class-validator';

import { ClaimStatus } from '../enums/claim.enums';

export class FindClaimsQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  status?: ClaimStatus;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;

  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
