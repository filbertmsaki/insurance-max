import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReviewProductVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comments: string;
}
