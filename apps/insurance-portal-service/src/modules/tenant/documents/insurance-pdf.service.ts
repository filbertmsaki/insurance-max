import { Injectable, NotFoundException } from '@nestjs/common';
import { DataScopePermissions } from '@insurance-max/contracts';
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
import {
  MotorScheduleVehicle,
  renderMotorSchedule,
} from './motor-schedule.renderer';

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
    const q = (await this.quotations.getPreviewForUser(
      companyWide(user),
      id,
    )) as Record<string, any>;
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
    // Documents are company-wide: any member may print any company policy.
    user = companyWide(user);
    const policy = await this.policies.findOneForUser(user, id);
    if (!policy) throw new NotFoundException('Policy not found');
    const version = (await this.policies.findCurrentVersionForUser(
      user,
      id,
    )) as Record<string, any> | null;
    const snapshot: Record<string, any> =
      version?.customer_snapshot ?? policy.customer_snapshot ?? {};
    // Snapshot values win, but blanks fall back to the live customer record.
    const customer: Record<string, any> = { ...(policy.customer ?? {}) };
    for (const [key, value] of Object.entries(snapshot)) {
      if (value != null && value !== '') customer[key] = value;
    }
    // Last resort: the source quotation's first policyholder.
    const quotation = await this.quotationPreview(user, policy.quotation_id);
    const holder = quotation?.policyholders?.[0];
    if (holder) {
      const fromHolder: Record<string, unknown> = {
        full_name: holder.full_name,
        phone: holder.phone_number,
        email: holder.email_address,
        postal_address: holder.postal_address,
        street: holder.street,
        district: holder.district,
        region: holder.region,
        country: holder.country,
      };
      for (const [key, value] of Object.entries(fromHolder)) {
        if (isBlank(customer[key]) && !isBlank(value)) customer[key] = value;
      }
    }
    const pricing = version?.pricing_snapshot ?? policy.pricing_snapshot ?? {};
    const draft = ['DRAFT', 'PENDING', 'INCOMPLETE'].includes(
      String(policy.policy_status).toUpperCase(),
    );
    const filename = `${safeFilename(policy.policy_no)}-schedule.pdf`;

    const activeRisks = (policy.risks ?? []).filter((risk) => !risk.deleted_at);
    const bytes = await this.motorSchedule(
      user,
      policy,
      activeRisks,
      customer,
      pricing,
      version,
      draft,
      quotation,
    );
    return { bytes, filename };
  }

  /** Quotation preview for fallback data; null when absent or out of scope. */
  private async quotationPreview(
    user: AuthenticatedUser,
    quotationId: string | null,
  ): Promise<Record<string, any> | null> {
    if (!quotationId) return null;
    try {
      return (await this.quotations.getPreviewForUser(
        user,
        quotationId,
      )) as Record<string, any>;
    } catch {
      return null;
    }
  }

  private async motorSchedule(
    user: AuthenticatedUser,
    policy: Policy,
    risks: PolicyRisk[],
    customer: Record<string, any>,
    pricing: Record<string, any>,
    version: Record<string, any> | null,
    draft: boolean,
    quotation: Record<string, any> | null,
  ) {
    const details = await this.motorDetails.find({
      where: { policy_id: policy.id },
    });
    const detailByRisk = new Map(details.map((d) => [d.policy_risk_id, d]));
    // A risk may link its vehicle directly or only through the motor detail.
    const vehicleIdOf = (risk: PolicyRisk) =>
      risk.motor_vehicle_id ?? detailByRisk.get(risk.id)?.motor_vehicle_id;
    const vehicleIds = risks
      .map(vehicleIdOf)
      .filter((id): id is string => !!id);
    const vehicles = vehicleIds.length
      ? await this.vehicles.find({ where: { id: In(vehicleIds) } })
      : [];
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

    const total = toNumber(pricing.total_premium ?? policy.total_premium);
    const vat = toNumber(pricing.total_tax ?? policy.total_tax);
    const premium = total - vat;
    const vatRate = premium > 0 ? (vat / premium) * 100 : 0;
    const premiumLines = itemisePremium(policy, premium, vat, vatRate);
    const status = String(version?.status ?? policy.policy_status ?? '');
    const insuredName = String(
      customer.company_name ||
        customer.full_name ||
        customer.display_name ||
        [customer.first_name, customer.middle_name, customer.last_name]
          .filter(Boolean)
          .join(' '),
    ).toUpperCase();

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
      insuredName,
      insurerContact: insurerContact(policy.insurer_company),
      productName: [policy.product?.product_name, policy.sub_class?.name]
        .filter(Boolean)
        .join(' / '),
      policyStatus: humanize(status),
      branch: policy.branch?.name ?? '',
      insuredTin: String(customer.tin ?? ''),
      insuredPhone: String(customer.phone ?? ''),
      insuredEmail: String(customer.email ?? ''),
      sumInsured: `${policy.currency} ${formatMoney(
        toNumber(pricing.sum_insured ?? policy.sum_insured),
      )}`,
      premiumLines,
      verification: [
        `Policy: ${policy.policy_no}`,
        policy.cover_note_no && `Cover note: ${policy.cover_note_no}`,
        policy.sticker_no && `Sticker: ${policy.sticker_no}`,
        `Insured: ${insuredName}`,
        `Period: ${formatDate(start)} - ${formatDate(end)}`,
        `Status: ${status}`,
        `Insurer: ${policy.insurer_company?.name ?? ''}`,
      ]
        .filter(Boolean)
        .join('\n'),
      generatedAt: `${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
      watermark: draft
        ? 'DRAFT'
        : STAMPED_STATUSES.includes(status.toUpperCase())
          ? status.toUpperCase()
          : '',
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
      total: formatMoney(total),
      vehicles:
        withFallback(
          manifestVehicles(
            version,
            policy.sticker_no ?? version?.regulatory_sticker_number ?? '',
          ),
          quotationVehicles(quotation, policy.sticker_no ?? ''),
        ) ??
        risks.map((risk) => {
          const vehicleId = vehicleIdOf(risk);
          const v = vehicleId ? vehicleById.get(vehicleId) : undefined;
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

const STAMPED_STATUSES = [
  'CANCELLED',
  'EXPIRED',
  'LAPSED',
  'SUSPENDED',
  'REJECTED',
  'VOID',
];

/**
 * Premium lines for the schedule from the stored breakdown, summed per item
 * across risks. Commission is internal and never printed. Falls back to a
 * plain premium + VAT split when no breakdown was stored.
 */
function itemisePremium(
  policy: Policy,
  premium: number,
  vat: number,
  vatRate: number,
): [string, string][] {
  const totals = new Map<string, number>();
  for (const item of policy.premium_breakdowns ?? []) {
    const type = String(item.item_type);
    if (item.deleted_at || type === 'COMMISSION') continue;
    let amount = toNumber(item.amount);
    if (type === 'DISCOUNT') amount = -Math.abs(amount);
    const label = item.item_name || humanize(type);
    totals.set(label, (totals.get(label) ?? 0) + amount);
  }
  if (!totals.size) {
    return [
      ['Premium', formatMoney(premium)],
      [`VAT @ ${vatRate.toFixed(1)}%`, formatMoney(vat)],
    ];
  }
  return [...totals]
    .filter(([, amount]) => Math.abs(amount) >= 0.005)
    .map(([label, amount]) => [label, formatMoney(amount)]);
}

/** Letterhead lines: address, contacts and regulatory identifiers. */
function insurerContact(company: Policy['insurer_company'] | null) {
  if (!company) return [];
  const a = company.address ?? {};
  const join = (parts: unknown[], sep: string) =>
    parts.filter(Boolean).join(sep);
  return [
    join([a.street, a.city, a.region], ', '),
    join([a.postal_code && `P.O. Box ${a.postal_code}`, a.country], ', '),
    join(
      [
        company.contact_phone && `Tel: ${company.contact_phone}`,
        company.contact_email,
      ],
      '  |  ',
    ),
    company.website ?? '',
    join(
      [
        company.tin && `TIN: ${company.tin}`,
        company.tira_license_number &&
          `TIRA Licence: ${company.tira_license_number}`,
      ],
      '  |  ',
    ),
  ].filter(Boolean);
}

/**
 * Vehicle rows from the issued version's asset manifest. Issuance snapshots
 * each cover-note entry's motor details there (policy risks are not linked to
 * MotorVehicle records), so this is the authoritative source. Returns null
 * when the manifest carries no motor entries.
 */
function manifestVehicles(
  version: Record<string, any> | null,
  fallbackSticker: string,
) {
  const entries: Record<string, any>[] = (
    version?.asset_manifest?.entries ?? []
  ).filter((entry: Record<string, any>) => entry?.motor);
  if (!entries.length) return null;
  return entries.map((entry) => {
    const m = entry.motor as Record<string, any>;
    const sumInsured = (entry.risks ?? []).reduce(
      (sum: number, risk: Record<string, any>) =>
        sum + toNumber(risk.sumInsured),
      0,
    );
    const str = (value: unknown) => (value == null ? '' : String(value));
    return {
      registrationNo: str(m.registrationNumber),
      makeModelBody: [m.make, m.model, m.bodyType].filter(Boolean).join(' / '),
      cc: str(m.engineCapacity),
      year: str(m.yearOfManufacture),
      sticker: str(entry.stickerNumber ?? fallbackSticker),
      seating: str(m.sittingCapacity),
      color: str(m.color),
      coverType: humanize(str(m.motorUsage ?? m.motorCategory ?? '')),
      windscreenAmount: '',
      estimatedValue: formatMoney(sumInsured),
    };
  });
}

type VehicleRow = MotorScheduleVehicle;

function isBlank(value: unknown) {
  return value == null || String(value).trim() === '';
}

/**
 * Vehicle rows from the source quotation: one per fleet vehicle, or the single
 * motor detail. The preview already maps usage codes to readable labels.
 */
function quotationVehicles(
  preview: Record<string, any> | null,
  fallbackSticker: string,
): VehicleRow[] | null {
  if (!preview) return null;
  const units: Record<string, any>[] = preview.fleet?.vehicles?.length
    ? preview.fleet.vehicles.map((v: Record<string, any>) => ({
        motor: v.motor_details,
        risks: v.risks,
        sticker: v.tiramis?.sticker_number,
      }))
    : [
        {
          motor: preview.motor_details,
          risks: preview.risks,
          sticker: preview.tiramis?.sticker_number,
        },
      ];
  const rows = units
    .filter((unit) => unit.motor)
    .map((unit): VehicleRow => {
      const m = unit.motor as Record<string, any>;
      const str = (value: unknown) => (value == null ? '' : String(value));
      const sumInsured = (unit.risks ?? []).reduce(
        (sum: number, risk: Record<string, any>) =>
          sum + toNumber(risk.sum_insured),
        0,
      );
      return {
        registrationNo: str(m.registration_number),
        makeModelBody: [m.make, m.model, m.body_type]
          .filter(Boolean)
          .join(' / '),
        cc: str(m.engine_capacity),
        year: str(m.year_of_manufacture),
        sticker: str(unit.sticker ?? fallbackSticker),
        seating: str(m.seating_capacity),
        color: str(m.colour),
        coverType: str(m.motor_usage ?? m.motor_category),
        windscreenAmount: '',
        estimatedValue: sumInsured ? formatMoney(sumInsured) : '',
      };
    });
  return rows.length ? rows : null;
}

/**
 * Uses `primary` rows, filling blank cells (and raw numeric codes such as a
 * usage code) from the matching `fallback` row. Either side may be missing.
 */
function withFallback(
  primary: VehicleRow[] | null,
  fallback: VehicleRow[] | null,
): VehicleRow[] | null {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return primary.map((row, i) => {
    const other =
      fallback.find(
        (f) => f.registrationNo && f.registrationNo === row.registrationNo,
      ) ?? fallback[i];
    if (!other) return row;
    const merged = { ...row };
    for (const key of Object.keys(row) as (keyof VehicleRow)[]) {
      const weak =
        isBlank(row[key]) || (key === 'coverType' && /^\d+$/.test(row[key]));
      if (weak && !isBlank(other[key])) merged[key] = other[key];
    }
    return merged;
  });
}

/**
 * The user with company-wide record access, used only for printing documents
 * so any member of the company can generate them regardless of their personal
 * branch/department/own-records scope. Tenant isolation is unchanged (the
 * company membership still bounds every query), the endpoint permission
 * (e.g. policies:read) is still enforced, and external users (agents,
 * brokers, customers) keep their creator-only access.
 */
function companyWide(user: AuthenticatedUser): AuthenticatedUser {
  return {
    ...user,
    permissions: Array.from(
      new Set([...(user.permissions ?? []), DataScopePermissions.COMPANY_ALL]),
    ),
    permissionDataScopes: [],
    quotationPolicyDataScope: 'COMPANY',
  };
}
