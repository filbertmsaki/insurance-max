import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { endorsementTaxData } from './endorsement-tax-fixture';
import { PolicyTransactionInvoiceService } from '../../src/modules/tenant/policy-transactions/services/policy-transaction-invoice.service';
import { withQuotationTaxSchema } from './quotation-tax-database';
import type { DataSource } from 'typeorm';
export async function withEndorsementTaxSchema<T>(
  owned: DataSource,
  run: (f: Awaited<ReturnType<typeof seed>>) => Promise<T>,
) {
  return withQuotationTaxSchema(owned, async (f) => run(await seed(f)));
}
async function seed(
  f: Parameters<Parameters<typeof withQuotationTaxSchema>[1]>[0],
) {
  const d = endorsementTaxData();
  d.companyId = f.companyId;
  d.customerId = f.customerId;
  d.params.companyId = f.companyId;
  d.params.insurerCompanyId = f.companyId;
  d.params.customerId = f.customerId;
  d.transaction.company_id = f.companyId;
  await f.source.query(
    'CREATE TABLE policies(id uuid PRIMARY KEY,company_id uuid NOT NULL,customer_id uuid NOT NULL,insurer_company_id uuid NOT NULL)',
  );
  await f.source.query('INSERT INTO policies VALUES($1,$2,$3,$4)', [
    d.policyId,
    d.companyId,
    d.customerId,
    d.companyId,
  ]);
  await f.source.query(
    'CREATE TABLE policy_transactions(id uuid PRIMARY KEY,company_id uuid NOT NULL,transaction_no text NOT NULL,transaction_type text NOT NULL,source_policy_id uuid NOT NULL,source_policy_version_id uuid NOT NULL,source_policy_version_no integer NOT NULL,state_version integer NOT NULL,effective_date date NOT NULL,currency_code text NOT NULL,premium_effect text NOT NULL,additional_premium numeric(20,4) NOT NULL,return_premium numeric(20,4) NOT NULL,tax_difference numeric(20,4) NOT NULL,commission_difference numeric(20,4) NOT NULL,pricing_snapshot jsonb NOT NULL,pricing_snapshot_hash text NOT NULL,proposed_policy_snapshot_hash text NOT NULL)',
  );
  const persist = async () => {
    d.refresh();
    const row = d.transaction,
      fields = Object.keys(row);
    await f.source.query(
      `INSERT INTO policy_transactions(${fields.join(',')}) VALUES(${fields.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT(id) DO UPDATE SET ${fields
        .filter((k) => k !== 'id')
        .map((k) => k + '=EXCLUDED.' + k)
        .join(',')}`,
      Object.values(row),
    );
  };
  await persist();
  let sequence = 0;
  const service = new PolicyTransactionInvoiceService(
    new ProductDefinitionHashService(),
    {
      generateInvoiceNumber: async () => `SYNTHETIC-ENDORSEMENT-${++sequence}`,
    } as never,
  );
  return {
    ...f,
    ...d,
    service,
    persist,
    create: () => service.createOrReuseInvoice(f.source.manager, d.params),
  };
}
