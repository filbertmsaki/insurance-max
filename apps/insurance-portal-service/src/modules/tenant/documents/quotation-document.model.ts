/**
 * Presentation layer for the customer-facing quotation document.
 *
 * Maps an existing quotation (aggregate + preview mapping + Non-Motor risk
 * details) into ordered, product-aware sections. It only formats and
 * arranges stored values: premiums, taxes and totals come from the quotation
 * as calculated and are never recalculated here. Blank values are dropped so
 * the document never prints null, undefined or placeholder text.
 */
import { SHORT_TERM_RISK_CODE } from '../quotations/approval-policy/quotation-approval-policy';

/* ------------------------------------------------------------------------ */
/* Output model                                                              */
/* ------------------------------------------------------------------------ */

export interface DocField {
  label: string;
  value: string;
}

export type DocAlign = 'left' | 'right' | 'center';

export interface DocColumn {
  header: string;
  /** Relative width; columns are scaled to the content width. */
  width: number;
  align?: DocAlign;
}

export type DocBlock =
  | { kind: 'fields'; fields: DocField[]; columns: 1 | 2 }
  | { kind: 'subheading'; text: string }
  | {
      kind: 'table';
      columns: DocColumn[];
      rows: string[][];
      totals?: string[];
    }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | {
      kind: 'premium';
      currency: string;
      lines: { label: string; amount: string; muted?: boolean }[];
      totalLabel: string;
      total: string;
    };

export interface DocSection {
  title: string;
  blocks: DocBlock[];
  /** Start the section on a fresh page (e.g. a long fleet appendix). */
  pageBreakBefore?: boolean;
}

export type QuotationDocumentKind =
  | 'MOTOR_SINGLE'
  | 'MOTOR_FLEET'
  | 'SHORT_TERM_SINGLE'
  | 'SHORT_TERM_FLEET'
  | 'NON_MOTOR';

export interface QuotationDocument {
  kind: QuotationDocumentKind;
  quotationNo: string;
  issuerName: string;
  issuerLogo: Uint8Array | null;
  /** Letterhead lines: address, contacts, website, regulatory identifiers. */
  issuerLines: string[];
  /** Short contact line for the page footer. */
  issuerFooter: string;
  title: string;
  subtitle: string;
  reference: DocField[];
  sections: DocSection[];
  /** Diagonal stamp (DRAFT, EXPIRED, ...); empty for a live offer. */
  watermark: string;
  generatedAt: string;
}

/* ------------------------------------------------------------------------ */
/* Input                                                                     */
/* ------------------------------------------------------------------------ */

type Rec = Record<string, any>;

export interface NonMotorRiskDetails {
  fields: Rec[];
  schema_snapshot: Rec[];
  risk_data: Record<string, unknown>;
  risk_location: string | null;
  limit_of_liability: number | null;
}

export interface QuotationDocumentSource {
  /** Quotation aggregate (entity) as loaded by the quotations repository. */
  quotation: Rec;
  /** QuotationPreviewMapper output for the same aggregate. */
  preview: Rec;
  nonMotor?: NonMotorRiskDetails | null;
  /** Tax catalogue names keyed by upper-case tax code. */
  taxNames?: Record<string, string>;
  logo?: Uint8Array | null;
  now?: Date;
}

/** Fleets larger than this move the vehicle schedule into an appendix. */
export const FLEET_INLINE_LIMIT = 15;

/** Long approved wording is shortened and referred to the policy document. */
const WORDING_LIMIT = 1600;

/* ------------------------------------------------------------------------ */
/* Builder                                                                   */
/* ------------------------------------------------------------------------ */

export function buildQuotationDocument(
  source: QuotationDocumentSource,
): QuotationDocument {
  const { quotation: q, preview: p } = source;
  const now = source.now ?? new Date();
  const overview: Rec = p.overview ?? {};
  const cover: Rec = p.cover_note ?? {};
  const product: Rec = q.product_definition_snapshot ?? {};
  const insurer: Rec | null = q.insurer_company ?? q.company ?? null;
  const currency = text(cover.currency) || text(product.currencyCode);
  const kind = documentKind(q, p);
  const fleet = kind === 'MOTOR_FLEET' || kind === 'SHORT_TERM_FLEET';
  const shortTerm = kind === 'SHORT_TERM_SINGLE' || kind === 'SHORT_TERM_FLEET';
  const productName =
    text(overview.product?.name) || text(product.productName) || 'Insurance';
  const expiresAt = toDate(q.offer_expires_at);
  const expired = !!expiresAt && expiresAt.getTime() <= now.getTime();

  const ctx: Ctx = {
    q,
    p,
    currency,
    kind,
    fleet,
    shortTerm,
    productName,
    product,
    expiresAt,
    taxNames: source.taxNames ?? {},
  };

  const sections: DocSection[] = [
    policyholderSection(ctx),
    insuranceSection(ctx),
    ...riskSections(ctx, source.nonMotor ?? null),
    coverageSection(ctx),
    premiumSection(ctx),
    termsSection(ctx),
    noticesSection(ctx),
    authorisationSection(ctx),
    ...fleetAppendix(ctx),
  ].filter((section): section is DocSection => !!section);

  return {
    kind,
    quotationNo: text(overview.quotation_no ?? q.quotation_no),
    issuerName: text(insurer?.name),
    issuerLogo: source.logo ?? null,
    issuerLines: letterhead(insurer),
    issuerFooter: compact([
      text(insurer?.name),
      text(insurer?.contact_phone) && `Tel ${text(insurer?.contact_phone)}`,
      text(insurer?.contact_email),
      text(insurer?.website),
    ]).join('  |  '),
    title: 'INSURANCE QUOTATION',
    subtitle: subtitle(kind, productName),
    reference: compactFields([
      ['Quotation No.', overview.quotation_no ?? q.quotation_no],
      ['Quotation Date', formatDate(q.offer_finalized_at ?? q.created_at)],
      [
        'Valid Until',
        expiresAt ? formatDate(new Date(expiresAt.getTime() - 1)) : '',
      ],
      ['Status', expired ? 'Expired' : overview.display_label],
      ['Issuing Office', overview.branch?.name ?? overview.sales_point?.name],
      ['Currency', currency],
    ]),
    sections,
    watermark: watermark(q, overview, expired),
    generatedAt: formatDateTime(now),
  };
}

