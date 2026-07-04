import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Business insurer code from TIRA. If omitted, configuration fallback may be used.',
  })
  insurerCompanyCode?: string;

  @ApiProperty({
    example: 'POL-2026-000001',
    description: 'Policy number as per insurer',
  })
  policyNumber!: string;

  @ApiProperty({
    example: 'This policy covers the insured against the risks stated in the schedule.',
  })
  policyOperativeClause!: string;

  @ApiProperty({
    example: 'Subject to standard policy terms and conditions.',
  })
  specialConditions!: string;

  @ApiPropertyOptional({
    example: 'War, nuclear risks, and intentional damage are excluded.',
  })
  exclusions?: string | null;

  @ApiProperty({
    type: [String],
    example: ['TIRA-CN-000001', 'TIRA-CN-000002'],
    description: 'Cover note reference numbers applied to this policy',
  })
  coverNoteReferenceNumbers!: string[];
}
