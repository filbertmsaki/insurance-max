import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RequestPartnerRelationshipDto {
  @IsUUID()
  insurer_company_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  request_note?: string;
}
