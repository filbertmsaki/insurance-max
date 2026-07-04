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

  findRetryableDueAttempts(params: { now: Date; limit: number }) {
    return this.repository
      .createQueryBuilder('attempt')
      .where('attempt.isRetryable = :isRetryable', { isRetryable: 1 })
      .andWhere('attempt.nextRetryAt IS NOT NULL')
      .andWhere('attempt.nextRetryAt <= :now', { now: params.now })
      .andWhere('attempt.retryCount < attempt.maxRetries')
      .orderBy('attempt.nextRetryAt', 'ASC')
      .limit(params.limit)
      .getMany();
  }

  findFinalCallbackOverdueAttempts(params: { now: Date; limit: number }) {
    return this.repository
      .createQueryBuilder('attempt')
      .where('attempt.status = :status', { status: 'ACK_SUCCESS' })
      .andWhere('attempt.finalResponseReceivedAt IS NULL')
      .andWhere('attempt.finalCallbackDeadlineAt IS NOT NULL')
      .andWhere('attempt.finalCallbackDeadlineAt <= :now', {
        now: params.now,
      })
      .andWhere('attempt.finalCallbackOverdueNotified = :notified', {
        notified: 0,
      })
      .orderBy('attempt.finalCallbackDeadlineAt', 'ASC')
      .limit(params.limit)
      .getMany();
  }
}
