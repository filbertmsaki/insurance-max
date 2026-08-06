import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestDisbursementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class ConfirmDisbursementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  payment_method: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  provider_reference?: string;
}

export class FailDisbursementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
