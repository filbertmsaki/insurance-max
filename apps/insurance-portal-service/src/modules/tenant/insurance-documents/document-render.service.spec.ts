import { PDFDocument } from 'pdf-lib';

import { DocumentRenderService } from './document-render.service';

describe('DocumentRenderService', () => {
  let service: DocumentRenderService;

  beforeEach(() => {
    service = new DocumentRenderService();
  });

  it('renders styled PDFs with header, footer, tables, and accurate page count', async () => {
    const body = [
      '# Policy Schedule',
      'Policyholder: {{customer.name}}',
      '',
      '| Cover | Sum insured | Premium |',
      '| --- | --- | --- |',
      '| Motor Comprehensive | TZS 25,000,000 | TZS 650,000 |',
      '',
      ...Array.from(
        { length: 120 },
        (_, index) =>
          `- Covered condition ${index + 1}: insurer wording remains readable and wrapped inside the content area.`,
      ),
    ].join('\n');

    const rendered = service.renderTemplate(body, {
      customer: { name: 'Amani Insurance Customer' },
    });

    const pdf = await service.renderPdf({
      title: 'Policy Schedule',
      body: rendered,
      header: 'Insurance Max - Policy Schedule',
      footer: 'Document {{page_number}} of {{page_count}}',
      stylesheet: JSON.stringify({
        margin: 48,
        fontSize: 10,
        lineHeight: 15,
        titleSize: 18,
        headingSize: 14,
        primaryColor: [0.05, 0.2, 0.35],
      }),
    });

    const loaded = await PDFDocument.load(pdf.buffer);

    expect(pdf.pageCount).toBeGreaterThan(1);
    expect(loaded.getPageCount()).toBe(pdf.pageCount);
    expect(pdf.layoutReview.status).toBe('PASSED');
  });

  it('records layout warnings when long unbroken text must be split', async () => {
    const pdf = await service.renderPdf({
      title: 'Claim Form',
      body: `Claim reference: ${'X'.repeat(500)}`,
    });

    expect(pdf.buffer.length).toBeGreaterThan(0);
    expect(pdf.layoutReview.status).toBe('WARNINGS');
    expect(pdf.layoutReview.warnings.join(' ')).toContain('Long unbroken text');
  });
});
