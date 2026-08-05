import { IsUUID } from 'class-validator';

export class SetActiveDepartmentDto {
  @IsUUID()
  department_id: string;
}
