import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SwitchCompanyDto {
  @ApiProperty({ example: 'uuid-of-company' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  company_id: string;

  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