interface Ctx {
  q: Rec;
  p: Rec;
  currency: string;
  kind: QuotationDocumentKind;
  fleet: boolean;
  shortTerm: boolean;
  productName: string;
  product: Rec;
  expiresAt: Date | null;
  taxNames: Record<string, string>;
}

export function documentKind(q: Rec, p: Rec): QuotationDocumentKind {
  const flow = text(q.quotation_flow ?? p.overview?.quotation_flow);
  if (flow === 'NON_MOTOR') return 'NON_MOTOR';
  const fleet = flow === 'MOTOR_FLEET';
  const codes = allRisks(p).map((risk) => text(risk.risk_code).toUpperCase());
  const shortTerm =
    codes.length > 0 && codes.every((code) => code === SHORT_TERM_RISK_CODE);
  if (shortTerm) return fleet ? 'SHORT_TERM_FLEET' : 'SHORT_TERM_SINGLE';
  return fleet ? 'MOTOR_FLEET' : 'MOTOR_SINGLE';
}

function subtitle(kind: QuotationDocumentKind, productName: string) {
  switch (kind) {
    case 'SHORT_TERM_SINGLE':
      return 'Short-Term (In-Transit) Motor Insurance Quotation';
    case 'SHORT_TERM_FLEET':
      return 'Short-Term (In-Transit) Fleet Motor Insurance Quotation';
    case 'MOTOR_FLEET':
      return `Fleet Motor Insurance Quotation - ${productName}`;
    default:
      return /quotation$/i.test(productName)
        ? productName
        : `${productName} Quotation`;
  }
}

/* ---------------------------- Policyholder ------------------------------ */

function policyholderSection(ctx: Ctx): DocSection | null {
  const holders: Rec[] = ctx.p.policyholders ?? [];
  const customer: Rec = ctx.q.customer ?? {};
  const blocks: DocBlock[] = [];
  holders.forEach((holder, index) => {
    const corporate = /corporate/i.test(text(holder.policyholder_type));
    const fields = compactFields([
      [corporate ? 'Company Name' : 'Full Name', holder.full_name],
      ['Customer Type', holder.policyholder_type],
      [
        'Postal Address',
        compact([
          holder.postal_address && `P.O. Box ${holder.postal_address}`,
        ]).join(''),
      ],
      [
        'Physical Address',
        compact([
          holder.street,
          holder.district,
          holder.region,
          countryName(holder.country),
        ]).join(', '),
      ],
      ['Telephone', holder.phone_number],
      ['Email', holder.email_address],
      [
        text(holder.identification_type) || 'Identification',
        holder.identification_number,
      ],
      // Customer-record identifiers apply to the primary policyholder only.
      ...(index === 0
        ? ([
            ['Customer No.', customer.customer_no],
            [
              'TIN',
              text(holder.identification_type) === 'TIN' ? '' : customer.tin,
            ],
            ['VRN', customer.vrn],
            ['Registration No.', corporate ? customer.registration_no : ''],
          ] as [string, unknown][])
        : []),
    ]);
    if (!fields.length) return;
    if (holders.length > 1) {
      blocks.push({ kind: 'subheading', text: `Policyholder ${index + 1}` });
    }
    blocks.push({ kind: 'fields', fields, columns: 2 });
  });
  return blocks.length ? { title: 'Policyholder Details', blocks } : null;
}

/* ------------------------------ Insurance ------------------------------- */

