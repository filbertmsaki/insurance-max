import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ComplaintPriority } from '../enums/claim.enums';

export class CreateComplaintDto {
  @IsOptional()
  @IsUUID()
  claim_id?: string;

  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @IsUUID()
  customer_id: string;

  @IsString()
  @MaxLength(100)
  category: string;

  @IsString()
  @MaxLength(180)
  subject: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @IsString()
  @MaxLength(100)
  reported_channel: string;
}

export class AssignComplaintDto {
  @IsUUID()
  assigned_user_id: string;
}

export class ComplaintDecisionDto {
  @IsString()
  reason: string;
}
