/**
 * Shared model for every customer-facing insurance PDF (quotation, policy
 * schedule, tax invoice, receipt). Builders map stored records into this
 * shape; `renderBrandedDocument` draws it with one header, footer, palette
 * and set of blocks, so all documents look the same.
 *
 * Builders only format and arrange stored values. Blank values are dropped
 * (see `compactFields`) so a document never prints N/A or empty rows.
 */

/* ------------------------------------------------------------------------ */
/* Model                                                                     */
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

export type DocTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface DocMoneyLine {
  label: string;
  amount: string;
  muted?: boolean;
  bold?: boolean;
}

export interface DocSignatory {
  /** e.g. "Authorised Officer", "Received By". */
  role: string;
  name?: string;
  title?: string;
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
      /** Right-aligned totals box, with the total highlighted. */
      kind: 'premium';
      currency: string;
      lines: DocMoneyLine[];
      totalLabel: string;
      total: string;
      /** The total in words, printed under the box. */
      words?: string;
      /** Lines after the total, e.g. amount paid and balance due. */
      after?: DocMoneyLine[];
    }
  | {
      /** TIRA / regulatory details with an optional verification QR code. */
      kind: 'regulatory';
      fields: DocField[];
      qr?: string;
    }
  | { kind: 'signatures'; signatories: DocSignatory[]; stamp?: boolean }
  /** Bordered rubber-stamp style mark, e.g. "PAID IN FULL". */
  | { kind: 'stamp'; text: string; tone: DocTone };

export interface DocSection {
  title: string;
  blocks: DocBlock[];
  /** Start the section on a fresh page (e.g. a long fleet appendix). */
  pageBreakBefore?: boolean;
}

export type DocType =
  | 'QUOTATION'
  | 'POLICY_SCHEDULE'
  | 'TAX_INVOICE'
  | 'RECEIPT';

export interface BrandedDocument {
  docType: DocType;
  /** Large document title: "QUOTATION", "TAX INVOICE", ... */
  title: string;
  subtitle: string;
  /** Document number, repeated in the running header and footer. */
  number: string;
  issuerName: string;
  issuerLogo: Uint8Array | null;
  /** Letterhead lines: address, contacts, website, regulatory identifiers. */
  issuerLines: string[];
  /** Short contact line for the page footer. */
  issuerFooter: string;
  /** Registration / licence line for the page footer. */
  issuerRegistration: string;
  /** Brand colour as #rrggbb (headings, table headers); default navy. */
  brandColor?: string;
  /** Document information band under the title. */
  reference: DocField[];
  /** Status badge next to the title, e.g. PAID or VALID UNTIL 9 Nov 2026. */
  badge?: { text: string; tone: DocTone };
  sections: DocSection[];
  /** Diagonal stamp (DRAFT, CANCELLED, EXPIRED, ...); empty for a live document. */
  watermark: string;
  generatedAt: string;
  /** One-line terms or disclaimer printed in every page footer. */
  terms: string;
}

/* ------------------------------------------------------------------------ */
/* Issuer (letterhead) from the company record                               */
/* ------------------------------------------------------------------------ */

type Rec = Record<string, any>;

export interface PaymentDetails {
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  bank_branch?: string | null;
  swift_code?: string | null;
  mobile_money_name?: string | null;
  mobile_money_number?: string | null;
  vrn?: string | null;
}

/** Payment details stored under the company's `settings.payment_details`. */
export function paymentDetailsOf(
  company: Rec | null | undefined,
): PaymentDetails {
  const raw = company?.settings?.payment_details;
  return raw && typeof raw === 'object' ? (raw as PaymentDetails) : {};
}

export function issuerOf(
  company: Rec | null | undefined,
  logo: Uint8Array | null,
): Pick<
  BrandedDocument,
  | 'issuerName'
  | 'issuerLogo'
  | 'issuerLines'
  | 'issuerFooter'
  | 'issuerRegistration'
  | 'brandColor'
> {
  const c: Rec = company ?? {};
  const a: Rec = c.address ?? {};
  const pay = paymentDetailsOf(c);
  const brand = text(c.settings?.brand_color ?? c.settings?.primary_color);
  return {
    issuerName: text(c.name),
    issuerLogo: logo,
    issuerLines: compact([
      compact([a.street, a.city, a.region]).join(', '),
      compact([a.postal_code && `P.O. Box ${a.postal_code}`, a.country]).join(
        ', ',
      ),
      compact([
        c.contact_phone && `Tel: ${c.contact_phone}`,
        c.contact_email && `Email: ${c.contact_email}`,
      ]).join('   '),
      text(c.website),
      compact([c.tin && `TIN: ${c.tin}`, pay.vrn && `VRN: ${pay.vrn}`]).join(
        '   ',
      ),
    ]),
    issuerFooter: compact([
      text(c.name),
      c.contact_phone && `Tel ${c.contact_phone}`,
      text(c.contact_email),
      text(c.website),
    ]).join('  |  '),
    issuerRegistration: compact([
      c.tira_license_number && `TIRA Licence No. ${c.tira_license_number}`,
      c.brela_registration_number &&
        `Company Reg. No. ${c.brela_registration_number}`,
    ]).join('  |  '),
    brandColor: /^#[0-9a-f]{6}$/i.test(brand) ? brand : undefined,
  };
}

