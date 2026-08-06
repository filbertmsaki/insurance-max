import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestCustomerKycUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