function insuranceSection(ctx: Ctx): DocSection {
  const { p, q, product } = ctx;
  const overview: Rec = p.overview ?? {};
  const cover: Rec = p.cover_note ?? {};
  const start = toDate(cover.cover_note_start_date ?? q.start_date);
  const end = toDate(cover.cover_note_end_date ?? q.end_date);
  const risks = allRisks(p);
  const coverTypes = unique(
    risks.map((risk) => text(risk.risk_name) || text(risk.cover_class)),
  );
  const motor = ctx.kind !== 'NON_MOTOR';
  const fields = compactFields([
    ['Insurance Class', overview.insurance_category?.name],
    ['Product', ctx.productName],
    ['Sub-Class', overview.subclass?.name],
    ['Type of Cover', ctx.shortTerm ? 'Short-Term (In-Transit) Cover' : ''],
    [ctx.shortTerm ? 'Risk Covered' : 'Type of Cover', coverTypes.join(', ')],
    ['Cover Start Date', formatDateTime(start)],
    ['Cover Expiry Date', formatDateTime(end)],
    ['Period of Insurance', periodLabel(start, end)],
    ['Currency', ctx.currency],
    [
      'Exchange Rate',
      ctx.currency && ctx.currency !== 'TZS' && toNumber(cover.exchange_rate)
        ? `1 ${ctx.currency} = TZS ${formatMoney(toNumber(cover.exchange_rate)!)}`
        : '',
    ],
    [
      'Vehicle Classification',
      motor
        ? unique(motorUnits(p).map((m) => text(m.motor_category))).join(', ')
        : '',
    ],
    [
      'Vehicle Usage',
      motor
        ? unique(motorUnits(p).map((m) => text(m.motor_usage))).join(', ')
        : '',
    ],
  ]);
  const blocks: DocBlock[] = [{ kind: 'fields', fields, columns: 2 }];
  const description =
    text(cover.cover_note_description) || text(product.coverNoteDescription);
  if (description) {
    blocks.push({ kind: 'subheading', text: 'Cover Description' });
    blocks.push({ kind: 'paragraph', text: description });
  }
  return { title: 'Insurance Details', blocks };
}

/* -------------------------------- Risk ---------------------------------- */

function riskSections(
  ctx: Ctx,
  nonMotor: NonMotorRiskDetails | null,
): DocSection[] {
  if (ctx.kind === 'NON_MOTOR') return [nonMotorSection(ctx, nonMotor)];
  if (ctx.fleet) return [fleetSection(ctx)];
  return [vehicleSection(ctx)];
}

function vehicleFields(m: Rec, risks: Rec[], currency: string) {
  const sumInsured = sum(risks.map((risk) => risk.sum_insured));
  const unregistered = /unregistered/i.test(text(m.motor_type));
  return compactFields([
    [
      'Registration No.',
      text(m.registration_number) ||
        (unregistered ? 'Unregistered (in transit)' : ''),
    ],
    ['Make', m.make],
    ['Model', compact([m.model, m.model_number]).join(' ')],
    ['Year of Manufacture', m.year_of_manufacture],
    ['Vehicle Category', m.motor_category],
    ['Body Type', m.body_type],
    ['Chassis No.', m.chassis_number],
    ['Engine No.', m.engine_number],
    ['Engine Capacity', m.engine_capacity ? `${m.engine_capacity} cc` : ''],
    ['Fuel', m.fuel_used],
    ['Seating Capacity', m.seating_capacity],
    ['Colour', m.colour],
    [
      'Tare Weight',
      positive(m.tare_weight) ? `${formatInt(m.tare_weight)} kg` : '',
    ],
    [
      'Gross Vehicle Weight',
      positive(m.gross_weight) ? `${formatInt(m.gross_weight)} kg` : '',
    ],
    ['Number of Axles', positive(m.number_of_axles) ? m.number_of_axles : ''],
    ['Vehicle Usage', m.motor_usage],
    ['Registered Owner', m.owner_name],
    [
      'Type of Cover',
      unique(
        risks.map((risk) => text(risk.risk_name) || text(risk.cover_class)),
      ).join(', '),
    ],
    ['Sum Insured', sumInsured ? money(currency, sumInsured) : ''],
  ]);
}

function vehicleSection(ctx: Ctx): DocSection {
  const m: Rec = ctx.p.motor_details ?? {};
  const fields = vehicleFields(m, ctx.p.risks ?? [], ctx.currency);
  return {
    title: 'Vehicle Details',
    blocks: fields.length
      ? [{ kind: 'fields', fields, columns: 2 }]
      : [
          {
            kind: 'paragraph',
            text: 'Vehicle particulars are not recorded on this quotation.',
          },
        ],
  };
}

function fleetVehicles(ctx: Ctx): Rec[] {
  return ctx.p.fleet?.vehicles ?? [];
}

/** Premium per vehicle before taxes: risks after discount plus add-ons. */
function vehiclePremium(vehicle: Rec) {
  return roundMoney(
    sum((vehicle.risks ?? []).map((risk: Rec) => risk.premium_after_discount)) +
      sum(
        visibleAddons(vehicle.addons ?? [], {}).map(
          (a) => a.premium_excluding_tax,
        ),
      ),
  );
}

