import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkRenewalQuotationDto {
  @ApiProperty()
  @IsUUID()
  quotation_id: string;
}
