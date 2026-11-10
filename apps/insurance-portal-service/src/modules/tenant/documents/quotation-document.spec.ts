import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import {
  FLEET_INLINE_LIMIT,
  QuotationDocument,
  QuotationDocumentSource,
  buildQuotationDocument,
  documentKind,
  premiumBlock,
  visibleAddons,
} from './quotation-document.model';
import { renderQuotationDocument } from './quotation-document.renderer';

type Rec = Record<string, any>;
const NOW = new Date('2026-11-09T08:00:00Z');

const insurer = {
  name: 'Alliance Insurance Corporation Limited',
  address: {
    street: 'Alliance House, Ali Hassan Mwinyi Road',
    city: 'Dar es Salaam',
    region: 'Kinondoni',
    postal_code: '9942',
    country: 'Tanzania',
  },
  contact_phone: '+255 22 210 3600',
  contact_email: 'info@alliance.co.tz',
  website: 'www.alliance.co.tz',
  tin: '100-123-456',
  tira_license_number: 'TIRA/INS/012',
  logo_url: null,
};

const product = (name: string, extra: Rec = {}) => ({
  productName: name,
  currencyCode: 'TZS',
  operativeClause:
    'Subject to the terms, conditions and exclusions of the policy, the insurer will indemnify the insured against loss or damage as described.',
  specialConditions:
    'The insured shall take all reasonable precautions to prevent loss.',
  exclusions: 'Wear and tear, mechanical breakdown, and consequential loss.',
  definitionItems: [
    {
      itemType: 'COVERAGE',
      title: 'Accidental damage',
      description: 'Loss or damage by accidental external means',
      sortOrder: 1,
    },
    {
      itemType: 'WARRANTY',
      title: 'Anti-theft device fitted',
      description: '',
      sortOrder: 1,
    },
  ],
  addons: [{ code: 'WS', tiraAddonCode: 'WS', isOptional: false }],
  ...extra,
});

const holder = {
  policyholder_type: 'Individual',
  full_name: 'Neema Joseph Mwakyusa',
  identification_type: 'National ID',
  identification_number: '19850101-11111-00001-23',
  country: 'TZA',
  region: 'Dar es Salaam',
  district: 'Ilala',
  street: 'Samora Avenue',
  phone_number: '255754000111',
  postal_address: '1234',
  email_address: 'neema@example.co.tz',
  fax_number: null,
};

const tax = (amount: number) => ({
  tax_code: 'VAT-MAINLAND',
  tax_name: 'VAT',
  tax_rate: 0.18,
  tax_amount: amount,
  is_tax_exempted: false,
});

const risk = (
  code: string,
  name: string,
  si: number,
  premium: number,
  discount = 0,
) => ({
  risk_code: code,
  risk_name: name,
  cover_class: name,
  sum_insured: si,
  premium_before_discount: premium,
  premium_after_discount: premium - discount,
  premium_including_tax: (premium - discount) * 1.18,
  discounts: discount
    ? [
        {
          discount_type: 'NCD',
          discount_label: 'No Claim Discount',
          discount_amount: discount,
        },
      ]
    : [],
  taxes: [tax((premium - discount) * 0.18)],
});

const motor = (
  reg: string,
  make: string,
  model: string,
  year: number,
  extra: Rec = {},
) => ({
  motor_category: 'Private',
  motor_type: 'Registered',
  registration_number: reg,
  chassis_number: `JTMBK${reg.replace(/\s/g, '')}12345`,
  make,
  model,
  model_number: null,
  body_type: 'Station Wagon',
  colour: 'White',
  engine_number: '2GD-1234567',
  engine_capacity: 2755,
  fuel_used: 'Diesel',
  number_of_axles: 2,
  seating_capacity: 7,
  year_of_manufacture: year,
  tare_weight: 2100,
  gross_weight: 2800,
  motor_usage: 'Private',
  owner_name: 'Neema Joseph Mwakyusa',
  ...extra,
});