function fleetSection(ctx: Ctx): DocSection {
  const vehicles = fleetVehicles(ctx);
  const summary: Rec = ctx.p.fleet?.summary ?? {};
  const cover: Rec = ctx.p.cover_note ?? {};
  const start = toDate(cover.cover_note_start_date);
  const end = toDate(cover.cover_note_end_date);
  const coverTypes = unique(
    vehicles.flatMap((v) =>
      (v.risks ?? []).map((r: Rec) => text(r.risk_name) || text(r.cover_class)),
    ),
  );
  const fields = compactFields([
    ['Number of Vehicles', String(vehicles.length)],
    ['Type of Cover', coverTypes.join(', ')],
    [
      'Period of Insurance',
      compact([
        periodLabel(start, end),
        start && end ? `${formatDate(start)} to ${formatDate(end)}` : '',
      ]).join(' - '),
    ],
    ['Fleet Type', ctx.p.fleet?.header?.fleet_type_label],
    [
      'Total Fleet Sum Insured',
      money(ctx.currency, toNumber(summary.total_fleet_sum_insured) ?? 0),
    ],
    [
      'Total Fleet Premium',
      money(ctx.currency, toNumber(cover.total_premium_including_tax) ?? 0),
    ],
  ]);
  const blocks: DocBlock[] = [{ kind: 'fields', fields, columns: 2 }];
  if (vehicles.length <= FLEET_INLINE_LIMIT) {
    blocks.push({ kind: 'subheading', text: 'Vehicle Schedule' });
    blocks.push(fleetTable(ctx));
  } else {
    blocks.push({
      kind: 'paragraph',
      text: `The schedule of all ${vehicles.length} insured vehicles is set out in Appendix A.`,
    });
  }
  return { title: 'Fleet Summary', blocks };
}

function fleetTable(ctx: Ctx): DocBlock {
  const vehicles = fleetVehicles(ctx);
  const rows = vehicles.map((vehicle, index) => {
    const m: Rec = vehicle.motor_details ?? {};
    const risks: Rec[] = vehicle.risks ?? [];
    return [
      String(index + 1),
      text(m.registration_number) ||
        (text(m.chassis_number)
          ? `Chassis ${text(m.chassis_number)}`
          : 'Unregistered'),
      compact([m.make, m.model, m.body_type]).join(' / '),
      text(m.year_of_manufacture),
      compact([
        unique(risks.map((r) => text(r.risk_name) || text(r.cover_class))).join(
          ', ',
        ),
        text(m.motor_usage),
      ]).join(' - '),
      formatMoney(sum(risks.map((r) => r.sum_insured))),
      formatMoney(vehiclePremium(vehicle)),
    ];
  });
  return {
    kind: 'table',
    columns: [
      { header: 'SN', width: 4 },
      { header: 'Registration', width: 12 },
      { header: 'Make / Model', width: 20 },
      { header: 'Year', width: 6, align: 'center' },
      { header: 'Cover', width: 22 },
      { header: `Sum Insured (${ctx.currency})`, width: 16, align: 'right' },
      {
        header: `Premium excl. Tax (${ctx.currency})`,
        width: 16,
        align: 'right',
      },
    ],
    rows,
    totals: [
      '',
      `Total (${vehicles.length})`,
      '',
      '',
      '',
      formatMoney(
        sum(
          vehicles.flatMap((v) =>
            (v.risks ?? []).map((r: Rec) => r.sum_insured),
          ),
        ),
      ),
      formatMoney(roundMoney(sum(vehicles.map(vehiclePremium)))),
    ],
  };
}

function fleetAppendix(ctx: Ctx): DocSection[] {
  if (!ctx.fleet || fleetVehicles(ctx).length <= FLEET_INLINE_LIMIT) return [];
  return [
    {
      title: 'Appendix A - Fleet Vehicle Schedule',
      pageBreakBefore: true,
      blocks: [fleetTable(ctx)],
    },
  ];
}

