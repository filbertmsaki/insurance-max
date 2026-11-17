import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { InsurancePdfService } from './insurance-pdf.service';
import * as renderer from './branded-document.renderer';
import { quotationTaxHarness } from '../../../../test/support/quotation-tax-fixture';
import { endorsementTaxHarness } from '../../../../test/support/endorsement-tax-fixture';
describe('Quotation and invoice tax documents', () => {
  it('renders a corrected endorsement invoice PDF using the stored source/revised components', async () => {
    const f = endorsementTaxHarness(),
      invoice = await f.create(),
      service = new InsurancePdfService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        { findOne: async () => invoice } as never,
        {} as never,
        { findOne: async () => null } as never,
        {} as never,
      );
    const render = jest.spyOn(renderer, 'renderBrandedDocument');
    const result = await service.invoice(
      { companyId: f.companyId } as never,
      invoice.id,
    );
    expect(Buffer.from(result.bytes).subarray(0, 4).toString()).toBe('%PDF');
    const document = render.mock.calls[0][0];
    const evidence = document.sections.find(
      (section) => section.title === 'Tax evidence',
    );
    expect(JSON.stringify(evidence)).toContain('Original reversal');
    expect(JSON.stringify(evidence)).toContain('-18.00');
    render.mockRestore();
  });
  it('generates reconciled quotation and invoice PDFs from the same component evidence', async () => {
    const f = quotationTaxHarness();
    for (const [code, category, rate, account, amount] of [
      ['LEVY', 'LEVY', '0.02', '4210', '2'],
      ['FEE', 'POLICY_FEE', '0.01', '4300', '1'],
    ]) {
      f.catalogue.push({
        id: code,
        tax_code: code,
        tax_name: code,
        tax_rate: rate,
        is_active: true,
        calculation_options: { category, ledger_account_code: account },
      });
      f.risk.taxes.push({
        ...f.risk.taxes[0],
        tax_code: code,
        tax_rate: rate,
        tax_amount: amount,
      });
    }
    f.risk.premium_including_tax = '121';
    f.quotation.cover_note.total_premium_including_tax = '121';
    const invoice = await f.service.createOrReuseQuotationInvoice(f.manager, {
        ...f.params,
        amount: '121',
      }),
      preview = {
        overview: {
          quotation_no: 'SYNTHETIC-Q1',
          quotation_status: 'DRAFT',
          customer_name: 'Synthetic customer',
        },
        cover_note: {
          currency: 'USD',
          start_date: '2026-11-15',
          end_date: '2027-11-14',
        },
        premium_summary: {
          total_premium_excluding_tax: '100.00',
          total_tax_amount: '21.00',
          total_premium_including_tax: '121.00',
        },
        risks: [{ taxes: f.risk.taxes }],
        addons: [],
      };
    const repo = {
        findOne: jest.fn(async ({ where }) =>
          where.company_id === f.companyId ? invoice : null,
        ),
      },
      service = new InsurancePdfService(
        {
          getDocumentSourceForUser: jest.fn(async () => ({
            quotation: { company_id: f.companyId },
            preview,
          })),
        } as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        repo as never,
        {} as never,
        { findOne: async () => null } as never,
        {} as never,
      ),
      user = { companyId: f.companyId } as never;
    const q = await service.quotation(user, f.quoteId),
      i = await service.invoice(user, invoice.id);
    expect(Buffer.from(q.bytes).subarray(0, 4).toString()).toBe('%PDF');
    expect(Buffer.from(i.bytes).subarray(0, 4).toString()).toBe('%PDF');
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoice.id, company_id: f.companyId },
      }),
    );
    if (process.env.FINANCE_TAX_ARTIFACT_DIR) {
      mkdirSync(process.env.FINANCE_TAX_ARTIFACT_DIR, { recursive: true });
      writeFileSync(
        join(
          process.env.FINANCE_TAX_ARTIFACT_DIR,
          'Synthetic-Quotation-Tax-Breakdown.pdf',
        ),
        q.bytes,
      );
      writeFileSync(
        join(
          process.env.FINANCE_TAX_ARTIFACT_DIR,
          'Synthetic-Invoice-Tax-Breakdown.pdf',
        ),
        i.bytes,
      );
    }
  });
  it('refuses a historical invoice document that would falsely show zero tax', async () => {
    const service = new InsurancePdfService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        findOne: jest.fn(async () => ({
          source_type: 'QUOTATION',
          items: [],
          tax_amount: '0.00',
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.invoice({ companyId: 'company' } as never, 'invoice'),
    ).rejects.toThrow('reconcil');
  });
  it('does not disclose another company invoice', async () => {
    const service = new InsurancePdfService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn(async () => null) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.invoice({ companyId: 'other' } as never, 'invoice'),
    ).rejects.toThrow('not found');
  });
});
