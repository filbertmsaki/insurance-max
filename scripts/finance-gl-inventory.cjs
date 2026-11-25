// Read-only FIN-02 cutover inventory. Supply FINANCE_INVENTORY_URL for the target.
const { Client } = require('pg');
const gl = [
  'MANUAL',
  'RECURRING',
  'ACCRUAL',
  'ACCRUAL_SETTLEMENT',
  'PREPAYMENT',
  'PREPAYMENT_RELEASE',
  'INTERBRANCH',
  'ALLOCATION',
  'REVALUATION',
];
const native = {
  INVOICE: ['INVOICE_ISSUED', 'ORDINARY'],
  RECEIPT: ['RECEIPT_POSTED', 'CASH'],
  INVOICE_WRITE_OFF: ['INVOICE_WRITTEN_OFF', 'ORDINARY'],
  REFUND: ['REFUND_PAID', 'CASH'],
  COMMISSION_ACCRUAL: ['COMMISSION_ACCRUED', 'ORDINARY'],
  COMMISSION_PAYMENT: ['COMMISSION_PAYMENT_PAID', 'CASH'],
  CLAIM_DISBURSEMENT: ['CLAIM_DISBURSEMENT_PAID', 'CASH'],
  CLAIM_RECOVERY_RECEIPT: ['RECOVERY_RECEIPT_RECORDED', 'CASH'],
  REINSURANCE_SETTLEMENT: ['REINSURANCE_SETTLEMENT_PAID', 'CASH'],
};