function overview(
  no: string,
  flow: string,
  productName: string,
  extra: Rec = {},
) {
  return {
    quotation_no: no,
    quotation_flow: flow,
    display_status: 'AWAITING_PAYMENT',
    display_label: 'Awaiting Payment',
    approval_status: 'APPROVED',
    product: { name: productName },
    insurance_category: { name: flow === 'NON_MOTOR' ? 'Fire' : 'Motor' },
    subclass: {
      name: flow === 'NON_MOTOR' ? 'Fire Industrial' : 'Private Vehicles',
    },
    branch: { name: 'Head Office - Dar es Salaam' },
    approved_by: { name: 'Grace Underwriter' },
    approval_decided_at: '2026-11-08T09:00:00Z',
    created_by: { name: 'John Agent' },
    ...extra,
  };
}

function coverNote(start: string, end: string, excl: number, incl: number) {
  return {
    cover_note_start_date: start,
    cover_note_end_date: end,
    currency: 'TZS',
    exchange_rate: 1,
    cover_note_description:
      'Insurance of the vehicle(s) described in this quotation.',
    total_premium_excluding_tax: excl,
    total_premium_including_tax: incl,
  };
}

function singleMotor(): QuotationDocumentSource {
  const r = risk(
    'SP014001000001',
    'Motor Private Comprehensive',
    45_000_000,
    1_575_000,
    157_500,
  );
  const addons = [
    {
      addon_reference: 'PA',
      addon_description: 'Personal Accident - Driver',
      insured_amount: 5_000_000,
      premium_rate: 0.5,
      premium_excluding_tax: 25_000,
      premium_including_tax: 29_500,
      taxes: [tax(4_500)],
    },
    // Removed add-on: final rate and premium are zero -> must not print.
    {
      addon_reference: 'RSA',
      addon_description: 'Roadside Assistance',
      insured_amount: 0,
      premium_rate: 0,
      premium_excluding_tax: 0,
      premium_including_tax: 0,
      taxes: [],
    },
    // Standard (non-optional) benefit at zero premium -> printed as Included.
    {
      addon_reference: 'WS',
      addon_description: 'Windscreen Cover',
      insured_amount: 1_000_000,
      premium_rate: 0,
      premium_excluding_tax: 0,
      premium_including_tax: 0,
      taxes: [],
    },
  ];
  const excl = 1_575_000 - 157_500 + 25_000;
  return {
    now: NOW,
    quotation: {
      quotation_no: 'QT-2026-000481',
      quotation_flow: 'MOTOR_SINGLE',
      status: 'COMPLETED',
      created_at: '2026-11-07T07:00:00Z',
      offer_finalized_at: '2026-11-08T09:00:00Z',
      offer_expires_at: '2026-12-08T21:00:00Z',
      insurer_company: insurer,
      customer: { customer_no: 'CUS-000912', tin: '123-456-789' },
      product_definition_snapshot: product('Motor Private Insurance'),
    },
    preview: {
      overview: overview(
        'QT-2026-000481',
        'MOTOR_SINGLE',
        'Motor Private Insurance',
      ),
      cover_note: coverNote(
        '2026-11-10T00:00:00+03:00',
        '2027-11-09T23:59:59+03:00',
        excl,
        excl * 1.18,
      ),
      policyholders: [holder],
      risks: [r],
      addons,
      subject_matters: [],
      motor_details: motor('T 123 ABC', 'Toyota', 'Land Cruiser Prado', 2021),
      fleet: null,
    },
  };
}

