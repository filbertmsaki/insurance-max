import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClaimRecoveryType } from '../enums/claim.enums';

export class CreateClaimRecoveryDto {
  @IsEnum(ClaimRecoveryType)
  recovery_type: ClaimRecoveryType;

  expected_amount: string | number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordRecoveryReceiptDto {
  received_amount: string | number;

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
