import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClaimRecoveryType } from '../enums/claim.enums';
import { IsMoneyAmount } from './claim-validators';

export class CreateClaimRecoveryDto {
  @IsEnum(ClaimRecoveryType)
  recovery_type: ClaimRecoveryType;

  @IsMoneyAmount()
  expected_amount: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordRecoveryReceiptDto {
  @IsMoneyAmount()
  received_amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class WriteOffRecoveryDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}
