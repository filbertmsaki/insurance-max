import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisSubmissionEventEntity } from '../entities/tiramis-submission-event.entity';

@Injectable()
export class TiramisSubmissionEventRepository {
  constructor(
    @InjectRepository(TiramisSubmissionEventEntity)
    private readonly repository: Repository<TiramisSubmissionEventEntity>,
  ) {}

  create(data: Partial<TiramisSubmissionEventEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisSubmissionEventEntity) {
    return this.repository.save(entity);
  }

  findByTransactionId(transactionId: string) {
    return this.repository.find({
      where: { transactionId },
      order: { createdAt: 'ASC' },
    });
  }

  findByAttemptId(attemptId: string) {
    return this.repository.find({
      where: { attemptId },
      order: { createdAt: 'ASC' },
    });
  }
}
