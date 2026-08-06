import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { FinanceOutboxEvent } from '../entities/finance-outbox-event.entity';

@Injectable()
export class FinanceOutboxService {
  async add(
    manager: EntityManager,
    params: {
      companyId: string;
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      eventKey: string;
      payload: Record<string, unknown>;
    },
  ) {
    const repository = manager.getRepository(FinanceOutboxEvent);

    const existing = await repository.findOne({
      where: {
        company_id: params.companyId,
        event_key: params.eventKey,
      },
    });

    if (existing) {
      return existing;
    }

    return repository.save(
      repository.create({
        company_id: params.companyId,
        aggregate_type: params.aggregateType,
        aggregate_id: params.aggregateId,
        event_type: params.eventType,
        event_key: params.eventKey,
        payload: params.payload,
      }),
    );
  }
}
