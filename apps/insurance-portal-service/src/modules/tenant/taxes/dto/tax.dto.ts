import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  IsIn,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  CHARGE_CATEGORIES,
  type ChargeCategory,
} from '../../../shared/finance/tax-calculation';
export class TaxCalculationOptionsDto {
  @IsOptional() @IsIn(CHARGE_CATEGORIES) category?: ChargeCategory;
  @IsOptional() @IsDateString({ strict: true }) effective_from?: string | null;
  @IsOptional() @IsDateString({ strict: true }) effective_to?: string | null;
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9_.:-]+$/)
  ledger_account_code?: string | null;
}

export class CreateTaxDto {
  @ApiProperty({ example: 'VAT-MAINLAND', maxLength: 50 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  tax_code: string;

  @ApiProperty({ example: 'VAT (Mainland)', maxLength: 150 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 150)
  tax_name: string;

  @ApiProperty({
    example: 0.18,
    minimum: 0,
    maximum: 1,
    description: 'Decimal fraction: 0.18 means 18%.',
  })
  @IsNumber({ maxDecimalPlaces: 10 })
  @Min(0)
  @Max(1)
  tax_rate: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  is_active: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => TaxCalculationOptionsDto)
  calculation_options?: TaxCalculationOptionsDto | null;
}

export class UpdateTaxDto extends PartialType(CreateTaxDto, {
  skipNullProperties: false,
}) {}
