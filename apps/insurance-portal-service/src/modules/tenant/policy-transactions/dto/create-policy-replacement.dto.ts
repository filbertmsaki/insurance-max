import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePolicyReplacementDto {
  @IsDateString()
  effective_date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsObject()
  draft_payload: Record<string, unknown>;
}
