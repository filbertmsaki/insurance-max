import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Renders a number-format prefix. Supported tokens: {YYYY}, {YY}, {MM}.
 * "CLM/{YY}/" in 2026 gives "CLM/26/".
 */
export function renderNumberPrefix(template: string, date = new Date()) {
  const year = String(date.getFullYear());
  return template
    .replace(/\{YYYY\}/g, year)
    .replace(/\{YY\}/g, year.slice(-2))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, '0'));
}

/** Upper-cases and drops every character other than A-Z and 0-9. */
export function toAlphanumericReference(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

@Injectable()
export class BusinessReferenceService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Next number for a company's document type. A company's configured
   * format (business_document_number_formats) overrides the caller's
   * default prefix and sequence length.
   */
  async next(params: {
    companyId: string;
    documentType: string;
    prefix: string;
    periodKey?: string;
    sequenceLength?: number;
    manager?: EntityManager;
  }): Promise<string> {
    const manager = params.manager ?? this.dataSource.manager;
    const periodKey = params.periodKey ?? String(new Date().getFullYear());

    const formats: Array<{ prefix: string; sequence_length: number }> =
      await manager.query(
        `SELECT prefix, sequence_length
           FROM business_document_number_formats
          WHERE company_id = $1 AND document_type = $2`,
        [params.companyId, params.documentType],
      );
    const format = formats[0];

    const sequence = await this.nextValue({
      companyId: params.companyId,
      documentType: params.documentType,
      periodKey,
      manager,
    });
    const prefix = format ? renderNumberPrefix(format.prefix) : params.prefix;
    const length = format?.sequence_length ?? params.sequenceLength ?? 5;

    return toAlphanumericReference(
      `${prefix}${String(sequence).padStart(length, '0')}`,
    );
  }

  /** Raw auto-increment value for a company, document type and period. */
  async nextValue(params: {
    companyId: string;
    documentType: string;
    periodKey: string;
    manager?: EntityManager;
  }): Promise<number> {
    const manager = params.manager ?? this.dataSource.manager;
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
      [params.companyId, params.documentType, params.periodKey],
    );

    return Number(rows?.[0]?.current_value);
  }
}
