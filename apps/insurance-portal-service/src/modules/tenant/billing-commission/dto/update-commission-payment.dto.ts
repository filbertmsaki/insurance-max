import { PartialType } from '@nestjs/mapped-types';
import { CreateCommissionPaymentDto } from './create-commission-payment.dto';

export class UpdateCommissionPaymentDto extends PartialType(CreateCommissionPaymentDto) {}
