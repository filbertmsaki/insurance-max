import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSalePointDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sale_point_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sale_point_name: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
