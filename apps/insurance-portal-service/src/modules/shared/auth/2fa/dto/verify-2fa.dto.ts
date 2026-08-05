import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class Verify2FaDto {
  @IsNotEmpty({ message: '2FA code is required' })
  @IsString()
  @Matches(/^(\d{6}|[A-Fa-f0-9]{10}|[A-Fa-f0-9]{5}-[A-Fa-f0-9]{5})$/, {
    message: 'Code must be a 6-digit authenticator code or a backup code',
  })
  code: string;
}