function nonMotorSection(
  ctx: Ctx,
  details: NonMotorRiskDetails | null,
): DocSection {
  const blocks: DocBlock[] = [];
  const fields: DocField[] = [];
  if (details) {
    const schema = details.schema_snapshot?.length
      ? details.schema_snapshot
      : details.fields;
    const ordered = [...schema].sort(
      (a, b) => (toNumber(a.sort_order) ?? 0) - (toNumber(b.sort_order) ?? 0),
    );
    for (const field of ordered) {
      const value = riskValue(
        field,
        details.risk_data?.[field.field_key],
        ctx.currency,
      );
      if (value) fields.push({ label: text(field.label), value });
    }
    if (text(details.risk_location)) {
      fields.unshift({
        label: 'Risk Location',
        value: text(details.risk_location),
      });
    }
    if (positive(details.limit_of_liability)) {
      fields.push({
        label: 'Limit of Liability',
        value: money(ctx.currency, toNumber(details.limit_of_liability)!),
      });
    }
  }
  if (fields.length) blocks.push({ kind: 'fields', fields, columns: 2 });

  const subjects: Rec[] = ctx.p.subject_matters ?? [];
  const subjectRows = subjects
    .map((s) => [
      text(s.subject_matter_reference),
      text(s.subject_matter_description),
    ])
    .filter(([ref, desc]) => ref || desc);
  if (subjectRows.length) {
    blocks.push({ kind: 'subheading', text: 'Subject Matter Insured' });
    blocks.push({
      kind: 'table',
      columns: [
        { header: 'Reference', width: 22 },
        { header: 'Description', width: 78 },
      ],
      rows: subjectRows,
    });
  }

  const risks: Rec[] = ctx.p.risks ?? [];
  if (risks.length) {
    blocks.push({ kind: 'subheading', text: 'Insured Items' });
    blocks.push({
      kind: 'table',
      columns: [
        { header: 'SN', width: 6 },
        { header: 'Item / Risk', width: 64 },
        { header: `Sum Insured (${ctx.currency})`, width: 30, align: 'right' },
      ],
      rows: risks.map((risk, i) => [
        String(i + 1),
        text(risk.risk_name) || text(risk.cover_class) || `Risk ${i + 1}`,
        formatMoney(toNumber(risk.sum_insured) ?? 0),
      ]),
      totals:
        risks.length > 1
          ? [
              '',
              'Total Sum Insured',
              formatMoney(sum(risks.map((r) => r.sum_insured))),
            ]
          : undefined,
    });
  }

  if (!blocks.length) {
    blocks.push({
      kind: 'paragraph',
      text: 'Risk particulars are recorded in the proposal accompanying this quotation.',
    });
  }
  return { title: 'Risk Details', blocks };
}

function riskValue(field: Rec, raw: unknown, currency: string): string {
  if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length))
    return '';
  const options: Rec[] = field.options ?? [];
  const optionLabel = (value: unknown) =>
    text(options.find((o) => String(o.value) === String(value))?.label) ||
    text(value);
  switch (field.data_type) {
    case 'BOOLEAN':
      return raw === true || raw === 'true' ? 'Yes' : 'No';
    case 'SELECT':
      return optionLabel(raw);
    case 'MULTI_SELECT':
      return (Array.isArray(raw) ? raw : [raw]).map(optionLabel).join(', ');
    case 'CURRENCY': {
      const n = toNumber(raw);
      return n == null ? text(raw) : money(currency, n);
    }
    case 'DECIMAL':
    case 'NUMBER': {
      const n = toNumber(raw);
      return n == null
        ? text(raw)
        : n.toLocaleString('en-US', { maximumFractionDigits: 4 });
    }
    case 'DATE':
      return formatDate(raw);
    default:
      return text(raw);
  }
}

/* ------------------------------ Coverage -------------------------------- */

/**
 * Add-ons to print. An add-on whose final rate and premium are both zero was
 * removed from the quotation, so it is hidden, unless the product defines it
 * as a mandatory (non-optional) standard benefit.
 */
export function visibleAddons(addons: Rec[], product: Rec): Rec[] {
  const standard = new Set<string>(
    ((product.addons ?? []) as Rec[])
      .filter((addon) => addon.isOptional === false)
      .flatMap((addon) => [text(addon.code), text(addon.tiraAddonCode)])
      .filter(Boolean)
      .map((code) => code.toUpperCase()),
  );
  return addons.filter((addon) => {
    const zero =
      !nonZero(addon.premium_excluding_tax) &&
      !nonZero(addon.premium_including_tax) &&
      !nonZero(addon.premium_rate);
    return !zero || standard.has(text(addon.addon_reference).toUpperCase());
  });
}

