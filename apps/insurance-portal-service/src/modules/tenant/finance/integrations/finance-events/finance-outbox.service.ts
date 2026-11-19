import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { FinanceOutboxEvent } from './entities/finance-outbox-event.entity';

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
    const payload = JSON.stringify(params.payload);
    // A read-then-save races another worker. The existing unique key resolves
    // concurrent deliveries without overwriting an earlier event or payload.
    await manager.query(
      `INSERT INTO finance_outbox_events
        (company_id, aggregate_type, aggregate_id, event_type, event_key, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (company_id, event_key) DO NOTHING`,
      [
        params.companyId,
        params.aggregateType,
        params.aggregateId,
        params.eventType,
        params.eventKey,
        payload,
      ],
    );
    const [matching] = await manager.query(
      `SELECT id FROM finance_outbox_events
        WHERE company_id = $1 AND event_key = $2
          AND aggregate_type = $3 AND aggregate_id = $4
          AND event_type = $5 AND payload = $6::jsonb`,
      [
        params.companyId,
        params.eventKey,
        params.aggregateType,
        params.aggregateId,
        params.eventType,
        payload,
      ],
    );
    if (!matching) {
      throw new ConflictException({
        code: 'FINANCE_OUTBOX_EVENT_CONFLICT',
        message: 'An event key was reused for different financial evidence.',
      });
    }
    return manager.getRepository(FinanceOutboxEvent).findOneByOrFail({
      id: matching.id,
    });
  }
}
