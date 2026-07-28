import { IsArray, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class RemoveBranchUsersDto {
  @IsArray()
  @IsNotEmpty()
  @IsUUID('4', { each: true })
  company_user_ids: string[];

  @IsOptional()
  @IsUUID()
  replacement_branch_id?: string;
}