function fleet(count: number, shortTerm = false): QuotationDocumentSource {
  const makes = [
    ['Toyota', 'Hilux Double Cab'],
    ['Isuzu', 'NQR 4.5 Tonne Truck'],
    ['Nissan', 'Patrol'],
    ['Mitsubishi', 'Fuso Fighter'],
  ];
  const vehicles = Array.from({ length: count }, (_, i) => {
    const [make, model] = makes[i % makes.length];
    const si = shortTerm ? 30_000_000 : 40_000_000 + i * 2_500_000;
    const premium = shortTerm ? 60_000 : Math.round(si * 0.035);
    return {
      risks: [
        risk(
          shortTerm ? 'SP014001000007' : 'SP014001000002',
          shortTerm
            ? 'Private Vehicle - In Transit'
            : 'Motor Commercial Comprehensive',
          si,
          premium,
        ),
      ],
      addons: [],
      subject_matters: [],
      motor_details: motor(
        shortTerm ? '' : `T ${100 + i} D${String.fromCharCode(65 + (i % 26))}K`,
        make,
        model,
        2018 + (i % 7),
        shortTerm
          ? {
              motor_type: 'Unregistered',
              chassis_number: `MR0FB8CD${String(i).padStart(9, '0')}`,
            }
          : { motor_category: 'Commercial', motor_usage: 'Commercial' },
      ),
    };
  });
  const excl = vehicles.reduce(
    (s, v) => s + v.risks[0].premium_after_discount,
    0,
  );
  const totalSi = vehicles.reduce((s, v) => s + v.risks[0].sum_insured, 0);
  const no = shortTerm ? 'QT-2026-000502' : 'QT-2026-000499';
  const name = shortTerm
    ? 'Motor Private Insurance'
    : 'Motor Commercial Insurance';
  return {
    now: NOW,
    quotation: {
      quotation_no: no,
      quotation_flow: 'MOTOR_FLEET',
      status: 'COMPLETED',
      created_at: '2026-11-08T07:00:00Z',
      offer_expires_at: '2026-11-23T21:00:00Z',
      insurer_company: insurer,
      customer: {
        customer_no: 'CUS-000144',
        tin: '104-555-321',
        registration_no: '98765',
      },
      product_definition_snapshot: product(name),
    },
    preview: {
      overview: overview(no, 'MOTOR_FLEET', name),
      cover_note: shortTerm
        ? coverNote(
            '2026-11-10T08:00:00+03:00',
            '2026-11-24T08:00:00+03:00',
            excl,
            excl * 1.18,
          )
        : coverNote(
            '2026-11-10T00:00:00+03:00',
            '2027-11-09T23:59:59+03:00',
            excl,
            excl * 1.18,
          ),
      policyholders: [
        {
          ...holder,
          policyholder_type: 'Corporate',
          full_name: 'Kilimanjaro Logistics and Distribution Company Limited',
          identification_type: 'TIN',
          identification_number: '104-555-321',
          email_address: 'fleet@kilimanjarologistics.co.tz',
        },
      ],
      risks: [],
      addons: [],
      subject_matters: [],
      motor_details: null,
      fleet: {
        header: { fleet_type_label: 'Mixed fleet' },
        summary: { total_fleet_sum_insured: totalSi },
        vehicles,
      },
    },
  };
}

