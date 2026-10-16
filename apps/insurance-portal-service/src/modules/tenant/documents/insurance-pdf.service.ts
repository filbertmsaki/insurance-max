import { Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, grayscale } from 'pdf-lib';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { QuotationsService } from '../quotations/quotations.service';
import { PoliciesService } from '../policies/policies.service';

type Pair = [string, unknown];

@Injectable()
export class InsurancePdfService {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly policies: PoliciesService,
  ) {}

  async quotation(user: AuthenticatedUser, id: string): Promise<{ bytes: Uint8Array; filename: string }> {
    const q = await this.quotations.getPreviewForUser(user, id) as Record<string, any>;
    const overview = q.overview ?? {};
    const cover = q.cover_note ?? {};
    const name = String(overview.quotation_no ?? 'quotation');
    const pairs: Pair[] = [
      ['Quotation number', overview.quotation_no], ['Issue date', overview.created_at],
      ['Status', overview.status], ['Customer', overview.customer_name],
      ['Product', overview.product_name], ['Cover period', `${cover.start_date ?? ''} to ${cover.end_date ?? ''}`],
      ['Currency', cover.currency], ['Sum insured', overview.sum_insured],
      ['Total premium', cover.total_premium_including_tax ?? overview.total_premium_including_tax],
    ];
    const bytes = await this.render('INSURANCE QUOTATION', name, pairs, [
      'This quotation is an offer only and does not itself confirm insurance coverage.',
    ], String(overview.status ?? '').toUpperCase() === 'DRAFT');
    return { bytes, filename: `${safeFilename(name)}.pdf` };
  }

  async schedule(user: AuthenticatedUser, id: string): Promise<{ bytes: Uint8Array; filename: string }> {
    const policy = await this.policies.findOneForUser(user, id);
    if (!policy) throw new NotFoundException('Policy not found');
    const version = await this.policies.findCurrentVersionForUser(user, id) as Record<string, any> | null;
    const snapshot = version?.policy_snapshot ?? {};
    const customer = version?.customer_snapshot ?? policy.customer_snapshot ?? {};
    const pricing = version?.pricing_snapshot ?? policy.pricing_snapshot ?? {};
    const pairs: Pair[] = [
      ['Policy number', policy.policy_no], ['Cover note reference', policy.cover_note_no],
      ['Insured', customer.company_name ?? customer.full_name ?? policy.customer_id],
      ['Address', customer.address ?? ''], ['Cover start', version?.effective_from ?? policy.start_date],
      ['Cover end', version?.effective_to ?? policy.end_date], ['Renewal date', snapshot.renewal_date],
      ['Currency', policy.currency], ['Sum insured', pricing.sum_insured ?? policy.sum_insured],
      ['Premium', pricing.total_premium ?? policy.total_premium], ['Taxes', pricing.total_tax ?? policy.total_tax],
      ['Total payable', pricing.total_premium ?? policy.total_premium], ['Status', version?.status ?? policy.policy_status],
    ];
    const bytes = await this.render('POLICY COVER NOTE SCHEDULE', policy.policy_no, pairs,
      ['Coverage is subject to receipt of premium and the terms, conditions, limits, and exclusions applicable to this policy.'],
      ['DRAFT', 'PENDING', 'INCOMPLETE'].includes(String(policy.policy_status).toUpperCase()));
    return { bytes, filename: `${safeFilename(policy.policy_no)}-schedule.pdf` };
  }

  private async render(title: string, reference: string, values: Pair[], notes: string[], draft: boolean) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595.28, 841.89]);
    const { height } = page.getSize();
    let y = height - 48;
    const line = (text: string, size = 9, isBold = false) => {
      if (y < 54) { page = pdf.addPage([595.28, 841.89]); y = height - 48; }
      page.drawText(text.slice(0, 160), { x: 42, y, size, font: isBold ? bold : font, maxWidth: 510 });
      y -= size + 8;
    };
    line('INSURANCE', 12, true);
    line(title, 16, true);
    if (draft) line('DRAFT', 12, true);
    page.drawRectangle({ x: 38, y: y - 8, width: 519, height: 20, color: grayscale(0.88) });
    y -= 3; line(`Document reference: ${reference}`, 9, true); y -= 6;
    for (const [label, raw] of values) {
      const value = raw == null || raw === '' ? '—' : String(raw);
      if (value === '—') continue;
      if (y < 80) { page = pdf.addPage([595.28, 841.89]); y = height - 48; }
      page.drawRectangle({ x: 38, y: y - 5, width: 519, height: 20, borderWidth: 0.4, borderColor: grayscale(0.3) });
      page.drawText(label, { x: 44, y, size: 8, font: bold, maxWidth: 145 });
      page.drawText(value.slice(0, 120), { x: 195, y, size: 8, font, maxWidth: 350 });
      y -= 20;
    }
    y -= 14; line(title.includes('QUOTATION') ? 'IMPORTANT NOTICE' : 'POLICY TERMS', 10, true);
    for (const note of notes) line(note, 9);
    line(`Generated ${new Date().toISOString()} · ${reference}`, 7);
    return pdf.save();
  }
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, '-').slice(0, 100) || 'document';
}
