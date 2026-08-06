import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCustomerKycReviewDto {
  @IsString()
  @MaxLength(500)
  rejection_reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string | null;
}
