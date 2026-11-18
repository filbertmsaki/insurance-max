import type { MigrationInterface, QueryRunner } from 'typeorm';
import { installFinanceCommissionFunctions } from '../../modules/tenant/finance/payables/commission-controls/finance-commission.database';

/** Explicit forward repair for an already installed early B17 definition.
 * It does not apply itself at startup, activate a policy, grant access or change business rows.
 */
export class FinanceCommissionControlHardening1797800000000 implements MigrationInterface {
  name = 'FinanceCommissionControlHardening1797800000000';
  async up(q: QueryRunner): Promise<void> {
    for (const name of [
      'finance_commission_authorities',
      'finance_commission_movements',
      'finance_commission_aliases',
      'finance_commission_reviews',
      'finance_commission_settlements',
      'finance_commission_events',
      'finance_commission_audits',
    ]) {
      const [table] = await q.query('SELECT to_regclass($1) existing', [name]);
      if (!table.existing)
        throw new Error(
          'B17 base schema must be installed before control hardening.',
        );
    }
    await q.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('finance-commission-control-hardening',0))",
    );
    await installFinanceCommissionFunctions(q);
  }
  async down(): Promise<void> {
    // Retain stronger guards on a stepwise rollback. The base migration may remove
    // them only when every B17 table, including mandates and audit, is empty.
  }
}
