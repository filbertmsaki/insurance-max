/**
 * Policy schedule built on the shared branded document. The service gathers
 * the stored policy, version, customer and vehicle values; this module only
 * arranges them, together with the standard motor wording, into sections.
 */
import {
  amountInWords,
  compactFields,
  issuerOf,
  money,
  text,
  type BrandedDocument,
  type DocField,
  type DocBlock,
  type DocSection,
  type DocTone,
} from './branded-document';
import * as W from './motor-schedule.wording';

export interface PolicyScheduleVehicle {
  registrationNo: string;
  chassisNo?: string;
  makeModelBody: string;
  cc: string;
  year: string;
  sticker: string;
  seating: string;
  color: string;
  coverType: string;
  estimatedValue: string;
}

export interface PolicyScheduleSource {
  /** Insurer company record (letterhead, licence, payment details). */
  insurer: Record<string, any> | null;
  logo: Uint8Array | null;
  policyNo: string;
  quotationNo: string;
  coverNoteNo: string;
  stickerNo: string;
  policyStatus: string;
  issueDate: string;
  branch: string;
  preparedBy: string;
  approvedBy: string;
  intermediary: string;
  /** Policyholder block (already compacted label/value pairs). */
  policyholder: [string, unknown][];
  productName: string;
  insuranceClass: string;
  coverType: string;
  from: string;
  to: string;
  renewalDate: string;
  sumInsured: string;
  currency: string;
  /** Itemised premium lines (basic, discount, levies, VAT...) above Total. */
  premiumLines: [string, string][];
  totalAmount: number;
  /** Text encoded in the verification QR code. */
  verification: string;
  /** Diagonal stamp such as DRAFT or CANCELLED; empty for a live policy. */
  watermark: string;
  vehicles: PolicyScheduleVehicle[];
  /**
   * Insurance Details as printed on the source quotation (class, product,
   * cover type, risk covered, cover dates and period, vehicle class and
   * usage). When given, it replaces the plain class/product/period fields.
   */
  insuranceDetails?: DocField[];
  /** Short-term (in-transit) cover: vehicles are identified by chassis no. */
  transit?: boolean;
  /** Motor wording (drivers, use, limits, excesses) applies. */
  motor: boolean;
  generatedAt: string;
}

const STATUS_TONE: Record<string, DocTone> = {
  ACTIVE: 'success',
  ISSUED: 'success',
  IN_FORCE: 'success',
  DRAFT: 'neutral',
  PENDING: 'warning',
};

export function buildPolicySchedule(
  src: PolicyScheduleSource,
): BrandedDocument {
  const status = text(src.policyStatus).toUpperCase().replace(/\s+/g, '_');
  const sections: DocSection[] = [
    {
      title: 'Policyholder Details',
      blocks: [
        { kind: 'fields', fields: compactFields(src.policyholder), columns: 2 },
      ],
    },
    {
      title: 'Insurance Details',
      blocks: [
        {
          kind: 'fields',
          columns: 2,
          fields: src.insuranceDetails?.length
            ? [
                ...src.insuranceDetails,
                ...compactFields([
                  ['Renewal Date', src.renewalDate],
                  ['Sum Insured', src.sumInsured],
                  ['Intermediary', src.intermediary],
                ]),
              ]
            : compactFields([
                ['Insurance Class', src.insuranceClass],
                ['Product', src.productName],
                ['Type of Cover', src.coverType],
                ['Period From', src.from],
                ['Period To', src.to],
                ['Renewal Date', src.renewalDate],
                ['Sum Insured', src.sumInsured],
                ['Currency', src.currency],
                ['Intermediary', src.intermediary],
              ]),
        },
      ],
    },
  ];

  if (src.vehicles.length) {
    sections.push({
      title: src.vehicles.length > 1 ? 'Insured Vehicles' : 'Insured Vehicle',
      blocks: [
        {
          kind: 'table',
          columns: [
            {
              header: src.transit ? 'Chassis No.' : 'Reg. / Chassis No.',
              width: 1.3,
            },
            { header: 'Make / Model / Body', width: 2.2 },
            { header: 'Year', width: 0.7, align: 'center' },
            { header: 'CC', width: 0.7, align: 'right' },
            { header: 'Seats', width: 0.75, align: 'center' },
            { header: 'Colour', width: 0.9 },
            { header: 'Cover / Usage', width: 1.3 },
            { header: 'Sticker No.', width: 1.2 },
            {
              header: `Sum Insured (${src.currency})`,
              width: 1.4,
              align: 'right',
            },
          ],
          rows: src.vehicles.map((v) => [
            src.transit
              ? v.chassisNo || v.registrationNo
              : v.registrationNo || v.chassisNo || '',
            v.makeModelBody,
            v.year,
            v.cc,
            v.seating,
            v.color,
            v.coverType,
            v.sticker,
            v.estimatedValue,
          ]),
        },
      ],
    });
  }

  sections.push({
    title: 'Premium Summary',
    blocks: [
      {
        kind: 'premium',
        currency: src.currency,
        lines: src.premiumLines.map(([label, amount]) => ({ label, amount })),
        totalLabel: 'TOTAL PREMIUM',
        total: money(src.currency, src.totalAmount),
        words: amountInWords(src.totalAmount, src.currency),
      },
    ],
  });

  const regulatory = compactFields([
    ['Cover Note No.', src.coverNoteNo],
    ['Sticker No.', src.vehicles.length > 1 ? '' : src.stickerNo],
    ['TIRA Status', src.coverNoteNo ? 'Issued' : ''],
  ]);
  if (regulatory.length || src.verification) {
    sections.push({
      title: 'TIRA Details',
      blocks: [
        { kind: 'regulatory', fields: regulatory, qr: src.verification },
      ],
    });
  }

  if (src.motor) sections.push(...motorWording(src.currency));

  sections.push({
    title: 'Authorisation',
    blocks: [
      { kind: 'paragraph', text: W.WITNESS_TEXT },
      {
        kind: 'signatures',
        signatories: [
          { role: 'Prepared By', name: src.preparedBy },
          { role: 'Authorised Officer', name: src.approvedBy },
        ],
        stamp: true,
      },
    ],
  });

  return {
    docType: 'POLICY_SCHEDULE',
    title: 'POLICY SCHEDULE',
    subtitle: [src.productName, src.insuranceClass].filter(Boolean).join(' - '),
    number: src.policyNo,
    ...issuerOf(src.insurer, src.logo),
    reference: compactFields([
      ['Policy No.', src.policyNo],
      ['Issue Date', src.issueDate],
      ['Quotation No.', src.quotationNo],
      ['Cover Note No.', src.coverNoteNo],
      ['Branch', src.branch],
      ['Issued By', src.preparedBy],
    ]),
    badge: src.policyStatus
      ? {
          text: text(src.policyStatus).toUpperCase(),
          tone: STATUS_TONE[status] ?? (src.watermark ? 'danger' : 'neutral'),
        }
      : undefined,
    sections,
    watermark: src.watermark,
    generatedAt: src.generatedAt,
    terms: W.FOOTER_NOTE.replace(/^Note\s*:\s*/, ''),
  };
}

