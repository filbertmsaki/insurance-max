import { Transform } from 'class-transformer';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Shared list query: legacy callers get a plain array; adding `page`
 * switches to the paged `{ data, pagination }` table response.
 */
export class ReferenceListQueryDto extends TableQueryDto {
  @IsOptional()
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    return raw === true || raw === 'true';
  })
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsUUID()
  country_id?: string;

  @IsOptional()
  @IsUUID()
  region_id?: string;
}

export class CreateCountryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  iso2_code?: string | null;

  @IsString()
  @MaxLength(3)
  iso3_code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_code?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateCountryDto extends CreateCountryDto {
  @IsOptional()
  declare name: string;

  @IsOptional()
  declare iso3_code: string;
}

export class CreateRegionDto {
  @IsUUID()
  country_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string | null;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateRegionDto extends CreateRegionDto {
  @IsOptional()
  declare country_id: string;

  @IsOptional()
  declare name: string;
}

export class CreateDistrictDto {
  @IsUUID()
  region_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string | null;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateDistrictDto extends CreateDistrictDto {
  @IsOptional()
  declare region_id: string;

  @IsOptional()
  declare name: string;
}

export class CreateCurrencyDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(10)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  symbol?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateCurrencyDto extends CreateCurrencyDto {
  @IsOptional()
  declare name: string;

  @IsOptional()
  declare code: string;
}
