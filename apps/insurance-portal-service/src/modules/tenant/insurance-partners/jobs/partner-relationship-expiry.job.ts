import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class PartnerRelationshipExpiryJob {
  private readonly logger = new Logger(PartnerRelationshipExpiryJob.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireEndedRelationships() {
    const expired = await this.dataSource.transaction(async (manager) => {
      const rows: Array<{
        id: string;
        insurer_company_id: string;
        intermediary_company_id: string;
        previous_status: string;
      }> = await manager.query(`
        WITH expiring AS (
          SELECT id, status AS previous_status
          FROM insurance_company_partners
          WHERE status IN ('ACTIVE', 'SUSPENDED')
            AND end_date IS NOT NULL
            AND end_date < CURRENT_DATE
            AND deleted_at IS NULL
          FOR UPDATE
        )
        UPDATE insurance_company_partners relationship
        SET status = 'EXPIRED', updated_at = now()
        FROM expiring
        WHERE relationship.id = expiring.id
        RETURNING relationship.id, relationship.insurer_company_id,
          relationship.intermediary_company_id, expiring.previous_status
      `);

      if (rows.length) {
        await manager.query(
          `INSERT INTO insurance_company_partner_events
            (relationship_id, actor_company_id, actor_user_id, event_type,
             previous_status, new_status, notes, metadata)
           SELECT id, NULL, NULL, 'EXPIRED', previous_status, 'EXPIRED',
             'Agreement end date passed', jsonb_build_object('source', 'scheduled_expiry')
           FROM unnest($1::uuid[], $2::varchar[]) AS expired(id, previous_status)`,
          [rows.map((row) => row.id), rows.map((row) => row.previous_status)],
        );
      }
      return rows;
    });

    if (expired.length) {
      this.logger.log(
        `Expired ${expired.length} insurer-partner relationships`,
      );
    }
  }
}
