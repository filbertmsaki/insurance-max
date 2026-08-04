import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreatePolicyDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Business insurer code from TIRA. If omitted, configuration fallback may be used.',
  })
  @IsOptional()
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'POL-2026-000001',
    description: 'Policy number as per insurer',
  })
  @IsOptional()
  policyNumber!: string;

  @ApiProperty({
    example:
      'This policy covers the insured against the risks stated in the schedule.',
  })
  @IsOptional()
  policyOperativeClause!: string;

  @ApiProperty({
    example: 'Subject to standard policy terms and conditions.',
  })
  @IsOptional()
  specialConditions!: string;

  @ApiPropertyOptional({
    example: 'War, nuclear risks, and intentional damage are excluded.',
  })
  @IsOptional()
  exclusions?: string | null;

  @ApiProperty({
    type: [String],
    example: ['TIRA-CN-000001', 'TIRA-CN-000002'],
    description: 'Cover note reference numbers applied to this policy',
  })
  @IsOptional()
  coverNoteReferenceNumbers!: string[];
}
