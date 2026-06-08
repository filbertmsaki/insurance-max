import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../roles/entities/role.entity';
import { UserType } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  user_no?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsEnum(UserType)
  @IsOptional()
  user_type?: UserType;

  @IsArray()
  @IsOptional()
  roles?: Role[];
}
