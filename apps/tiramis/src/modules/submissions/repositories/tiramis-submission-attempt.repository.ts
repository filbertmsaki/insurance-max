import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisSubmissionAttemptEntity } from '../entities/tiramis-submission-attempt.entity';

@Injectable()
export class TiramisSubmissionAttemptRepository {
  constructor(
    @InjectRepository(TiramisSubmissionAttemptEntity)
    private readonly repository: Repository<TiramisSubmissionAttemptEntity>,
  ) {}

  create(data: Partial<TiramisSubmissionAttemptEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisSubmissionAttemptEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { requestId },
    });
  }

  findLatestByTransactionId(transactionId: string) {
    return this.repository.findOne({
      where: { transactionId },
      order: { attemptNo: 'DESC' },
    });
  }

  findAllByTransactionId(transactionId: string) {
    return this.repository.find({
      where: { transactionId },
      order: { attemptNo: 'ASC' },
    });
  }
}
