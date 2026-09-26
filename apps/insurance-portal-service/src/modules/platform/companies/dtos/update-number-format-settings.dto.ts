import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export enum CurrencySymbolPosition {
  BEFORE = 'before',
  AFTER = 'after',
}

export enum NegativeNumberFormat {
  MINUS = 'minus',
  PARENTHESES = 'parentheses',
}

export enum RoundingMode {
  HALF_UP = 'half_up',
  HALF_EVEN = 'half_even',
  DOWN = 'down',
  UP = 'up',
}

export class UpdateNumberFormatSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency_code?: string;

  @IsOptional()
  @IsString()
  currency_symbol?: string;

  @IsOptional()
  @IsEnum(CurrencySymbolPosition)
  currency_symbol_position?: CurrencySymbolPosition;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  money_decimal_places?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  number_decimal_places?: number;

  @IsOptional()
  @IsIn([',', '.', ' ', "'", ''])
  thousands_separator?: string;

  @IsOptional()
  @IsIn([',', '.'])
  decimal_separator?: string;

  @IsOptional()
  @IsEnum(NegativeNumberFormat)
  negative_number_format?: NegativeNumberFormat;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  percentage_decimal_places?: number;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  date_format?: string;

  @IsOptional()
  @IsEnum(RoundingMode)
  rounding_mode?: RoundingMode;
}
