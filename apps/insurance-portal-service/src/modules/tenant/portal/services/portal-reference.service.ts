import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class PortalReferenceService {
  constructor(private readonly dataSource: DataSource) {}

  async next(
    companyId: string,
    documentType: string,
    prefix: string,
    manager?: EntityManager,
  ): Promise<string> {
    const activeManager = manager ?? this.dataSource.manager;

    const year = new Date().getFullYear();

    const rows = await activeManager.query(
      `
      INSERT INTO portal_sequences (
        company_id,
        document_type,
        sequence_year,
        current_value
      )
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (company_id, document_type, sequence_year)
      DO UPDATE SET
        current_value = portal_sequences.current_value + 1,
        updated_at = now()
      RETURNING current_value
      `,
      [companyId, documentType, year],
    );

    const sequence = Number(rows[0]?.current_value ?? 0);

    return [prefix, year, String(sequence).padStart(6, '0')].join('-');
  }
}
