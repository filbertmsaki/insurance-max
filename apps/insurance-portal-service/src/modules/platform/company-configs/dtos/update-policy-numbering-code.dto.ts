import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePolicyNumberingCodeDto {
  @ApiProperty({
    example: '1001',
    description:
      'Permanent numeric numbering code; locked after first issuance',
  })
  @IsString()
  @Matches(/^[0-9]{1,12}$/)
  code: string;
}