async function inventory(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const {
      rows: [schema],
    } = await client.query(
      "SELECT to_regclass('public.finance_operating_setups') IS NOT NULL fin01,to_regclass('public.finance_gl_deployments') IS NOT NULL fin02,to_regclass('public.finance_gl_premium_memos') IS NOT NULL gl_completion",
    );
    const { rows: companies } = await client.query(
      'SELECT id,name,company_type FROM companies ORDER BY name,id',
    );
    for (const c of companies) {
      c.required = [];
      c.reviewedExclusions = {};
      if (!schema.fin01) {
        c.required.push(
          'Install FIN-01 after inventory and approve the company primary book.',
        );
        continue;
      }
      const {
        rows: [b],
      } = await client.query(
        `SELECT a.book_id,a.release_id,a.starts_on::text,a.ends_before::text,(statement_timestamp() AT TIME ZONE a.timezone)::date::text today,
        ctx.payload->'allowedComponents' components,ctx.payload->>'basis' basis,ld.action ledger_action,ld.release_id ledger_release,
        coalesce(jsonb_array_length(dim.payload#>'{companyMaster,branchIds}'),0) branch_count,coalesce(jsonb_array_length(a.controls->'costCentres'),0) centre_count
        FROM finance_operating_setups a LEFT JOIN finance_foundation_documents rel ON rel.id=a.release_id LEFT JOIN finance_foundation_documents ctx ON ctx.id=rel.parent_id
        LEFT JOIN finance_configuration_releases dim ON dim.id::text=a.controls->>'dimensionReleaseId' AND dim.release_hash=a.controls->>'dimensionReleaseHash'
        LEFT JOIN LATERAL(SELECT action,release_id FROM finance_foundation_deployments WHERE book_id=a.book_id ORDER BY sequence DESC LIMIT 1) ld ON true
        WHERE a.company_id=$1 AND a.withdrawn_at IS NULL AND a.book_role='PRIMARY'`,
        [c.id],
      );
      if (!b) {
        c.required.push('Approve and activate a primary operating book.');
        continue;
      }
      c.bookId = b.book_id;
      c.releaseId = b.release_id;
      if (b.today < b.starts_on || b.today >= b.ends_before)
        c.required.push('Renew the effective FIN-01 calendar and release.');
      if (b.ledger_action !== 'ENABLE' || b.ledger_release !== b.release_id)
        c.required.push('Enable the linked ledger release.');
      if (!b.branch_count) c.required.push('Review the company branch master.');
      if (!b.centre_count)
        c.required.push('Review operating expense cost centres.');
      const rules = b.components ?? [];
      c.missingVoucherRules = gl.filter(
        (k) =>
          !rules.some(
            (r) =>
              r.origin === 'FIN02_GL' &&
              r.component === k &&
              r.owner === 'FINANCE' &&
              r.sourceEventType === null &&
              ['CASH', 'ORDINARY'].includes(r.effect),
          ),
      );
      if (!schema.gl_completion)
        c.required.push('Apply the FIN-02 ledger completion migration.');
      if (
        b.basis === 'IFRS' &&
        (['INSURANCE_COMPANY', 'REINSURANCE_COMPANY'].includes(
          c.company_type,
        ) ||
          rules.some(
            (r) =>
              r.origin === 'IFRS17_ENGINE' &&
              r.sourceEventType === 'IFRS17_MEASUREMENT_APPROVED',
          ))
      ) {
        if (
          rules.filter(
            (r) =>
              r.origin === 'INSURANCE_PORTAL_FINANCE' &&
              r.owner === 'FINANCE' &&
              r.effect === 'CASH' &&
              r.sourceEventType === 'PREMIUM_RECEIPT_POSTED' &&
              r.factKind === 'RECEIPT',
          ).length !== 1
        )
          c.required.push('Approve the premium cash collection mapping.');
        if (
          rules.filter(
            (r) =>
              r.origin === 'INSURANCE_PORTAL_FINANCE' &&
              r.owner === 'FINANCE' &&
              r.effect === 'BILLING_MEMORANDUM' &&
              r.factKind === 'INVOICE' &&
              r.sourceEventType === 'INVOICE_ISSUED',
          ).length !== 1
        )
          c.required.push('Approve a premium billing memorandum rule.');
        if (
          !rules.some(
            (r) =>
              r.origin === 'IFRS17_ENGINE' &&
              r.owner === 'IFRS17_ENGINE' &&
              r.effect === 'INSURANCE_MEASUREMENT' &&
              r.factKind === 'IFRS17_MEASUREMENT' &&
              r.sourceEventType === 'IFRS17_MEASUREMENT_APPROVED',
          )
        )
          c.required.push(
            'Approve the insurance measurement policy and roles.',
          );
      }
      c.missingNativeRules = Object.entries(native)
        .filter(
          ([kind, [event, effect]]) =>
            !rules.some(
              (r) =>
                r.origin === 'INSURANCE_PORTAL_FINANCE' &&
                r.factKind === kind &&
                r.sourceEventType === event &&
                r.owner === 'FINANCE' &&
                r.effect === effect,
            ),
        )
        .map(([kind]) => kind);
      const {
        rows: [counts],
      } = await client.query(
        `SELECT count(*)::int requests,count(j.id)::int posted,count(*) FILTER(WHERE j.id IS NULL)::int unposted,
        count(*) FILTER(WHERE EXISTS(SELECT 1 FROM finance_journal_entries old WHERE old.company_id=p.company_id AND old.source_type=p.source_type AND old.source_id=p.source_id))::int AS overlaps
        FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' WHERE p.book_id=$1`,
        [b.book_id],
      );
      c.accounting = counts;
      if (counts.overlaps)
        c.required.push('Reconcile overlapping canonical and legacy sources.');
      if (!schema.fin02)
        c.required.push(
          'Apply the FIN-02 migration after reviewing this inventory.',
        );
      else {
        const {
          rows: [d],
        } = await client.query(
          'SELECT action,release_id,evidence FROM finance_gl_deployments WHERE book_id=$1 ORDER BY sequence DESC LIMIT 1',
          [b.book_id],
        );
        c.deployment = d?.action ?? 'PENDING';
        if (d?.release_id === b.release_id)
          c.reviewedExclusions = d.evidence.exclusions ?? {};
        if (d?.action !== 'ENABLE' || d.release_id !== b.release_id)
          c.required.push(
            'Record independent Finance rollout approval for the active release.',
          );
      }
      if (c.missingVoucherRules.length)
        c.required.push('Review missing voucher posting rules.');
      if (c.missingNativeRules.some((k) => !c.reviewedExclusions[k]))
        c.required.push(
          'Review missing native mappings and document non-applicable activities.',
        );
    }
    await client.query('COMMIT');
    return { schema, companies };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
module.exports = { inventory };
if (require.main === module) {
  (async () => {
    if (!process.env.FINANCE_INVENTORY_URL)
      throw Error(
        'Set FINANCE_INVENTORY_URL to the authorized read-only database connection.',
      );
    const client = new Client({
      connectionString: process.env.FINANCE_INVENTORY_URL,
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    try {
      process.stdout.write(
        JSON.stringify(await inventory(client), null, 2) + '\n',
      );
    } finally {
      await client.end();
    }
  })().catch((error) => {
    process.stderr.write((error.message ?? 'Inventory failed') + '\n');
    process.exitCode = 1;
  });
}
