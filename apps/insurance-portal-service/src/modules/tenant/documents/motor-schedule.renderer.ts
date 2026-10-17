import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  Color,
  StandardFonts,
  degrees,
  grayscale,
  rgb,
} from 'pdf-lib';
import * as QRCode from 'qrcode';
import * as W from './motor-schedule.wording';

export interface MotorScheduleVehicle {
  registrationNo: string;
  makeModelBody: string;
  cc: string;
  year: string;
  sticker: string;
  seating: string;
  color: string;
  coverType: string;
  windscreenAmount: string;
  estimatedValue: string;
}

export interface MotorScheduleData {
  insurerName: string;
  insurerLogo: Uint8Array | null;
  policyNo: string;
  coverNoteNo: string;
  insuredName: string;
  brokerInvoiceNo: string;
  addressDetails: string;
  postalAddress: string;
  from: string;
  to: string;
  renewalDate: string;
  /** Address, phone, email, TIN and licence lines printed under the logo. */
  insurerContact: string[];
  productName: string;
  policyStatus: string;
  branch: string;
  insuredTin: string;
  insuredPhone: string;
  insuredEmail: string;
  sumInsured: string;
  currency: string;
  /** Itemised premium lines (basic, discount, levies, VAT...) above Total. */
  premiumLines: [string, string][];
  total: string;
  /** Text encoded in the verification QR code. */
  verification: string;
  generatedAt: string;
  /** Diagonal stamp such as DRAFT or CANCELLED; empty for a live policy. */
  watermark: string;
  vehicles: MotorScheduleVehicle[];
  place: string;
  issueDate: string;
  intermediary: string;
  preparedBy: string;
  approvedBy: string;
  printedBy: string;
  printedOn: string;
}