/** "Payment Instructions" fields; empty when no details are configured. */
export function paymentInstructionFields(
  company: Rec | null | undefined,
  controlNumber?: unknown,
): DocField[] {
  const pay = paymentDetailsOf(company);
  return compactFields([
    ['Control Number', controlNumber],
    ['Bank', pay.bank_name],
    ['Account Name', pay.account_name],
    ['Account Number', pay.account_number],
    ['Bank Branch', pay.bank_branch],
    ['SWIFT Code', pay.swift_code],
    [
      'Mobile Money',
      compact([pay.mobile_money_number, pay.mobile_money_name]).join(' - '),
    ],
  ]);
}

/* ------------------------------------------------------------------------ */
/* Formatting                                                                */
/* ------------------------------------------------------------------------ */

export function text(value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  return s === 'null' || s === 'undefined' ? '' : s;
}

export function compact(values: unknown[]): string[] {
  return values.map(text).filter(Boolean);
}

/** Label/value pairs with blank values removed. */
export function compactFields(pairs: [string, unknown][]): DocField[] {
  return pairs
    .map(([label, value]) => ({ label, value: text(value) }))
    .filter((field) => field.value);
}

export function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** "23,600.00" */
export function formatMoney(value: number) {
  return (Object.is(roundMoney(value), -0) ? 0 : value).toLocaleString(
    'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
}

const CURRENCY_SYMBOL: Record<string, string> = { TZS: 'TSh' };

/** "TSh 23,600.00" (other currencies keep their ISO code). */
export function money(currency: string | null | undefined, value: number) {
  const code = text(currency).toUpperCase();
  return compact([CURRENCY_SYMBOL[code] ?? code, formatMoney(value)]).join(' ');
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Documents print in East Africa Time. */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function eat(date: Date) {
  return new Date(date.getTime() + EAT_OFFSET_MS);
}

/** "9 Nov 2026" */
export function formatDate(value: unknown) {
  const date = toDate(value);
  if (!date) return '';
  // Plain dates (yyyy-mm-dd) are calendar dates; print them as stored.
  const d =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? date
      : eat(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "9 Nov 2026, 14:33" */
export function formatDateTime(value: unknown) {
  const date = toDate(value);
  if (!date) return '';
  const d = eat(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(date)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function humanize(value: unknown) {
  return text(value)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------------ */
/* Amount in words                                                           */
/* ------------------------------------------------------------------------ */

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function underThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
    if (n) parts.push('and');
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** Whole number in English words, e.g. 23600 -> "twenty-three thousand six hundred". */
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zero';
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) {
      groups.unshift(
        [underThousand(chunk), SCALES[scale]].filter(Boolean).join(' '),
      );
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(' ');
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  TZS: ['Tanzanian shillings', 'cents'],
  KES: ['Kenyan shillings', 'cents'],
  UGX: ['Ugandan shillings', 'cents'],
  USD: ['US dollars', 'cents'],
  EUR: ['euros', 'cents'],
  GBP: ['pounds sterling', 'pence'],
};

/**
 * "Twenty-three thousand six hundred Tanzanian shillings only";
 * cents are added when present ("... and fifty cents only").
 */
export function amountInWords(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value == null || !Number.isFinite(value)) return '';
  const code = text(currency).toUpperCase();
  const [major, minor] = CURRENCY_WORDS[code] ?? [code || 'units', 'cents'];
  const rounded = roundMoney(Math.abs(value));
  const whole = Math.floor(rounded);
  const cents = Math.round((rounded - whole) * 100);
  let words = `${numberToWords(whole)} ${major}`;
  if (cents) words += ` and ${numberToWords(cents)} ${minor}`;
  words += ' only';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------------------ */
/* Files                                                                     */
/* ------------------------------------------------------------------------ */

/** "Quotation_AICL261109011.pdf" */
export function documentFileName(prefix: string, number: string) {
  const safe = [...text(number)]
    .map((character) => {
      const code = character.charCodeAt(0);
      return /[\\/:*?"<>|]/.test(character) || code < 32 || code === 127
        ? '-'
        : character;
    })
    .join('')
    .replace(/\s+/g, '-')
    .slice(0, 100);
  return `${prefix}_${safe || 'document'}.pdf`;
}
