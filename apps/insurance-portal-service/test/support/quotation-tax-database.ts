import {
  DataSource,
  EntitySchema,
  type EntitySchemaColumnOptions,
} from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { quotationTaxData } from './quotation-tax-fixture';
import { QuotationInvoiceService } from '../../src/modules/tenant/finance/integrations/quotation-finance/quotation-invoice.service';
import { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import { Invoice } from '../../src/modules/tenant/finance/receivables/invoices/entities/invoice.entity';
import { InvoiceItem } from '../../src/modules/tenant/finance/receivables/invoices/entities/invoice-item.entity';
import { FinanceAccount } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/entities/finance-account.entity';
import { FinanceJournalEntry } from '../../src/modules/tenant/finance/accounting/journal-entries/entities/finance-journal-entry.entity';
import { FinanceJournalLine } from '../../src/modules/tenant/finance/accounting/journal-entries/entities/finance-journal-line.entity';
import { Quotation } from '../../src/modules/tenant/quotations/entities/quotation.entity';
import { QuotationCoverNote } from '../../src/modules/tenant/quotations/entities/structured/quotation-cover-note.entity';
import { QuotationCoverNoteEntry } from '../../src/modules/tenant/quotations/entities/structured/quotation-cover-note-entry.entity';
import { QuotationEntryRisk } from '../../src/modules/tenant/quotations/entities/structured/quotation-entry-risk.entity';
import { QuotationRiskTax } from '../../src/modules/tenant/quotations/entities/structured/quotation-risk-tax.entity';
import { QuotationEntryAddon } from '../../src/modules/tenant/quotations/entities/structured/quotation-entry-addon.entity';
import { QuotationEntryAddonTax } from '../../src/modules/tenant/quotations/entities/structured/quotation-entry-addon-tax.entity';
import { Tax } from '../../src/modules/tenant/taxes/entities/tax.entity';
import { PricingQuote } from '../../src/modules/tenant/pricing/entities/pricing-quote.entity';
import { TaxCalculationEvidence1796900000000 } from '../../src/database/migrations/1796900000000-TaxCalculationEvidence';

// Map the real application classes to only the required columns/relations in an
// already-owned private database. No application bootstrap, seeders or real data.
const id: EntitySchemaColumnOptions = {
    type: 'uuid',
    primary: true,
    generated: 'uuid',
  },
  uuid: EntitySchemaColumnOptions = { type: 'uuid' },
  text: EntitySchemaColumnOptions = { type: 'varchar', length: 150 },
  nullableUuid = { ...uuid, nullable: true },
  nullableText = { ...text, nullable: true };
const money: EntitySchemaColumnOptions = {
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  },
  premium: EntitySchemaColumnOptions = {
    type: 'numeric',
    precision: 20,
    scale: 4,
    default: 0,
  },
  rate: EntitySchemaColumnOptions = {
    type: 'numeric',
    precision: 18,
    scale: 10,
  };
const fields = (names: string[], type: EntitySchemaColumnOptions) =>
  Object.fromEntries(names.map((k) => [k, { ...type }]));
const schema = (
  target: any,
  tableName: string,
  columns: Record<string, EntitySchemaColumnOptions>,
  relations: any = {},
) =>
  new EntitySchema({
    name: target.name,
    target,
    tableName,
    columns: { id, ...columns },
    relations,
  });
const schemas = [
  schema(
    Quotation,
    'quotations',
    {
      company_id: uuid,
      customer_id: uuid,
      workflow_revision: { type: 'int' },
      deleted_at: { type: 'timestamptz', nullable: true, deleteDate: true },
    },
    {
      cover_note: {
        type: 'one-to-one',
        target: 'QuotationCoverNote',
        inverseSide: 'quotation',
      },
    },
  ),
  schema(
    QuotationCoverNote,
    'quotation_cover_notes',
    {
      quotation_id: uuid,
      currency_code: text,
      cover_note_start_date: { type: 'timestamptz' },
      ...fields(
        ['total_premium_excluding_tax', 'total_premium_including_tax'],
        premium,
      ),
    },
    {
      quotation: {
        type: 'one-to-one',
        target: 'Quotation',
        joinColumn: { name: 'quotation_id' },
      },
      entries: {
        type: 'one-to-many',
        target: 'QuotationCoverNoteEntry',
        inverseSide: 'cover_note',
      },
    },
  ),
  schema(
    QuotationCoverNoteEntry,
    'quotation_cover_note_entries',
    { cover_note_id: uuid },
    {
      cover_note: {
        type: 'many-to-one',
        target: 'QuotationCoverNote',
        joinColumn: { name: 'cover_note_id' },
      },
      risks: {
        type: 'one-to-many',
        target: 'QuotationEntryRisk',
        inverseSide: 'entry',
      },
      addons: {
        type: 'one-to-many',
        target: 'QuotationEntryAddon',
        inverseSide: 'entry',
      },
    },
  ),
  schema(
    QuotationEntryRisk,
    'quotation_entry_risks',
    {
      entry_id: uuid,
      risk_code: text,
      pricing_quote_id: nullableText,
      pricing_result_hash: nullableText,
      pricing_snapshot: { type: 'jsonb', nullable: true },
      ...fields(
        [
          'premium_before_discount',
          'premium_excluding_tax_equivalent',
          'premium_including_tax',
        ],
        premium,
      ),
    },
    {
      entry: {
        type: 'many-to-one',
        target: 'QuotationCoverNoteEntry',
        joinColumn: { name: 'entry_id' },
      },
      taxes: {
        type: 'one-to-many',
        target: 'QuotationRiskTax',
        inverseSide: 'risk',
      },
    },
  ),
  schema(
    QuotationEntryAddon,
    'quotation_entry_addons',
    {
      entry_id: uuid,
      addon_reference: text,
      ...fields(
        ['premium_excluding_tax_equivalent', 'premium_including_tax'],
        premium,
      ),
    },
    {
      entry: {
        type: 'many-to-one',
        target: 'QuotationCoverNoteEntry',
        joinColumn: { name: 'entry_id' },
      },
      taxes: {
        type: 'one-to-many',
        target: 'QuotationEntryAddonTax',
        inverseSide: 'addon',
      },
    },
  ),
  schema(
    QuotationRiskTax,
    'quotation_risk_taxes',
    {
      risk_id: uuid,
      tax_code: text,
      tax_rate: rate,
      tax_amount: premium,
      is_tax_exempted: text,
      tax_exemption_type: nullableText,
      tax_exemption_reference: nullableText,
    },
    {
      risk: {
        type: 'many-to-one',
        target: 'QuotationEntryRisk',
        joinColumn: { name: 'risk_id' },
      },
    },
  ),
  schema(
    QuotationEntryAddonTax,
    'quotation_entry_addon_taxes',
    {
      addon_id: uuid,
      tax_code: text,
      tax_rate: rate,
      tax_amount: premium,
      is_tax_exempted: text,
      tax_exemption_type: nullableText,
      tax_exemption_reference: nullableText,
    },
    {
      addon: {
        type: 'many-to-one',
        target: 'QuotationEntryAddon',
        joinColumn: { name: 'addon_id' },
      },
    },
  ),
  schema(Tax, 'taxes', {
    company_id: uuid,
    tax_code: text,
    tax_name: text,
    tax_rate: rate,
    is_active: { type: 'boolean', default: true },
    is_default: { type: 'boolean', default: false },
    calculation_options: { type: 'jsonb', nullable: true },
    deleted_at: { type: 'timestamptz', nullable: true, deleteDate: true },
  }),
  schema(PricingQuote, 'pricing_quotes', {
    company_id: uuid,
    pricing_quote_id: text,
    result_hash: nullableText,
    result_payload: { type: 'jsonb' },
  }),
  schema(
    Invoice,
    'invoices',
    {
      ...fields(
        [
          'company_id',
          'insurer_company_id',
          'customer_id',
          'created_by',
          'updated_by',
        ],
        uuid,
      ),
      ...fields(
        [
          'intermediary_company_id',
          'quotation_id',
          'policy_id',
          'branch_id',
          'endorsement_id',
          'cancellation_id',
        ],
        nullableUuid,
      ),
      ...fields(
        ['invoice_no', 'invoice_type', 'source_type', 'currency', 'status'],
        text,
      ),
      source_record_id: nullableUuid,
      source_revision: { type: 'int', nullable: true },
      ...fields(
        [
          'gross_amount',
          'discount_amount',
          'tax_amount',
          'charges_amount',
          'total_amount',
          'paid_amount',
          'balance_amount',
        ],
        money,
      ),
      ...fields(
        ['allocated_amount', 'refunded_amount', 'written_off_amount'],
        premium,
      ),
      pricing_result_hash: nullableText,
      source_snapshot_hash: nullableText,
      source_snapshot: { type: 'jsonb', nullable: true },
      notes: nullableText,
      due_date: { type: 'date', nullable: true },
      balance_revision: { type: 'int', default: 1 },
      state_version: { type: 'int', default: 1 },
      created_at: { type: 'timestamptz', createDate: true },
      deleted_at: { type: 'timestamptz', deleteDate: true, nullable: true },
    },
    {
      items: {
        type: 'one-to-many',
        target: 'InvoiceItem',
        inverseSide: 'invoice',
      },
    },
  ),
  schema(
    InvoiceItem,
    'invoice_items',
    {
      invoice_id: uuid,
      ...fields(
        [
          'item_type',
          'item_name',
          'description',
          'source_line_type',
          'source_line_id',
        ],
        text,
      ),
      ...fields(['quantity', 'unit_amount', 'total_amount'], money),
      line_snapshot: { type: 'jsonb' },
      line_hash: text,
    },
    {
      invoice: {
        type: 'many-to-one',
        target: 'Invoice',
        joinColumn: { name: 'invoice_id' },
      },
    },
  ),
];
export async function withQuotationTaxSchema<T>(
  owned: DataSource,
  run: (f: Awaited<ReturnType<typeof seed>>) => Promise<T>,
) {
  const s = new DataSource({
    ...owned.options,
    entities: [
      ...schemas,
      FinanceAccount,
      FinanceJournalEntry,
      FinanceJournalLine,
    ],
    migrations: [],
    migrationsRun: false,
    synchronize: false,
  });
  try {
    await s.initialize();
    await s.synchronize();
    await s.query('ALTER TABLE taxes DROP COLUMN calculation_options');
    const runner = s.createQueryRunner();
    try {
      await new TaxCalculationEvidence1796900000000().up(runner);
    } finally {
      await runner.release();
    }
    return await run(await seed(s));
  } finally {
    if (s.isInitialized) await s.destroy();
  }
}
async function seed(s: DataSource) {
  const d = quotationTaxData(),
    cover = d.quotation.cover_note,
    entry = cover.entries[0];
  await s.getRepository(Quotation).save({
    id: d.quoteId,
    company_id: d.companyId,
    customer_id: d.customerId,
    workflow_revision: 3,
  });
  await s
    .getRepository(QuotationCoverNote)
    .save({ ...cover, entries: undefined });
  await s
    .getRepository(QuotationCoverNoteEntry)
    .save({ id: entry.id, cover_note_id: cover.id });
  await s
    .getRepository(QuotationEntryRisk)
    .save({ ...d.risk, entry_id: entry.id, taxes: undefined });
  for (const t of d.risk.taxes)
    await s.getRepository(QuotationRiskTax).save({ ...t, risk_id: d.riskId });
  for (const t of d.catalogue) await s.getRepository(Tax).save(t);
  for (const [code, type] of [
    ['1200', 'ASSET'],
    ['4100', 'INCOME'],
    ['4200', 'LIABILITY'],
    ['4210', 'LIABILITY'],
    ['4300', 'INCOME'],
  ])
    await s.getRepository(FinanceAccount).save({
      company_id: d.companyId,
      account_code: code,
      account_name: `Synthetic ${code}`,
      account_type: type,
      is_active: true,
      is_control_account: false,
    });
  let seq = 0;
  const identifier = {
    generateInvoiceNumber: async () => `SYNTHETIC-I${++seq}`,
    generateJournalNumber: async () => `SYNTHETIC-J${++seq}`,
  };
  const service = new QuotationInvoiceService(
      new ProductDefinitionHashService(),
      identifier as never,
    ),
    journal = new FinanceJournalService(
      identifier as never,
      new ProductDefinitionHashService(),
      // Synthetic posting-vector fixture only; real policy eligibility is tested separately.
      { requireEligible: async () => undefined },
    );
  return {
    ...d,
    source: s,
    service,
    journal,
    create: () => service.createOrReuseQuotationInvoice(s.manager, d.params),
  };
}