function coverageSection(ctx: Ctx): DocSection | null {
  const { p, product, currency } = ctx;
  const blocks: DocBlock[] = [];
  const rows: string[][] = [];

  if (!ctx.fleet) {
    for (const risk of (p.risks ?? []) as Rec[]) {
      rows.push([
        text(risk.risk_name) || text(risk.cover_class) || 'Main cover',
        'Main cover',
        positive(risk.sum_insured)
          ? formatMoney(toNumber(risk.sum_insured)!)
          : '',
        formatMoney(toNumber(risk.premium_before_discount) ?? 0),
      ]);
    }
    for (const addon of visibleAddons(p.addons ?? [], product)) {
      rows.push([
        text(addon.addon_description) ||
          text(addon.addon_reference) ||
          'Additional cover',
        'Extension',
        positive(addon.insured_amount)
          ? formatMoney(toNumber(addon.insured_amount)!)
          : '',
        nonZero(addon.premium_excluding_tax)
          ? formatMoney(toNumber(addon.premium_excluding_tax)!)
          : 'Included',
      ]);
    }
  } else {
    // Fleet: list each extension once with the number of vehicles it covers.
    const extensions = new Map<string, { count: number; premium: number }>();
    for (const vehicle of fleetVehicles(ctx)) {
      for (const addon of visibleAddons(vehicle.addons ?? [], product)) {
        const name =
          text(addon.addon_description) || text(addon.addon_reference);
        if (!name) continue;
        const entry = extensions.get(name) ?? { count: 0, premium: 0 };
        entry.count += 1;
        entry.premium += toNumber(addon.premium_excluding_tax) ?? 0;
        extensions.set(name, entry);
      }
    }
    for (const [name, entry] of extensions) {
      rows.push([
        name,
        `Extension (${entry.count} vehicle${entry.count === 1 ? '' : 's'})`,
        '',
        entry.premium ? formatMoney(roundMoney(entry.premium)) : 'Included',
      ]);
    }
  }

  if (rows.length) {
    blocks.push({
      kind: 'table',
      columns: [
        { header: 'Cover', width: 44 },
        { header: 'Type', width: 18 },
        {
          header: `Sum Insured / Limit (${currency})`,
          width: 20,
          align: 'right',
        },
        { header: `Premium (${currency})`, width: 18, align: 'right' },
      ],
      rows,
    });
  }

  const items: Rec[] = product.definitionItems ?? [];
  const benefits = items
    .filter(
      (item) => item.itemType === 'COVERAGE' || item.itemType === 'BENEFIT',
    )
    .sort(bySortOrder)
    .map(itemText)
    .filter(Boolean);
  if (benefits.length) {
    blocks.push({ kind: 'subheading', text: 'Scope of Cover and Benefits' });
    blocks.push({ kind: 'bullets', items: benefits });
  }
  return blocks.length ? { title: 'Coverage and Extensions', blocks } : null;
}

/* ------------------------------- Premium -------------------------------- */

/**
 * Premium lines from the stored calculation. Component lines are shown only
 * when they reconcile with the stored totals; the final line is always the
 * quotation's stored total including tax.
 */
export function premiumBlock(
  p: Rec,
  product: Rec,
  currency: string,
  taxNames: Record<string, string> = {},
): DocBlock {
  const cover: Rec = p.cover_note ?? {};
  const fleet = !!p.fleet?.vehicles?.length;
  const risks: Rec[] = fleet
    ? p.fleet.vehicles.flatMap((v: Rec) => v.risks ?? [])
    : (p.risks ?? []);
  const addons: Rec[] = fleet
    ? p.fleet.vehicles.flatMap((v: Rec) =>
        visibleAddons(v.addons ?? [], product),
      )
    : visibleAddons(p.addons ?? [], product);

  const total = toNumber(cover.total_premium_including_tax) ?? 0;
  const net =
    toNumber(cover.total_premium_excluding_tax) ??
    toNumber(p.premium_summary?.total_premium_excluding_tax) ??
    0;

  const basic = sum(risks.map((r) => r.premium_before_discount));
  const discounts = new Map<string, number>();
  for (const risk of risks) {
    for (const d of (risk.discounts ?? []) as Rec[]) {
      const label = text(d.discount_label) || 'Discount';
      discounts.set(
        label,
        (discounts.get(label) ?? 0) + (toNumber(d.discount_amount) ?? 0),
      );
    }
  }
  const addonPremium = sum(addons.map((a) => a.premium_excluding_tax));
  const discountTotal = sum([...discounts.values()]);

  const lines: { label: string; amount: string; muted?: boolean }[] = [];
  const componentsReconcile =
    Math.abs(basic - discountTotal + addonPremium - net) < 0.01;
  if (componentsReconcile && (discountTotal || addonPremium)) {
    lines.push({ label: 'Basic Premium', amount: formatMoney(basic) });
    for (const [label, amount] of discounts) {
      if (Math.abs(amount) >= 0.005) {
        lines.push({
          label: `Less: ${label}`,
          amount: `(${formatMoney(Math.abs(amount))})`,
        });
      }
    }
    if (addonPremium) {
      lines.push({
        label: 'Additional Covers',
        amount: formatMoney(addonPremium),
      });
    }
  }
  lines.push({
    label: 'Net Premium (excluding taxes)',
    amount: formatMoney(net),
  });

  // Taxes exactly as stored on each risk and add-on, grouped by tax code and
  // rate, named from the tax catalogue with the stored rate.
  const taxes = new Map<
    string,
    { label: string; amount: number; exempt: boolean }
  >();
  for (const item of [...risks, ...addons]) {
    for (const tax of (item.taxes ?? []) as Rec[]) {
      const code = text(tax.tax_code).toUpperCase();
      const exempt = tax.is_tax_exempted === true || tax.is_tax_exempted === 'Y';
      const rate = toNumber(tax.tax_rate);
      const key = `${code}|${rate ?? ''}|${exempt}`;
      const entry = taxes.get(key) ?? {
        label: taxLabel(code, rate, taxNames, text(tax.tax_name)),
        amount: 0,
        exempt,
      };
      entry.amount += exempt ? 0 : (toNumber(tax.tax_amount) ?? 0);
      taxes.set(key, entry);
    }
  }
  let taxTotal = 0;
  for (const tax of taxes.values()) {
    if (tax.exempt) {
      lines.push({ label: `${tax.label} - Exempted`, amount: 'Exempt' });
      continue;
    }
    const amount = roundMoney(tax.amount);
    taxTotal += amount;
    lines.push({ label: tax.label, amount: formatMoney(amount) });
  }
  // The total payable is the stored total; show any cent-level difference
  // between it and net premium plus stored taxes instead of hiding it.
  const remainder = roundMoney(total - net - taxTotal);
  if (Math.abs(remainder) >= 0.005) {
    lines.push({
      label: 'Rounding Adjustment',
      amount: formatMoney(remainder),
      muted: true,
    });
  }

  return {
    kind: 'premium',
    currency,
    lines,
    totalLabel: 'TOTAL PREMIUM PAYABLE',
    total: money(currency, total),
  };
}

