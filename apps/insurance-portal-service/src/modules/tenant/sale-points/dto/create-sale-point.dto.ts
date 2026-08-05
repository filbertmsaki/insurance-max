import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSalePointDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Sales-point code may only contain letters, numbers, underscores and hyphens',
  })
  sale_point_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sale_point_name: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
