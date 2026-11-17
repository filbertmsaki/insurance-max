import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ClaimFxRateDto {
  @IsString() @Matches(/^[A-Z]{3}$/) transaction_currency: string;
  @IsString() @Matches(/^[A-Z]{3}$/) functional_currency: string;
  @IsString() @Matches(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,10})?$/) rate: string;
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effective_date: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) source_reference: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) justification: string;
}

export class ClaimFxRejectDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) reason: string;
}
