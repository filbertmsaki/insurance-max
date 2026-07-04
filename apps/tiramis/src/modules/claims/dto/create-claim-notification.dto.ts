import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClaimNotificationDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  insurerCompanyCode?: string;

  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Transaction company code given by TIRA. This is the entity that sold the cover note.',
  })
  tranCompanyCode?: string;

  @ApiProperty({
    example: 'CLM-NOT-2026-00001',
    description: 'Claim notification number as per insurer',
  })
  claimNotificationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T10:30:00',
    description: 'Claim report date and time',
  })
  claimReportDate!: Date | string;

  @ApiProperty({
    example: 'Y',
    enum: ['Y', 'N'],
    description: 'Y if claim form is duly filled, otherwise N',
  })
  claimFormDullyFilled!: 'Y' | 'N';

  @ApiProperty({
    example: '2026-07-05T08:20:00',
    description: 'Loss date and time',
  })
  lossDate!: Date | string;

  @ApiProperty({
    example: 'Fire and Allied Perils',
  })
  lossNature!: string;

  @ApiProperty({
    example: 'Property Damage',
  })
  lossType!: string;

  @ApiProperty({
    example: 'Dar es Salaam',
  })
  lossLocation!: string;

  @ApiProperty({
    example: 'John Doe',
  })
  officerName!: string;

  @ApiProperty({
    example: 'Claims Officer',
  })
  officerTitle!: string;
}
