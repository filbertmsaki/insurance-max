import { PartialType } from '@nestjs/mapped-types';
import { CreateCommissionTransactionDto } from './create-commission-transaction.dto';

export class UpdateCommissionTransactionDto extends PartialType(CreateCommissionTransactionDto) {}
