import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisTransactionEntity } from '../entities/tiramis-transaction.entity';

@Injectable()
export class TiramisTransactionRepository {
  constructor(
    @InjectRepository(TiramisTransactionEntity)
    private readonly repository: Repository<TiramisTransactionEntity>,
  ) {}

  create(data: Partial<TiramisTransactionEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisTransactionEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByCurrentRequestId(requestId: string) {
    return this.repository.findOne({
      where: { currentRequestId: requestId },
    });
  }

  findByBusinessReference(businessReference: string) {
    return this.repository.findOne({
      where: { businessReference },
    });
  }
}
