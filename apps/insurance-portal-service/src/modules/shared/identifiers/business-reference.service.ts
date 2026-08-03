import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class BusinessReferenceService {
  constructor(private readonly dataSource: DataSource) {}

  async next(params: {
    companyId: string;
    documentType: string;
    prefix: string;
    periodKey?: string;
    sequenceLength?: number;
    manager?: EntityManager;
  }): Promise<string> {
    const manager = params.manager ?? this.dataSource.manager;
    const periodKey =
      params.periodKey ?? String(new Date().getFullYear());

    const rows = await manager.query(
      `
      INSERT INTO business_document_sequences (
        company_id,
        document_type,
        period_key,
        current_value,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 1, now(), now())
      ON CONFLICT (
        company_id,
        document_type,
        period_key
      )
      DO UPDATE SET
        current_value = business_document_sequences.current_value + 1,
        updated_at = now()
      RETURNING current_value
      `,
      [params.companyId, params.documentType, periodKey],
    );

    const sequence = Number(rows?.[0]?.current_value);

    return `${params.prefix}${String(sequence).padStart(
      params.sequenceLength ?? 5,
      '0',
    )}`;
  }
}
