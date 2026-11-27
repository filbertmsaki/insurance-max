import type { MigrationInterface, QueryRunner } from 'typeorm';

const issuedStates = "('ISSUED','PARTIALLY_PAID','PAID','OVERPAID')";
const ordinaryDate =
  "coalesce((row_data->>'journal_date')::date,(effective_time AT TIME ZONE a.timezone)::date,operating_date)";
const changes = [
  [
    `booked_date:=${ordinaryDate};`,
    `booked_date:=CASE
          WHEN TG_TABLE_NAME='invoices' AND TG_OP='UPDATE' AND to_jsonb(OLD)->>'status' IN ${issuedStates}
            AND row_data->>'status' IN ${issuedStates}
          THEN coalesce(
            nullif(current_setting('finance.ar_effective_date',true),'')::date,
            CASE WHEN row_data->>'paid_amount' IS DISTINCT FROM to_jsonb(OLD)->>'paid_amount'
              THEN ((nullif(current_setting('finance.ar_native_cash_dates',true),'')::jsonb->>(row_data->>'id'))::timestamptz AT TIME ZONE a.timezone)::date END,
            operating_date)
          ELSE ${ordinaryDate} END;`,
  ],
  [
    "row_data->>'status'='ISSUED' AND to_jsonb(OLD)->>'status' IS DISTINCT FROM 'ISSUED'",
    `row_data->>'status'='ISSUED' AND coalesce(to_jsonb(OLD)->>'status','') NOT IN ${issuedStates}`,
  ],
] as const;

export class FinanceInvoiceBalancePeriods1800000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await this.updateGuard(q, true);
  }
  async down(q: QueryRunner) {
    await this.updateGuard(q, false);
  }

  private async updateGuard(q: QueryRunner, upgrade: boolean) {
    const [row] = await q.query(
      "SELECT pg_get_functiondef('finance_fin01_guard()'::regprocedure) definition",
    );
    let definition: string = row.definition;
    for (const [before, after] of changes) {
      const [source, replacement] = upgrade ? [before, after] : [after, before];
      if (definition.split(source).length !== 2)
        throw new Error(
          'The installed FIN-01 transaction guard differs from the expected version.',
        );
      definition = definition.replace(source, () => replacement);
    }
    await q.query(definition);
  }
}
