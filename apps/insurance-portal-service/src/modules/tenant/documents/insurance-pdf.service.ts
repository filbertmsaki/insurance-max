import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PDFDocument, StandardFonts, grayscale } from 'pdf-lib';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { QuotationsService } from '../quotations/quotations.service';
import { PoliciesService } from '../policies/policies.service';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { MotorPolicyDetail } from '../motor/entities/motor-policy-detail.entity';
import { renderMotorSchedule } from './motor-schedule.renderer';

type Pair = [string, unknown];

@Injectable()
export class InsurancePdfService {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly policies: PoliciesService,
    @InjectRepository(MotorVehicle)
    private readonly vehicles: Repository<MotorVehicle>,
    @InjectRepository(MotorPolicyDetail)
    private readonly motorDetails: Repository<MotorPolicyDetail>,
  ) {}

  async quotation(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ bytes: Uint8Array; filename: string }> {
    const q = (await this.quotations.getPreviewForUser(user, id)) as Record<
      string,
      any
    >;
    const overview = q.overview ?? {};
    const cover = q.cover_note ?? {};
    const name = String(overview.quotation_no ?? 'quotation');
    const pairs: Pair[] = [
      ['Quotation number', overview.quotation_no],
      ['Issue date', overview.created_at],
      ['Status', overview.status],
      ['Customer', overview.customer_name],
      ['Product', overview.product_name],
      ['Cover period', `${cover.start_date ?? ''} to ${cover.end_date ?? ''}`],
      ['Currency', cover.currency],
      ['Sum insured', overview.sum_insured],
      [
        'Total premium',
        cover.total_premium_including_tax ??
          overview.total_premium_including_tax,
      ],
    ];
    const bytes = await this.render(
      'INSURANCE QUOTATION',
      name,
      pairs,
      [
        'This quotation is an offer only and does not itself confirm insurance coverage.',
      ],
      String(overview.status ?? '').toUpperCase() === 'DRAFT',
    );
    return { bytes, filename: `${safeFilename(name)}.pdf` };
  }

  async schedule(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ bytes: Uint8Array; filename: string }> {
    const policy = await this.policies.findOneForUser(user, id);
    if (!policy) throw new NotFoundException('Policy not found');
    const version = (await this.policies.findCurrentVersionForUser(
      user,
      id,
    )) as Record<string, any> | null;
    const snapshot = version?.policy_snapshot ?? {};
    const customer =
      version?.customer_snapshot ?? policy.customer_snapshot ?? {};
    const pricing = version?.pricing_snapshot ?? policy.pricing_snapshot ?? {};
    const draft = ['DRAFT', 'PENDING', 'INCOMPLETE'].includes(
      String(policy.policy_status).toUpperCase(),
    );
    const filename = `${safeFilename(policy.policy_no)}-schedule.pdf`;

    const motorRisks = (policy.risks ?? []).filter(
      (risk) => risk.motor_vehicle_id && !risk.deleted_at,
    );
    if (motorRisks.length) {
      const bytes = await this.motorSchedule(
        user,
        policy,
        motorRisks,
        customer,
        pricing,
        version,
        draft,
      );
      return { bytes, filename };
    }

    const pairs: Pair[] = [
      ['Policy number', policy.policy_no],
      ['Cover note reference', policy.cover_note_no],
      [
        'Insured',
        customer.company_name ?? customer.full_name ?? policy.customer_id,
      ],
      ['Address', customer.address ?? ''],
      ['Cover start', version?.effective_from ?? policy.start_date],
      ['Cover end', version?.effective_to ?? policy.end_date],
      ['Renewal date', snapshot.renewal_date],
      ['Currency', policy.currency],
      ['Sum insured', pricing.sum_insured ?? policy.sum_insured],
      ['Premium', pricing.total_premium ?? policy.total_premium],
      ['Taxes', pricing.total_tax ?? policy.total_tax],
      ['Total payable', pricing.total_premium ?? policy.total_premium],
      ['Status', version?.status ?? policy.policy_status],
    ];
    const bytes = await this.render(
      'POLICY COVER NOTE SCHEDULE',
      policy.policy_no,
      pairs,
      [
        'Coverage is subject to receipt of premium and the terms, conditions, limits, and exclusions applicable to this policy.',
      ],
      draft,
    );
    return { bytes, filename };
  }

  private async motorSchedule(
    user: AuthenticatedUser,
    policy: Policy,
    risks: PolicyRisk[],
    customer: Record<string, any>,
    pricing: Record<string, any>,
    version: Record<string, any> | null,
    draft: boolean,
  ) {
    const [vehicles, details] = await Promise.all([
      this.vehicles.find({
        where: { id: In(risks.map((risk) => risk.motor_vehicle_id!)) },
      }),
      this.motorDetails.find({ where: { policy_id: policy.id } }),
    ]);
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const detailByRisk = new Map(details.map((d) => [d.policy_risk_id, d]));

    const total = toNumber(pricing.total_premium ?? policy.total_premium);
    const vat = toNumber(pricing.total_tax ?? policy.total_tax);
    const premium = total - vat;
    const vatRate = premium > 0 ? (vat / premium) * 100 : 0;

    const start = version?.effective_from ?? policy.start_date;
    const end = version?.effective_to ?? policy.end_date;
    const intermediary = policy.intermediary_company?.name ?? '';
    const issuer = intermediary || policy.insurer_company?.name || '';
    const printedBy = user.companyName || issuer;
    const today = formatDate(new Date());

    return renderMotorSchedule({
      insurerName: policy.insurer_company?.name ?? '',
      insurerLogo: await fetchLogo(policy.insurer_company?.logo_url),
      policyNo: policy.policy_no,
      coverNoteNo: policy.cover_note_no ?? '',
      insuredName: (
        customer.company_name ??
        customer.display_name ??
        [customer.first_name, customer.middle_name, customer.last_name]
          .filter(Boolean)
          .join(' ')
      ).toUpperCase(),
      brokerInvoiceNo: String(
        policy.metadata?.broker_invoice_no ??
          policy.distribution_snapshot?.invoice_no ??
          '',
      ),
      addressDetails: String(
        customer.street ?? customer.district ?? customer.address ?? '',
      ),
      postalAddress: [
        customer.street ?? customer.district,
        customer.postal_address,
        customer.region,
        customer.district,
        customer.country ?? 'Tanzania (United Republic of Tanzania)',
      ]
        .filter(Boolean)
        .join(','),
      from: formatDate(start),
      to: formatDate(end),
      renewalDate: formatDate(addDays(end, 1)),
      currency: policy.currency,
      premium: formatMoney(premium),
      vatLabel: `VAT @ ${vatRate.toFixed(1)}%`,
      vat: formatMoney(vat),
      total: formatMoney(total),
      vehicles: risks.map((risk) => {
        const v = vehicleById.get(risk.motor_vehicle_id!);
        const detail = detailByRisk.get(risk.id);
        return {
          registrationNo: v?.registration_no ?? '',
          makeModelBody: [v?.make, v?.model, v?.body_type]
            .filter(Boolean)
            .join(' / '),
          cc: v?.cubic_capacity?.toString() ?? '',
          year: v?.manufacture_year?.toString() ?? '',
          sticker: detail?.sticker_no ?? policy.sticker_no ?? '',
          seating: v?.seating_capacity?.toString() ?? '',
          color: v?.color ?? '',
          coverType: humanize(
            detail?.cover_type ?? v?.vehicle_category ?? v?.usage_type ?? '',
          ),
          windscreenAmount: '',
          estimatedValue: formatMoney(toNumber(risk.sum_insured)),
        };
      }),
      place: 'Dar Es Salaam',
      issueDate: formatDate(policy.issue_date ?? start),
      intermediary,
      preparedBy: issuer,
      approvedBy: issuer,
      printedBy,
      printedOn: today,
      draft,
    });
  }

  private async render(
    title: string,
    reference: string,
    values: Pair[],
    notes: string[],
    draft: boolean,
  ) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595.28, 841.89]);
    const { height } = page.getSize();
    let y = height - 48;
    const line = (text: string, size = 9, isBold = false) => {
      if (y < 54) {
        page = pdf.addPage([595.28, 841.89]);
        y = height - 48;
      }
      page.drawText(text.slice(0, 160), {
        x: 42,
        y,
        size,
        font: isBold ? bold : font,
        maxWidth: 510,
      });
      y -= size + 8;
    };
    line('INSURANCE', 12, true);
    line(title, 16, true);
    if (draft) line('DRAFT', 12, true);
    page.drawRectangle({
      x: 38,
      y: y - 8,
      width: 519,
      height: 20,
      color: grayscale(0.88),
    });
    y -= 3;
    line(`Document reference: ${reference}`, 9, true);
    y -= 6;
    for (const [label, raw] of values) {
      const value = raw == null || raw === '' ? '—' : String(raw);
      if (value === '—') continue;
      if (y < 80) {
        page = pdf.addPage([595.28, 841.89]);
        y = height - 48;
      }
      page.drawRectangle({
        x: 38,
        y: y - 5,
        width: 519,
        height: 20,
        borderWidth: 0.4,
        borderColor: grayscale(0.3),
      });
      page.drawText(label, { x: 44, y, size: 8, font: bold, maxWidth: 145 });
      page.drawText(value.slice(0, 120), {
        x: 195,
        y,
        size: 8,
        font,
        maxWidth: 350,
      });
      y -= 20;
    }
    y -= 14;
    line(
      title.includes('QUOTATION') ? 'IMPORTANT NOTICE' : 'POLICY TERMS',
      10,
      true,
    );
    for (const note of notes) line(note, 9);
    line(`Generated ${new Date().toISOString()} · ${reference}`, 7);
    return pdf.save();
  }
}

function safeFilename(value: string) {
  const sanitized = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return /[\\/:*?"<>|]/.test(character) || code < 32 || code === 127
        ? '-'
        : character;
    })
    .join('');

  return sanitized.replace(/\s+/g, '-').slice(0, 100) || 'document';
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** dd/mm/yyyy, as printed on Tanzanian policy documents. */
function formatDate(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

function addDays(value: unknown, days: number) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Best-effort logo download; the schedule renders without it on failure. */
async function fetchLogo(url: string | null | undefined) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
