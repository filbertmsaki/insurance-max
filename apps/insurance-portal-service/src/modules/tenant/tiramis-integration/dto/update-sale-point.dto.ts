import { PartialType } from '@nestjs/mapped-types';
import { CreateSalePointDto } from './create-sale-point.dto';

export class UpdateSalePointDto extends PartialType(CreateSalePointDto) {}
