import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSubjectMatterDto {
  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject_type?: string | null;

  @IsString()
  @MaxLength(100)
  subject_code: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string | null;

  @IsOptional()
  latitude?: number | string | null;

  @IsOptional()
  longitude?: number | string | null;

  @IsOptional()
  value?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
