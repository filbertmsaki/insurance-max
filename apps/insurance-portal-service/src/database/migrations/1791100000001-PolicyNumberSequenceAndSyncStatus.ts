import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Seeds the atomic policy-number counters (`business_document_sequences`,
 *   document type `POLICY_<channel>`, period = year) from the highest number
 *   already issued, so the switch from "max + 1" never reissues a number.
 *   Soft-deleted policies count: their numbers stay taken.
 * - Repairs policies that endorsement/cancellation apply marked
 *   `regulatory_sync_status = 'SUCCESS'`; issuance and renewal eligibility use
 *   `'IN_SYNC'`, so those policies could never be renewed.
 */
export class PolicyNumberSequenceAndSyncStatus1791100000001 implements MigrationInterface {
  name = 'PolicyNumberSequenceAndSyncStatus1791100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO business_document_sequences
        (company_id, document_type, period_key, current_value, created_at, updated_at)
      SELECT company_id,
             'POLICY_' || parts[1],
             parts[2],
             MAX(parts[3]::bigint),
             now(),
             now()
        FROM (
          SELECT company_id,
                 regexp_match(policy_no, '^POL-([A-Z]{3})-([0-9]{4})-([0-9]+)$') AS parts
            FROM policies
        ) numbered
       WHERE parts IS NOT NULL
       GROUP BY company_id, parts[1], parts[2]
      ON CONFLICT (company_id, document_type, period_key)
      DO UPDATE SET
        current_value = GREATEST(
          business_document_sequences.current_value,
          EXCLUDED.current_value
        ),
        updated_at = now()
    `);

    await queryRunner.query(`
      UPDATE policies
         SET regulatory_sync_status = 'IN_SYNC'
       WHERE regulatory_sync_status = 'SUCCESS'
    `);
  }

  public async down(): Promise<void> {
    // Data repair only. The counters are needed by the new numbering, and
    // 'SUCCESS' was never a valid sync status, so nothing is reverted.
  }
}
