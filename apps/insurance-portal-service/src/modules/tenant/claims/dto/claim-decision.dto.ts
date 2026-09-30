import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ClaimDecisionType } from '@insurance-max/contracts';

import { ClaimLiabilityStatus } from '../enums/claim.enums';
import { IsMoneyAmount } from './claim-validators';

export class CreateClaimDecisionDto {
  @IsOptional()
  @IsUUID()
  assessment_id?: string;

  @IsEnum(ClaimDecisionType)
  decision_type: ClaimDecisionType;

  @IsEnum(ClaimLiabilityStatus)
  liability_status: ClaimLiabilityStatus;

  @IsMoneyAmount()
  amount_claimed: string;

  @IsMoneyAmount()
  amount_admitted: string;

  @IsMoneyAmount()
  amount_declined: string;

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
