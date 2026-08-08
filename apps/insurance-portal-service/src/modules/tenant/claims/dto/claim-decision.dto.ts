import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ClaimDecisionType } from '@insurance-max/contracts';

import { ClaimLiabilityStatus } from '../enums/claim.enums';

export class CreateClaimDecisionDto {
  @IsOptional()
  @IsUUID()
  assessment_id?: string;

  @IsEnum(ClaimDecisionType)
  decision_type: ClaimDecisionType;

  @IsEnum(ClaimLiabilityStatus)
  liability_status: ClaimLiabilityStatus;

  amount_claimed: string | number;

  amount_admitted: string | number;

  amount_declined: string | number;

  @IsString()
  @MaxLength(2000)
  reason: string;
}

export class ClaimDecisionActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
