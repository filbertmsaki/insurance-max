import { PartialType } from '@nestjs/mapped-types';
import { CreateMotorQuotationDetailDto } from './create-motor-quotation-detail.dto';

export class UpdateMotorQuotationDetailDto extends PartialType(CreateMotorQuotationDetailDto) {}