function nonMotor(): QuotationDocumentSource {
  const risks = [
    risk('FI001', 'Buildings', 850_000_000, 1_275_000),
    risk('FI002', 'Plant and Machinery', 420_000_000, 630_000),
    risk('FI003', 'Stock in Trade', 300_000_000, 450_000),
  ];
  const addons = [
    {
      addon_reference: 'EQ',
      addon_description: 'Earthquake Extension',
      insured_amount: 0,
      premium_rate: 0.02,
      premium_excluding_tax: 157_000,
      premium_including_tax: 185_260,
      taxes: [tax(28_260)],
    },
  ];
  const excl = 1_275_000 + 630_000 + 450_000 + 157_000;
  const fields = [
    {
      field_key: 'occupancy',
      label: 'Occupancy',
      data_type: 'SELECT',
      sort_order: 2,
      options: [{ value: 'WH', label: 'Warehouse and storage' }],
    },
    {
      field_key: 'construction',
      label: 'Construction Type',
      data_type: 'TEXT',
      sort_order: 3,
    },
    {
      field_key: 'perils',
      label: 'Perils Covered',
      data_type: 'MULTI_SELECT',
      sort_order: 4,
      options: [
        { value: 'FL', label: 'Fire and Lightning' },
        { value: 'ST', label: 'Storm and Flood' },
      ],
    },
    {
      field_key: 'sprinklers',
      label: 'Sprinklers Installed',
      data_type: 'BOOLEAN',
      sort_order: 5,
    },
    {
      field_key: 'unused',
      label: 'Unused Field',
      data_type: 'TEXT',
      sort_order: 6,
    },
  ];
  return {
    now: NOW,
    quotation: {
      quotation_no: 'QT-2026-000510',
      quotation_flow: 'NON_MOTOR',
      status: 'COMPLETED',
      created_at: '2026-11-08T07:00:00Z',
      offer_expires_at: null,
      approval_status: 'PENDING',
      insurer_company: insurer,
      customer: { customer_no: 'CUS-000377', tin: '111-222-333' },
      product_definition_snapshot: product('Fire and Allied Perils Insurance', {
        definitionItems: [
          {
            itemType: 'COVERAGE',
            title: 'Fire and lightning',
            description: '',
            sortOrder: 1,
          },
          {
            itemType: 'CONDITION',
            title: 'Fire extinguishers',
            description: 'Fire extinguishers must be serviced annually.',
            sortOrder: 1,
          },
          {
            itemType: 'EXCLUSION',
            title: 'War and terrorism',
            description: '',
            sortOrder: 1,
          },
        ],
      }),
    },
    preview: {
      overview: overview(
        'QT-2026-000510',
        'NON_MOTOR',
        'Fire and Allied Perils Insurance',
        {
          display_status: 'PENDING_APPROVAL',
          display_label: 'Pending Approval',
          approval_status: 'PENDING',
        },
      ),
      cover_note: coverNote(
        '2026-12-01T00:00:00+03:00',
        '2027-11-30T23:59:59+03:00',
        excl,
        excl * 1.18,
      ),
      policyholders: [
        {
          ...holder,
          policyholder_type: 'Corporate',
          full_name: 'Mwanza Agro Processors Ltd',
        },
      ],
      risks,
      addons,
      subject_matters: [
        {
          subject_matter_reference: 'LOC-1',
          subject_matter_description:
            'Warehouse complex at Plot 12, Nyakato Industrial Area, Mwanza',
        },
      ],
      motor_details: null,
      fleet: null,
    },
    nonMotor: {
      fields,
      schema_snapshot: [],
      risk_data: {
        occupancy: 'WH',
        construction: 'Concrete walls, steel truss and iron sheet roof',
        perils: ['FL', 'ST'],
        sprinklers: true,
        unused: null,
      },
      risk_location: 'Plot 12, Nyakato Industrial Area, Mwanza',
      limit_of_liability: 1_570_000_000,
    },
  };
}

/** Every printable string in the document. */
function allText(doc: QuotationDocument): string[] {
  const out = [
    doc.title,
    doc.subtitle,
    ...doc.issuerLines,
    ...doc.reference.flatMap((f) => [f.label, f.value]),
  ];
  for (const section of doc.sections) {
    out.push(section.title);
    for (const b of section.blocks) {
      if (b.kind === 'fields')
        out.push(...b.fields.flatMap((f) => [f.label, f.value]));
      if (b.kind === 'table')
        out.push(
          ...b.columns.map((c) => c.header),
          ...b.rows.flat(),
          ...(b.totals ?? []),
        );
      if (b.kind === 'paragraph' || b.kind === 'subheading') out.push(b.text);
      if (b.kind === 'bullets') out.push(...b.items);
      if (b.kind === 'premium')
        out.push(...b.lines.flatMap((l) => [l.label, l.amount]), b.total);
    }
  }
  return out;
}

const sectionTitles = (doc: QuotationDocument) =>
  doc.sections.map((s) => s.title);
const section = (doc: QuotationDocument, title: string) =>
  doc.sections.find((s) => s.title === title)!;
const premium = (doc: QuotationDocument) =>
  section(doc, 'Premium Summary').blocks[0] as Extract<
    QuotationDocument['sections'][0]['blocks'][0],
    { kind: 'premium' }
  >;

