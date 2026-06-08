import { PartialType } from '@nestjs/swagger';
import { CreateInsuranceCategoryDto } from './create-insurance-category.dto';

export class UpdateInsuranceCategoryDto extends PartialType(
  CreateInsuranceCategoryDto,
) {}