/** Catalogue name (else preview name, else code) with the stored rate. */
function taxLabel(
  code: string,
  rate: number | null,
  names: Record<string, string>,
  fallback: string,
) {
  const name = text(names[code]) || fallback || code || 'Tax';
  if (rate == null || rate <= 0) return name;
  // Rates are stored as fractions (0.18); tolerate percentages (18).
  const percent = rate <= 1 ? rate * 100 : rate;
  const shown = Number(percent.toFixed(4)).toString();
  return name.includes('%') ? name : `${name} (${shown}%)`;
}

function premiumSection(ctx: Ctx): DocSection {
  return {
    title: 'Premium Summary',
    blocks: [premiumBlock(ctx.p, ctx.product, ctx.currency, ctx.taxNames)],
  };
}

/* ------------------------------- Terms ---------------------------------- */

function termsSection(ctx: Ctx): DocSection | null {
  const { p, product } = ctx;
  const blocks: DocBlock[] = [];
  const items: Rec[] = product.definitionItems ?? [];
  const add = (
    heading: string,
    paragraphs: string[],
    bullets: string[] = [],
  ) => {
    const body = paragraphs.map(text).filter(Boolean);
    if (!body.length && !bullets.length) return;
    blocks.push({ kind: 'subheading', text: heading });
    for (const para of body)
      blocks.push({ kind: 'paragraph', text: shorten(para, ctx) });
    if (bullets.length) blocks.push({ kind: 'bullets', items: bullets });
  };
  const ofType = (type: string) =>
    items
      .filter((i) => i.itemType === type)
      .sort(bySortOrder)
      .map(itemText)
      .filter(Boolean);

  add('Operative Clause', [
    text(p.cover_note?.operative_clause) || text(product.operativeClause),
  ]);
  add('Special Conditions', [product.specialConditions], ofType('CONDITION'));
  add('Warranties', [], ofType('WARRANTY'));
  add('Principal Exclusions', [product.exclusions], ofType('EXCLUSION'));
  if (!blocks.length) return null;
  blocks.push({
    kind: 'paragraph',
    text: `The above is a summary. Cover is subject to the full terms, conditions, exclusions and warranties of the ${ctx.productName} policy wording, available on request.`,
  });
  return { title: 'Terms, Conditions and Exclusions', blocks };
}

function shorten(value: string, ctx: Ctx) {
  if (value.length <= WORDING_LIMIT) return value;
  const cut = value.slice(0, WORDING_LIMIT);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return `${cut.slice(0, stop > WORDING_LIMIT * 0.6 ? stop + 1 : WORDING_LIMIT).trim()} ... (continued in the ${ctx.productName} policy wording)`;
}

/* ------------------------------ Notices --------------------------------- */

function noticesSection(ctx: Ctx): DocSection {
  const validity = ctx.expiresAt
    ? `This quotation is valid until ${formatDateTime(new Date(ctx.expiresAt.getTime() - 1))}. After that date it lapses and the terms may be revised.`
    : 'Please confirm the validity of this quotation with us before acceptance; terms may be revised if it is not accepted promptly.';
  return {
    title: 'Important Notices',
    blocks: [
      {
        kind: 'bullets',
        items: [
          'This quotation is an offer of insurance subject to the terms, conditions, exclusions and warranties of the applicable policy wording.',
          validity,
          'This quotation is not a policy, cover note or certificate of insurance. Cover is not in force merely because this quotation has been issued.',
          'Policy issuance and commencement of cover are subject to acceptance of the risk by the insurer, receipt of the premium payable and all applicable regulatory requirements.',
          'Please check all details carefully and notify us of any errors. All material facts must be disclosed; non-disclosure or misrepresentation may affect cover.',
        ],
      },
    ],
  };
}

