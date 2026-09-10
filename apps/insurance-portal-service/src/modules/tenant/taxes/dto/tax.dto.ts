import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

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
}

export class UpdateTaxDto extends PartialType(CreateTaxDto, {
  skipNullProperties: false,
}) {}
