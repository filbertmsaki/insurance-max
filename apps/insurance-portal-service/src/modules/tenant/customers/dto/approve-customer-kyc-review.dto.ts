import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveCustomerKycReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string | null;

  @IsOptional()
  @IsDateString()
  expires_at?: string | null;
}
