import { IsBoolean } from 'class-validator';

export class UpdateSalePointStatusDto {
  @IsBoolean()
  is_active: boolean;
}