type Align = 'left' | 'center' | 'right';
/** Grey level (0-1) or the brand colour with white text. */
type Fill = number | 'brand';
interface Cell {
  t: string;
  w: number;
  b?: boolean;
  fill?: Fill;
  align?: Align;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 30;
const CONTENT_W = PAGE_W - M * 2;
const FOOTER_H = 104;
const HEADER_H = 84;
const PAD = 3;
const GRID = grayscale(0.25);
const BRAND_RED = rgb(0.88, 0.11, 0.18);
const BRAND_BLUE = rgb(0.2, 0.2, 0.55);

/** Renders a motor policy schedule in the insurer's standard A4 layout. */
export async function renderMotorSchedule(
  data: MotorScheduleData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Motor Policy Schedule ${data.policyNo}`);
  pdf.setAuthor(data.insurerName);
  pdf.setSubject(`Policy schedule for ${data.insuredName}`);
  pdf.setCreator(data.insurerName);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const r = new Renderer(
    pdf,
    font,
    await pdf.embedFont(StandardFonts.HelveticaBold),
    await embedLogo(pdf, data.insurerLogo),
    await embedQr(pdf, data.verification),
    data,
  );
  r.newPage(false);
  r.policyDetails();
  r.insuranceCover();
  r.wording();
  r.conditions();
  r.newPage(true);
  r.limitsOfLiability();
  r.deductibles();

  // Page numbers need the final page count, so they go on last.
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    const text = clean(
      `Page ${i + 1} of ${pages.length}   |   ${data.policyNo}   |   Generated ${data.generatedAt}`,
    );
    const size = 6.5;
    page.drawText(text, {
      x: (PAGE_W - font.widthOfTextAtSize(text, size)) / 2,
      y: M - 12,
      size,
      font,
      color: grayscale(0.45),
    });
  });
  return pdf.save();
}

async function embedQr(pdf: PDFDocument, text: string) {
  if (!text) return null;
  try {
    const png = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 240,
    });
    return await pdf.embedPng(png);
  } catch {
    return null;
  }
}

async function embedLogo(pdf: PDFDocument, bytes: Uint8Array | null) {
  if (!bytes || bytes.length < 4) return null;
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50)
      return await pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8)
      return await pdf.embedJpg(bytes);
  } catch {
    // An unreadable logo must never block the schedule.
  }
  return null;
}

/** Helvetica only encodes WinAnsi; replace anything it cannot draw. */
function clean(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?');
}

class Renderer {
  private page!: PDFPage;
  /** Distance from the top of the page to the drawing cursor. */
  private y = 0;
  /** Tighter rows for the attached schedules so they fit on one page. */
  private dense = false;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly logo: PDFImage | null,
    private readonly qr: PDFImage | null,
    private readonly d: MotorScheduleData,
  ) {}

  newPage(attached: boolean) {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.watermark();
    this.header(attached);
    this.footer();
    this.y = HEADER_H + (attached ? 14 : 0);
  }

  private watermark() {
    const text = clean(this.d.watermark.toUpperCase());
    if (!text) return;
    // Fit the stamp along the page diagonal whatever its length.
    const size = Math.min(110, 620 / Math.max(1, text.length * 0.62));
    const w = this.bold.widthOfTextAtSize(text, size);
    const a = (38 * Math.PI) / 180;
    this.page.drawText(text, {
      x: PAGE_W / 2 - (w / 2) * Math.cos(a) + (size / 3) * Math.sin(a),
      y: PAGE_H / 2 - (w / 2) * Math.sin(a) - (size / 3) * Math.cos(a),
      size,
      font: this.bold,
      color: rgb(0.85, 0.2, 0.2),
      opacity: 0.12,
      rotate: degrees(38),
    });
  }

  // ---------- page furniture ----------

  private header(attached: boolean) {
    const top = 24;
    let textX = M;
    if (this.logo) {
      const h = 46;
      const w = Math.min((this.logo.width / this.logo.height) * h, 70);
      this.page.drawImage(this.logo, {
        x: M,
        y: PAGE_H - top - h,
        width: w,
        height: (w / this.logo.width) * this.logo.height,
      });
      textX = M + w + 6;
    }
    const [first, ...rest] = clean(this.d.insurerName).split(' ');
    const tail = rest.join(' ');
    const line1 = rest.length > 2 ? `${first} ${rest[0]}` : first;
    const line2 = rest.length > 2 ? rest.slice(1).join(' ') : tail;
    this.page.drawText(line1, {
      x: textX,
      y: PAGE_H - top - 18,
      size: 13,
      font: this.bold,
      color: BRAND_RED,
    });
    this.page.drawText(line2, {
      x: textX,
      y: PAGE_H - top - 33,
      size: 13,
      font: this.bold,
      color: BRAND_BLUE,
    });
    this.d.insurerContact.slice(0, 5).forEach((line, i) => {
      this.text(
        line,
        M + 250,
        top + 2 + i * 9,
        CONTENT_W - 250,
        7,
        false,
        'right',
        grayscale(0.3),
      );
    });
    // Two-tone brand rule under the letterhead.
    const ruleY = PAGE_H - HEADER_H + 10;
    this.page.drawRectangle({
      x: M,
      y: ruleY,
      width: CONTENT_W * 0.7,
      height: 2,
      color: BRAND_BLUE,
    });
    this.page.drawRectangle({
      x: M + CONTENT_W * 0.7,
      y: ruleY,
      width: CONTENT_W * 0.3,
      height: 2,
      color: BRAND_RED,
    });
    if (attached) {
      this.text(
        `Attached to and Forming Part of ${this.d.policyNo}`,
        M,
        HEADER_H + 2,
        CONTENT_W,
        8.5,
        false,
        'right',
      );
    }
  }

  private footer() {
    const d = this.d;
    const top = PAGE_H - M - FOOTER_H;
    this.text(W.FOOTER_NOTE, M, top, CONTENT_W, 7.5, true);
    const boxTop = top + 11;
    const rowH = 13;
    this.page.drawRectangle({
      x: M,
      y: PAGE_H - boxTop - rowH * 5,
      width: CONTENT_W,
      height: rowH * 5,
      borderColor: GRID,
      borderWidth: 0.6,
    });
    const at = (i: number) => boxTop + i * rowH + 3;
    const s = 7.5;
    this.text(W.WITNESS_TEXT, M + PAD, at(0), CONTENT_W, s);
    this.text('Place :', M + PAD, at(1), 40, s);
    this.text(d.place, M + 45, at(1), 90, s);
    this.text('Date :', M + 130, at(1), 40, s);
    this.text(d.issueDate, M + 175, at(1), 80, s);
    const labelled = (i: number, label: string, value: string) => {
      this.text(label, M + PAD, at(i), 60, s);
      this.text(value, M + 68, at(i), 140, s);
    };
    labelled(2, 'Intermediary:', d.intermediary);
    labelled(3, 'Prepared By:', d.preparedBy);
    labelled(4, 'Printed By:', d.printedBy);
    this.text('Approved By:', M + 210, at(3), 60, s);
    this.text(d.approvedBy, M + 268, at(3), 120, s);
    this.text('Printed On:', M + 210, at(4), 60, s);
    this.text(d.printedOn, M + 268, at(4), 120, s);
    this.text(d.insurerName, M + 330, at(2), 200, s, false, 'center');
    this.text('Authorized Signatory', M + 330, at(4), 200, s, false, 'center');
  }

  // ---------- sections ----------

  policyDetails() {
    const d = this.d;
    this.row(
      [
        {
          t: 'MOTOR POLICY SCHEDULE',
          w: CONTENT_W,
          b: true,
          fill: 'brand',
          align: 'center',
        },
      ],
      10,
      20,
    );
    this.y += 4;
    const L = 115;
    this.row([
      { t: 'Policy Number :', w: L, b: true },
      { t: d.policyNo, w: 200 },
      { t: 'Cover Note Number', w: 105, align: 'right' },
      { t: d.coverNoteNo, w: CONTENT_W - L - 305 },
    ]);
    const full = (label: string, value: string) =>
      this.row([
        { t: label, w: L, b: true },
        { t: value, w: CONTENT_W - L },
      ]);
    const pair = (l1: string, v1: string, l2: string, v2: string) =>
      this.row([
        { t: l1, w: L, b: true },
        { t: v1, w: 200 },
        { t: l2, w: 90, b: true },
        { t: v2, w: CONTENT_W - L - 290 },
      ]);
    pair('Product / Class :', d.productName, 'Policy Status :', d.policyStatus);
    full('Insured Name:', d.insuredName);
    pair('Insured TIN :', d.insuredTin, 'Phone :', d.insuredPhone);
    pair('Email :', d.insuredEmail, 'Branch :', d.branch);
    pair(
      'Broker Invoice No:',
      d.brokerInvoiceNo,
      'Sum Insured :',
      d.sumInsured,
    );
    full('Address Details :', d.addressDetails);
    full('Postal Address :', d.postalAddress);
    this.row([
      { t: 'From :', w: 35, b: true },
      { t: d.from, w: L - 35 },
      { t: 'To :', w: 35, b: true },
      { t: d.to, w: 165 },
      { t: '', w: CONTENT_W - L - 200 },
    ]);
    this.row([
      { t: 'Renewal Date', w: L, b: true },
      { t: d.renewalDate, w: 165 },
      { t: '', w: CONTENT_W - L - 165 },
    ]);

    // Premium block: a merged cell on the left (title + verification QR) and
    // the itemised amounts on the right.
    const leftW = L + 165;
    const amounts: [string, string, Fill][] = [
      ['Currency', d.currency, 0.93],
      ...d.premiumLines.map(([l, v]): [string, string, Fill] => [l, v, 0.93]),
      ['Total Payable', d.total, 'brand'],
    ];
    const rowH = Math.max(14, 76 / amounts.length);
    this.ensure(rowH * amounts.length);
    const startY = this.y;
    for (const [label, value, fill] of amounts) {
      this.row(
        [
          { t: label, w: 125, b: true, fill },
          {
            t: value,
            w: CONTENT_W - leftW - 125,
            b: true,
            align: 'right',
            fill,
          },
        ],
        8,
        rowH,
        leftW,
      );
    }
    const h = this.y - startY;
    this.cell(M, startY, leftW, h, '', false, 0.93);
    this.text(
      'PREMIUM DETAILS',
      M + 8,
      startY + 8,
      150,
      10,
      true,
      'left',
      BRAND_BLUE,
    );
    this.text(
      'Amounts are inclusive of applicable statutory taxes and levies.',
      M + 8,
      startY + 24,
      leftW - h - 20,
      6.5,
      false,
      'left',
      grayscale(0.35),
    );
    if (this.qr) {
      const size = h - 14;
      this.page.drawImage(this.qr, {
        x: M + leftW - size - 8,
        y: PAGE_H - startY - size - 4,
        width: size,
        height: size,
      });
      this.text(
        'Scan to verify',
        M + leftW - size - 8,
        startY + size + 5,
        size,
        5.5,
        false,
        'center',
        grayscale(0.35),
      );
    }
    this.y += 14;
  }

  insuranceCover() {
    this.row([{ t: 'Insurance Cover :', w: CONTENT_W, b: true }], 8, 15);
    const cols = [18, 45, 85, 32, 38, 45, 38, 35, 62, 52, 85];
    this.row([
      { t: '', w: cols[0] + cols[1], fill: 0.85 },
      {
        t: 'Vehicle Details',
        w: CONTENT_W - cols[0] - cols[1],
        b: true,
        fill: 0.85,
      },
    ]);
    const headers = [
      'Sr',
      'Reg. No',
      'Make/ Model/Body Type',
      'CC',
      'Year of Mfg',
      'Sticker',
      'Seating',
      'Color',
      'Cover Type',
      'Wind Screen Amount',
      "Insured's Estimate of Value (TZS)",
    ];
    this.row(
      headers.map((t, i) => ({ t, w: cols[i], b: true, align: 'center' })),
      7.5,
      26,
    );
    this.d.vehicles.forEach((v, i) => {
      const values = [
        String(i + 1),
        v.registrationNo,
        v.makeModelBody,
        v.cc,
        v.year,
        v.sticker,
        v.seating,
        v.color,
        v.coverType,
        v.windscreenAmount,
        v.estimatedValue,
      ];
      this.row(
        values.map((t, c) => ({ t, w: cols[c], align: 'center' })),
        7.5,
        30,
      );
    });
  }

  wording() {
    const full = (t: string, b = false, fill?: number) =>
      this.row([{ t, w: CONTENT_W, b, fill }], 8);
    full(W.VALIDITY_NOTICE, true);
    this.block(() => {
      this.para('Authorized Driver :', 0, true);
      this.para('Any of the following', 0);
      for (const [mark, text] of W.AUTHORIZED_DRIVERS) {
        const top = this.y;
        this.para(mark, 110, false, 'right', 20);
        this.y = top;
        this.para(text, 140);
      }
      this.para('Limitations as to use:', 0, true);
      this.y += 3;
      this.para(W.LIMITATIONS_AS_TO_USE, 0);
    });
    this.block(() => {
      for (const [label, text] of W.USE_CLAUSES) {
        const top = this.y;
        this.para(label, 0, true, 'left', 125);
        this.y = top;
        this.para(text, 130);
      }
    });
    this.block(() => {
      this.para('Legislation Applicable', 0, true);
      this.para(W.LEGISLATION, 0);
      const pair = (label: string, text: string) => {
        const top = this.y;
        this.para(label, 0, true, 'left', 100);
        this.y = top;
        this.para(text, 105);
      };
      pair(
        'Excess Deductible :',
        "As per attached schedule II Limit of Company's",
      );
      pair('Liability :', 'As per attached schedule I');
    });
    this.y += 18;
  }

  conditions() {
    this.ensure(30);
    this.para('Conditions and Extensions :', 8, true);
    this.y += 6;
    for (const item of W.CONDITIONS_AND_EXTENSIONS) {
      const lines = this.wrap(item, this.font, 8, CONTENT_W - 30);
      if (this.ensure(lines.length * 10 + 10)) this.y += 6;
      this.page.drawCircle({
        x: M + 13,
        y: PAGE_H - this.y - 3,
        size: 1.4,
        color: grayscale(0),
      });
      this.para(item, 20);
      this.y += 9;
    }
    this.para(W.ENDORSEMENT_TITLE, 0);
  }

  limitsOfLiability() {
    this.dense = true;
    this.row([
      {
        t: 'Attached to and Forming Part of Motor Insurance Policy No :',
        w: 260,
      },
      { t: this.d.policyNo, w: CONTENT_W - 260 },
    ]);
    this.row([
      {
        t: 'Schedule I: Limit of liabilities under the policy (All figures are in TSHS)',
        w: CONTENT_W,
        b: true,
        align: 'center',
      },
    ]);
    const cols = [175, 90, 90, 90, 90];
    const head = [
      'Extension/Conditions',
      'Included',
      'Comm Vehicle',
      'Private Motor',
      'Motor Cycle',
    ];
    this.row(
      head.map((t, i) => ({
        t,
        w: cols[i],
        b: true,
        align: 'center',
      })),
    );
    for (const r of W.SCHEDULE_I_ROWS) {
      this.row(
        r.map((t, i) => ({
          t,
          w: cols[i],
          align: i === 0 && t === 'Per Event' ? 'right' : 'left',
        })),
      );
    }
    this.row([{ t: W.SCHEDULE_I_NOTES, w: CONTENT_W }]);
  }

  deductibles() {
    this.y += 4;
    this.para(
      'Schedule I I Deductible / Excess (All figures are in TSHS.)',
      8,
      true,
    );
    this.y += 6;
    this.para(
      'SCHEDULE II(a) : Applicable to Motor Private Car & Motor Cycles',
      8,
      true,
    );
    this.y += 6;
    const a = [110, 60, 185, 180];
    this.row(
      [
        'Extensions/Conditions',
        'Included',
        'Private Motor',
        'Motor Cycles',
      ].map((t, i) => ({ t, w: a[i], b: true, align: 'center' })),
    );
    for (const r of W.SCHEDULE_IIA_ROWS)
      this.row(r.map((t, i) => ({ t, w: a[i] })));
    this.row([{ t: W.SCHEDULE_IIA_NOTE, w: CONTENT_W }]);

    this.y += 6;
    this.para(
      'SCHEDULE 11(b) : Applicable to Motor Commercial Vehicle',
      8,
      true,
    );
    this.y += 6;
    const b = [85, 40, 125, 75, 75, 135];
    this.row([
      { t: 'Extension/ Conditions', w: b[0], b: true, align: 'center' },
      { t: 'Included', w: b[1], b: true, align: 'center' },
      { t: 'General Goods Carrying', w: b[2], b: true, align: 'center' },
      { t: 'Passenger carrying', w: b[3] + b[4], b: true, align: 'center' },
      { t: 'Special Type Vehicles', w: b[5], b: true, align: 'center' },
    ]);
    this.row([
      { t: '', w: b[0] },
      { t: '', w: b[1] },
      { t: 'Trucks, Tractors, Pickups,Canter etc', w: b[2] },
      { t: 'Public Tax, Private hire Tour operators', w: b[3] },
      { t: 'Buses (Daladala within city upcountry,private &', w: b[4] },
      {
        t: 'Farm,tractor,forklift, crane,Graders, ex cavator etc',
        w: b[5],
        align: 'center',
      },
    ]);
    for (const r of W.SCHEDULE_IIB_ROWS)
      this.row(r.map((t, i) => ({ t, w: b[i] })));
    this.row([{ t: W.SCHEDULE_II_NOTES.join('\n'), w: CONTENT_W }]);
  }

  // ---------- primitives ----------

  /** Starts a new page when `h` points no longer fit above the footer. */
  private ensure(h: number) {
    if (this.y + h <= PAGE_H - M - FOOTER_H - 6) return false;
    this.newPage(true);
    return true;
  }

  /** Draws a bordered box around whatever `draw` renders. */
  private block(draw: () => void) {
    const startPage = this.page;
    const top = this.y;
    this.y += PAD;
    draw();
    this.y += PAD;
    if (this.page === startPage) {
      this.page.drawRectangle({
        x: M,
        y: PAGE_H - this.y,
        width: CONTENT_W,
        height: this.y - top,
        borderColor: GRID,
        borderWidth: 0.6,
      });
    }
  }

  /** A wrapped paragraph flowing at the cursor. */
  private para(
    text: string,
    indent: number,
    isBold = false,
    align: Align = 'left',
    width = CONTENT_W - indent - PAD * 2,
    size = 8,
  ) {
    const font = isBold ? this.bold : this.font;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(size + 3);
      this.text(line, M + PAD + indent, this.y, width, size, isBold, align);
      this.y += size + 2.5;
    }
  }

  private row(
    cells: Cell[],
    size = this.dense ? 6.8 : 8,
    minH = this.dense ? 11 : 14,
    xOffset = 0,
  ) {
    const lineH = size + 2;
    const heights = cells.map(
      (c) =>
        this.wrap(c.t, c.b ? this.bold : this.font, size, c.w - PAD * 2)
          .length *
          lineH +
        5,
    );
    const h = Math.max(minH, ...heights);
    this.ensure(h);
    let x = M + xOffset;
    for (const c of cells) {
      this.cell(x, this.y, c.w, h, c.t, c.b, c.fill, c.align, size);
      x += c.w;
    }
    this.y += h;
  }

  private cell(
    x: number,
    top: number,
    w: number,
    h: number,
    text: string,
    isBold = false,
    fill?: Fill,
    align: Align = 'left',
    size = 8,
  ) {
    this.page.drawRectangle({
      x,
      y: PAGE_H - top - h,
      width: w,
      height: h,
      borderColor: GRID,
      borderWidth: 0.6,
      color:
        fill === undefined
          ? undefined
          : fill === 'brand'
            ? BRAND_BLUE
            : grayscale(fill),
    });
    const font = isBold ? this.bold : this.font;
    const lines = this.wrap(text, font, size, w - PAD * 2);
    const lineH = size + 2;
    let ty = top + (h - lines.length * lineH) / 2 + 1;
    for (const line of lines) {
      const ink = fill === 'brand' ? rgb(1, 1, 1) : undefined;
      this.text(line, x + PAD, ty, w - PAD * 2, size, isBold, align, ink);
      ty += lineH;
    }
  }

  /** Draws one line whose top edge sits `top` points below the page top. */
  private text(
    value: string,
    x: number,
    top: number,
    width: number,
    size: number,
    isBold = false,
    align: Align = 'left',
    color: Color = grayscale(0),
  ) {
    const font = isBold ? this.bold : this.font;
    const t = clean(value);
    const tw = font.widthOfTextAtSize(t, size);
    const dx =
      align === 'center'
        ? (width - tw) / 2
        : align === 'right'
          ? width - tw
          : 0;
    this.page.drawText(t, {
      x: x + Math.max(0, dx),
      y: PAGE_H - top - size * 0.8,
      size,
      font,
      color,
    });
  }

  private wrap(text: string, font: PDFFont, size: number, width: number) {
    const out: string[] = [];
    for (const paragraph of clean(text).split('\n')) {
      let line = '';
      // Over-long tokens (e.g. sticker numbers) may break after a hyphen.
      const words = paragraph
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((w) =>
          font.widthOfTextAtSize(w, size) > width
            ? w.split(/(?<=-)/).map((part, i) => ({ part, joined: i > 0 }))
            : [{ part: w, joined: false }],
        );
      for (const { part: word, joined } of words) {
        const glue = joined ? '' : ' ';
        const next = line ? `${line}${glue}${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width || !line) {
          line = next;
        } else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }
}
