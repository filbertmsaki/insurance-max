import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCustomerKycReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  submission_notes?: string | null;
}
