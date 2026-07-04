import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { TiramisSubmissionEventEntity } from '../entities/tiramis-submission-event.entity';

@Injectable()
export class TiramisSubmissionEventRepository {
  constructor(
    @InjectRepository(TiramisSubmissionEventEntity)
    private readonly repository: Repository<TiramisSubmissionEventEntity>,
  ) {}

  create(
    data: DeepPartial<TiramisSubmissionEventEntity>,
  ): TiramisSubmissionEventEntity {
    return this.repository.create(data);
  }

  save(
    entity: TiramisSubmissionEventEntity,
  ): Promise<TiramisSubmissionEventEntity> {
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

  createEvent(data: {
    transactionId: string;
    attemptId?: string | null;
    requestId?: string | null;
    eventType: string;
    statusCode?: string | null;
    statusDesc?: string | null;
    errorMessage?: string | null;
    rawPayload?: string | null;
  }) {
    const event = this.repository.create({
      transactionId: data.transactionId,
      attemptId: data.attemptId || null,
      requestId: data.requestId || null,
      eventType: data.eventType,
      statusCode: data.statusCode || null,
      statusDesc: data.statusDesc || null,
      errorMessage: data.errorMessage || null,
      rawPayload: data.rawPayload || null,
    } as DeepPartial<TiramisSubmissionEventEntity>);

    return this.repository.save(event);
  }
}
