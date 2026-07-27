import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RequestQuotationPremiumOverrideDto {
  @ApiProperty({
    description: 'Requested manual premium amount before discount.',
    example: 95000,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  proposed_premium: number;

  @ApiProperty({
    description: 'Short business reason for the override request.',
    example: 'Retention concession for renewal business',
  })
  @IsString()
  @MaxLength(150)
  override_reason: string;

  @ApiProperty({
    description: 'Optional supporting context for reviewers.',
    required: false,
    example: 'Competitor renewal terms were 5% lower.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  supporting_notes?: string | null;
}

export class DecideQuotationPremiumOverrideDto {
  @ApiProperty({
    description: 'Optional approval note or required rejection explanation.',
    required: false,
    example: 'Approved within underwriting referral authority.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejection_reason?: string | null;
}
