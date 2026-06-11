import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SetCompanyPrimaryUserDto {
  @ApiProperty({
    description: 'The user ID to make the primary/default user for the company',
  })
  @IsUUID()
  user_id: string;
}