function authorisationSection(ctx: Ctx): DocSection | null {
  const overview: Rec = ctx.p.overview ?? {};
  const approval = text(overview.approval_status ?? ctx.q.approval_status);
  const fields: DocField[] = [];
  if (approval === 'APPROVED') {
    fields.push(
      ...compactFields([
        [
          'Approved By',
          overview.approved_by?.name ?? overview.approved_by?.full_name,
        ],
        ['Approval Date', formatDate(overview.approval_decided_at)],
      ]),
    );
  }
  fields.push(
    ...compactFields([
      [
        'Prepared By',
        overview.created_by?.name ?? overview.created_by?.full_name,
      ],
    ]),
  );
  const pending = ['PENDING', 'NOT_SUBMITTED', 'CHANGES_REQUESTED'].includes(
    approval,
  );
  const blocks: DocBlock[] = [];
  if (fields.length) blocks.push({ kind: 'fields', fields, columns: 2 });
  if (pending) {
    blocks.push({
      kind: 'paragraph',
      text: 'This quotation is subject to underwriting approval and is not yet authorised.',
    });
  }
  return blocks.length ? { title: 'Authorisation', blocks } : null;
}

/* ------------------------------ Helpers --------------------------------- */

function watermark(q: Rec, overview: Rec, expired: boolean) {
  const display = text(overview.display_status).toUpperCase();
  const status = text(q.status ?? overview.quotation_status).toUpperCase();
  const approval = text(
    overview.approval_status ?? q.approval_status,
  ).toUpperCase();
  if (display === 'CANCELLED' || status === 'CANCELLED') return 'CANCELLED';
  if (approval === 'REJECTED' || display === 'APPROVAL_REJECTED')
    return 'NOT VALID';
  if (expired || display === 'EXPIRED') return 'EXPIRED';
  if (display === 'DRAFT' || status === 'DRAFT') return 'DRAFT';
  return '';
}

function letterhead(company: Rec | null): string[] {
  if (!company) return [];
  const a: Rec = company.address ?? {};
  return compact([
    compact([a.street, a.city, a.region]).join(', '),
    compact([a.postal_code && `P.O. Box ${a.postal_code}`, a.country]).join(
      ', ',
    ),
    compact([
      company.contact_phone && `Tel: ${company.contact_phone}`,
      company.contact_email && `Email: ${company.contact_email}`,
    ]).join('   '),
    text(company.website),
    compact([
      company.tin && `TIN: ${company.tin}`,
      company.tira_license_number &&
        `TIRA Licence No: ${company.tira_license_number}`,
      company.brela_registration_number &&
        `Reg. No: ${company.brela_registration_number}`,
    ]).join('   '),
  ]);
}

function allRisks(p: Rec): Rec[] {
  const vehicles: Rec[] = p.fleet?.vehicles ?? [];
  return vehicles.length
    ? vehicles.flatMap((v) => v.risks ?? [])
    : (p.risks ?? []);
}

function motorUnits(p: Rec): Rec[] {
  const vehicles: Rec[] = p.fleet?.vehicles ?? [];
  return (
    vehicles.length ? vehicles.map((v) => v.motor_details) : [p.motor_details]
  ).filter(Boolean);
}

function itemText(item: Rec) {
  const title = text(item.title);
  const description = text(item.description);
  if (title && description && description !== title)
    return `${title}: ${description}`;
  return title || description;
}

function bySortOrder(a: Rec, b: Rec) {
  return (toNumber(a.sortOrder) ?? 0) - (toNumber(b.sortOrder) ?? 0);
}

function countryName(code: unknown) {
  const value = text(code).toUpperCase();
  if (value === 'TZA' || value === 'TZ') return 'Tanzania';
  return text(code);
}

export function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return formatDate(value);
  const s = String(value).trim();
  return /^(null|undefined|nan)$/i.test(s) ? '' : s;
}

function compact(values: unknown[]): string[] {
  return values.map(text).filter(Boolean);
}

function compactFields(pairs: [string, unknown][]): DocField[] {
  return pairs
    .map(([label, value]) => ({ label, value: text(value) }))
    .filter((field) => field.value);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown) {
  return (toNumber(value) ?? 0) > 0;
}

function nonZero(value: unknown) {
  return Math.abs(toNumber(value) ?? 0) >= 0.005;
}

function sum(values: unknown[]) {
  return roundMoney(
    values.reduce<number>((acc, v) => acc + (toNumber(v) ?? 0), 0),
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number) {
  return (Object.is(roundMoney(value), -0) ? 0 : value).toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

function formatInt(value: unknown) {
  return (toNumber(value) ?? 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
}

function money(currency: string, value: number) {
  return compact([currency, formatMoney(value)]).join(' ');
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tanzanian documents print dates as dd/mm/yyyy in East Africa Time. */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function eat(date: Date) {
  return new Date(date.getTime() + EAT_OFFSET_MS);
}

export function formatDate(value: unknown) {
  const date = toDate(value);
  if (!date) return '';
  // Plain dates (yyyy-mm-dd) are calendar dates; print them as stored.
  const d =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? date
      : eat(date);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatDateTime(value: unknown) {
  const date = toDate(value);
  if (!date) return '';
  const d = eat(date);
  return `${formatDate(date)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function periodLabel(start: Date | null, end: Date | null) {
  if (!start || !end || end <= start) return '';
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.round((end.getTime() - start.getTime()) / 3_600_000);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
