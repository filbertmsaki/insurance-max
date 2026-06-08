import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyDto {
  @ApiProperty({ example: 'POL-LOCAL-001' })
  policyNumber!: string;

  @ApiProperty({ example: 'Private motor comprehensive insurance' })
  policyOperativeClause!: string;

  @ApiProperty({
    example: 'Policy issued after successful cover note acceptance',
  })
  specialConditions!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Subject to standard exclusions',
  })
  exclusions?: string | null;

  @ApiProperty({ type: () => [String], example: ['TIRA-CN-000001'] })
  coverNoteReferenceNumbers!: string[];
}
