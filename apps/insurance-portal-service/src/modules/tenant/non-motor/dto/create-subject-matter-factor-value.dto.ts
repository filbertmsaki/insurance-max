import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSubjectMatterFactorValueDto {
  @IsUUID()
  subject_matter_id: string;

  @IsUUID()
  factor_id: string;

  @IsOptional()
  @IsString()
  value_text?: string | null;

  @IsOptional()
  value_number?: number | string | null;

  @IsOptional()
  value_date?: string | null;

  @IsOptional()
  value_boolean?: boolean | null;

  @IsOptional()
  @IsObject()
  value_json?: Record<string, unknown> | null;
}