function expectClean(doc: QuotationDocument) {
  for (const value of allText(doc)) {
    expect(value).not.toMatch(/\b(undefined|null|NaN)\b/);
  }
}

async function renderAndCount(name: string, doc: QuotationDocument) {
  const bytes = await renderQuotationDocument(doc);
  const dir = process.env.QUOTATION_SAMPLE_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.pdf`), bytes);
  }
  const pdf = await PDFDocument.load(bytes);
  const [page] = pdf.getPages();
  expect(Math.round(page.getWidth())).toBe(595);
  expect(Math.round(page.getHeight())).toBe(842);
  return pdf.getPageCount();
}

describe('quotation document', () => {
  it('builds a single motor quotation with vehicle details and reconciled premium', async () => {
    const doc = buildQuotationDocument(singleMotor());
    expect(doc.kind).toBe('MOTOR_SINGLE');
    expect(doc.subtitle).toBe('Motor Private Insurance Quotation');
    expect(sectionTitles(doc)).toEqual([
      'Policyholder Details',
      'Insurance Details',
      'Vehicle Details',
      'Coverage and Extensions',
      'Premium Summary',
      'Terms, Conditions and Exclusions',
      'Important Notices',
      'Next Steps',
      'Authorisation',
    ]);
    const vehicle = section(doc, 'Vehicle Details').blocks[0] as Rec;
    const labels = vehicle.fields.map((f: Rec) => f.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Registration No.',
        'Make',
        'Chassis No.',
        'Engine Capacity',
        'Gross Vehicle Weight',
        'Sum Insured',
      ]),
    );
    expect(doc.reference.find((f) => f.label === 'Valid Until')?.value).toBe(
      '8 Dec 2026',
    );

    const p = premium(doc);
    expect(p.lines.map((l) => l.label)).toEqual([
      'Basic Premium',
      'Less: No Claim Discount',
      'Additional Covers',
      'Net Premium (excluding taxes)',
      'VAT',
    ]);
    expect(p.total).toBe('TSh 1,702,150.00');
    expectClean(doc);
    expect(await renderAndCount('single-motor', doc)).toBeGreaterThanOrEqual(1);
  });

  it('hides removed zero-rate add-ons but keeps standard zero-premium benefits', () => {
    const doc = buildQuotationDocument(singleMotor());
    const text = allText(doc).join('\n');
    expect(text).not.toContain('Roadside Assistance');
    expect(text).toContain('Windscreen Cover');
    expect(text).toContain('Personal Accident - Driver');
    const src = singleMotor();
    expect(
      visibleAddons(src.preview.addons, {}).map((a) => a.addon_reference),
    ).toEqual(['PA']);
  });

  it('builds a fleet schedule whose totals match the stored quotation totals', async () => {
    const src = fleet(8);
    const doc = buildQuotationDocument(src);
    expect(doc.kind).toBe('MOTOR_FLEET');
    const summary = section(doc, 'Fleet Summary');
    const table = summary.blocks.find((b) => b.kind === 'table') as Rec;
    expect(table.rows).toHaveLength(8);
    const premiumTotal = Number(table.totals[6].replace(/,/g, ''));
    expect(premiumTotal).toBeCloseTo(
      src.preview.cover_note.total_premium_excluding_tax,
      2,
    );
    const siTotal = Number(table.totals[5].replace(/,/g, ''));
    expect(siTotal).toBeCloseTo(
      src.preview.fleet.summary.total_fleet_sum_insured,
      2,
    );
    expect(premium(doc).total).toContain('TSh');
    expectClean(doc);
    expect(await renderAndCount('fleet-motor', doc)).toBeGreaterThanOrEqual(1);
  });

  it('moves large fleets into an appendix spanning several pages', async () => {
    const doc = buildQuotationDocument(fleet(60));
    expect(sectionTitles(doc)).toContain('Appendix A - Fleet Vehicle Schedule');
    expect(
      section(doc, 'Fleet Summary').blocks.some((b) => b.kind === 'table'),
    ).toBe(false);
    expect(60).toBeGreaterThan(FLEET_INLINE_LIMIT);
    expect(
      await renderAndCount('fleet-motor-large', doc),
    ).toBeGreaterThanOrEqual(3);
  });

  it('identifies short-term (in-transit) quotations and prints their cover period', async () => {
    const src = fleet(3, true);
    expect(documentKind(src.quotation, src.preview)).toBe('SHORT_TERM_FLEET');
    const doc = buildQuotationDocument(src);
    expect(doc.subtitle).toBe(
      'Short-Term (In-Transit) Fleet Motor Insurance Quotation',
    );
    const insurance = section(doc, 'Insurance Details').blocks[0] as Rec;
    const get = (label: string) =>
      insurance.fields.find((f: Rec) => f.label === label)?.value;
    expect(get('Type of Cover')).toBe('Short-Term (In-Transit) Cover');
    expect(get('Period of Insurance')).toBe('14 days');
    expect(get('Cover Start Date')).toBe('10 Nov 2026, 08:00');
    expect(get('Vehicle Classification')).toBe('Private');
    // Risk codes are never printed.
    expect(allText(doc).join('\n')).not.toContain('SP014001000007');
    expectClean(doc);
    expect(
      await renderAndCount('short-term-fleet', doc),
    ).toBeGreaterThanOrEqual(1);
  });

  it('builds a non-motor quotation from the product risk fields', async () => {
    const doc = buildQuotationDocument(nonMotor());
    expect(doc.kind).toBe('NON_MOTOR');
    expect(sectionTitles(doc)).toContain('Risk Details');
    expect(sectionTitles(doc)).not.toContain('Vehicle Details');
    const risk = section(doc, 'Risk Details');
    const fields = (risk.blocks[0] as Rec).fields;
    expect(fields).toEqual(
      expect.arrayContaining([
        {
          label: 'Risk Location',
          value: 'Plot 12, Nyakato Industrial Area, Mwanza',
        },
        { label: 'Occupancy', value: 'Warehouse and storage' },
        {
          label: 'Perils Covered',
          value: 'Fire and Lightning, Storm and Flood',
        },
        { label: 'Sprinklers Installed', value: 'Yes' },
        { label: 'Limit of Liability', value: 'TSh 1,570,000,000.00' },
      ]),
    );
    expect(fields.map((f: Rec) => f.label)).not.toContain('Unused Field');
    const terms = allText(doc).join('\n');
    expect(terms).toContain('Fire extinguishers must be serviced annually.');
    expect(terms).toContain('subject to underwriting approval');
    // No approval claim while approval is pending.
    expect(terms).not.toContain('Approved By');
    expectClean(doc);
    expect(await renderAndCount('non-motor-fire', doc)).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('never prints itemised lines that do not reconcile, and always ends on the stored total', () => {
    const src = singleMotor();
    src.preview.cover_note.total_premium_excluding_tax = 1_000_000;
    src.preview.cover_note.total_premium_including_tax = 1_180_000;
    src.preview.risks[0].taxes = [];
    src.preview.addons = [];
    const block = premiumBlock(src.preview, {}, 'TZS') as Rec;
    expect(block.lines.map((l: Rec) => l.label)).toEqual([
      'Net Premium (excluding taxes)',
      'Taxes and Levies',
    ]);
    expect(block.total).toBe('TSh 1,180,000.00');
  });

  it('stamps drafts and expired offers', () => {
    const draft = singleMotor();
    draft.preview.overview.display_status = 'DRAFT';
    expect(buildQuotationDocument(draft).watermark).toBe('DRAFT');
    const expired = singleMotor();
    expired.quotation.offer_expires_at = '2026-11-01T00:00:00Z';
    const doc = buildQuotationDocument(expired);
    expect(doc.watermark).toBe('EXPIRED');
    expect(doc.reference.find((f) => f.label === 'Status')?.value).toBe(
      'Expired',
    );
  });
});