/** Standard motor wording, limits of liability and excesses. */
function motorWording(currency: string): DocSection[] {
  const limits = (rows: string[][], headers: string[]): DocBlock => ({
    kind: 'table',
    columns: headers.map((header, i) => ({
      header,
      width: i === 0 ? 2.4 : i === 1 ? 0.95 : 1.4,
      align: i === 0 ? 'left' : 'center',
    })),
    rows,
  });
  return [
    {
      title: 'Policy Wording',
      blocks: [
        { kind: 'paragraph', text: W.VALIDITY_NOTICE },
        { kind: 'subheading', text: 'Authorised Drivers' },
        {
          kind: 'bullets',
          items: W.AUTHORIZED_DRIVERS.map(([n, t]) => `${n} ${t}`),
        },
        { kind: 'subheading', text: 'Limitations as to Use' },
        { kind: 'paragraph', text: W.LIMITATIONS_AS_TO_USE },
        {
          kind: 'fields',
          columns: 1,
          fields: W.USE_CLAUSES.map(([label, value]) => ({
            label: label.replace(/:$/, ''),
            value,
          })),
        },
        { kind: 'subheading', text: 'Legislation' },
        { kind: 'paragraph', text: W.LEGISLATION },
        { kind: 'subheading', text: W.ENDORSEMENT_TITLE },
        { kind: 'bullets', items: W.CONDITIONS_AND_EXTENSIONS },
      ],
    },
    {
      title: `Schedule I - Limits of Liability (${currency || 'TZS'})`,
      pageBreakBefore: true,
      blocks: [
        limits(W.SCHEDULE_I_ROWS, [
          'Cover',
          'Included',
          'Commercial',
          'Private',
          'Motor Cycle',
        ]),
        { kind: 'paragraph', text: W.SCHEDULE_I_NOTES },
      ],
    },
    {
      title: 'Schedule II - Excesses / Deductibles',
      blocks: [
        { kind: 'subheading', text: '(a) Private Motor and Motor Cycles' },
        limits(W.SCHEDULE_IIA_ROWS, [
          'Item',
          'Included',
          'Private Motor',
          'Motor Cycles',
        ]),
        { kind: 'paragraph', text: W.SCHEDULE_IIA_NOTE },
        { kind: 'subheading', text: '(b) Commercial Vehicles' },
        limits(W.SCHEDULE_IIB_ROWS, [
          'Item',
          'Included',
          'Goods Carrying',
          'Taxi',
          'Buses',
          'Special Types',
        ]),
        { kind: 'bullets', items: W.SCHEDULE_II_NOTES },
      ],
    },
  ];
}
