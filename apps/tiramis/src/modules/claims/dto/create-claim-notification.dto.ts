import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateClaimNotificationDto {
  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Insurer company code given by TIRA. If omitted, configuration fallback may be used.',
  })
  @IsOptional()
  insurerCompanyCode?: string;

  @ApiPropertyOptional({
    example: 'IC001',
    description:
      'Transaction company code given by TIRA. This is the entity that sold the cover note.',
  })
  @IsOptional()
  tranCompanyCode?: string;

  @ApiProperty({
    example: 'CLM-NOT-2026-00001',
    description: 'Claim notification number as per insurer',
  })
  @IsOptional()
  claimNotificationNumber!: string;

  @ApiProperty({
    example: 'TIRA-CN-000001',
    description: 'TIRA cover note reference number',
  })
  @IsOptional()
  coverNoteReferenceNumber!: string;

  @ApiProperty({
    example: '2026-07-05T10:30:00',
    description: 'Claim report date and time',
  })
  @IsOptional()
  claimReportDate!: Date | string;

  @ApiProperty({
    example: 'Y',
    enum: ['Y', 'N'],
    description: 'Y if claim form is duly filled, otherwise N',
  })
  @IsOptional()
  claimFormDullyFilled!: 'Y' | 'N';

  @ApiProperty({
    example: '2026-07-05T08:20:00',
    description: 'Loss date and time',
  })
  @IsOptional()
  lossDate!: Date | string;

  @ApiProperty({
    example: 'Fire and Allied Perils',
  })
  @IsOptional()
  lossNature!: string;

  @ApiProperty({
    example: 'Property Damage',
  })
  @IsOptional()
  lossType!: string;

  @ApiProperty({
    example: 'Dar es Salaam',
  })
  @IsOptional()
  lossLocation!: string;

  @ApiProperty({
    example: 'John Doe',
  })
  @IsOptional()
  officerName!: string;

  @ApiProperty({
    example: 'Claims Officer',
  })
  @IsOptional()
  officerTitle!: string;
}
