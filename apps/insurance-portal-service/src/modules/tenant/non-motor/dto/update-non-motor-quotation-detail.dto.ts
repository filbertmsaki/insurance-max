import { PartialType } from '@nestjs/mapped-types';
import { CreateNonMotorQuotationDetailDto } from './create-non-motor-quotation-detail.dto';

export class UpdateNonMotorQuotationDetailDto extends PartialType(CreateNonMotorQuotationDetailDto) {}
