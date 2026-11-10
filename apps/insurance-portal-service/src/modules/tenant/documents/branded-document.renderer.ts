import {
  Color,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  degrees,
  grayscale,
  rgb,
} from 'pdf-lib';
import * as QRCode from 'qrcode';
import type {
  BrandedDocument,
  DocBlock,
  DocColumn,
  DocField,
  DocSection,
  DocTone,
} from './branded-document';

/*
 * One renderer for every insurance document. A4 portrait, 18 mm margins,
 * Helvetica throughout (9 pt body, 8 pt labels, 16 pt title). Colours are
 * chosen so headings, header rows and badges stay distinct in black and
 * white: everything that carries meaning also has a border or weight.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 51; // 18 mm
const TOP = 40;
const FOOTER_H = 58;
const CONTENT_W = PAGE_W - MX * 2;

const DEFAULT_BRAND = rgb(0.075, 0.2, 0.38);
const INK = grayscale(0.1);
const MUTED = grayscale(0.38);
const RULE = grayscale(0.78);
const ZEBRA = grayscale(0.96);
const WHITE = rgb(1, 1, 1);

const SIZE = {
  body: 9,
  label: 8,
  small: 7,
  heading: 10,
  title: 16,
};
const LINE = 1.3;

const TONE: Record<DocTone, { fill: Color; ink: Color }> = {
  success: { fill: rgb(0.89, 0.96, 0.93), ink: rgb(0.08, 0.42, 0.26) },
  warning: { fill: rgb(0.99, 0.94, 0.85), ink: rgb(0.54, 0.29, 0.03) },
  danger: { fill: rgb(0.99, 0.91, 0.91), ink: rgb(0.71, 0.14, 0.09) },
  neutral: { fill: grayscale(0.93), ink: grayscale(0.25) },
};

/** Renders any branded insurance document as an A4 PDF. */
export async function renderBrandedDocument(
  doc: BrandedDocument,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${titleCase(doc.title)} ${doc.number}`.trim());
  pdf.setSubject(doc.subtitle);
  pdf.setAuthor(doc.issuerName || 'Insurance MAX');
  pdf.setCreator('Insurance MAX');
  pdf.setProducer('Insurance MAX');
  const qrs = new Map<string, PDFImage | null>();
  for (const section of doc.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'regulatory' && block.qr && !qrs.has(block.qr)) {
        qrs.set(block.qr, await embedQr(pdf, block.qr));
      }
    }
  }
  const layout = new Layout(
    pdf,
    await pdf.embedFont(StandardFonts.Helvetica),
    await pdf.embedFont(StandardFonts.HelveticaBold),
    await embedLogo(pdf, doc.issuerLogo),
    qrs,
    doc,
  );
  layout.render();
  return pdf.save();
}

class Layout {
  private page!: PDFPage;
  /** Distance from the top edge to the drawing cursor. */
  private y = 0;
  private readonly brand: Color;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly logo: PDFImage | null,
    private readonly qrs: Map<string, PDFImage | null>,
    private readonly d: BrandedDocument,
  ) {
    this.brand = hexColor(d.brandColor) ?? DEFAULT_BRAND;
  }

  render() {
    this.addPage(true);
    for (const section of this.d.sections) this.section(section);
    this.footers();
  }

  /* ----------------------------- pages ---------------------------------- */

  private addPage(first: boolean) {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.watermark();
    this.header(first);
  }

  private get bottom() {
    return PAGE_H - FOOTER_H;
  }

  /** Starts a new page when `height` does not fit; returns true if it did. */
  private ensure(height: number) {
    if (this.y + height <= this.bottom) return false;
    this.addPage(false);
    return true;
  }

  /**
   * Header on every page: logo left, company details right, then the
   * document title. The first page carries the full letterhead and the
   * document information band; later pages a compact version.
   */
  private header(first: boolean) {
    const maxLogoW = first ? 120 : 80;
    const maxLogoH = first ? 56 : 30;
    let logoH = 0;
    if (this.logo) {
      const scale = Math.min(
        maxLogoW / this.logo.width,
        maxLogoH / this.logo.height,
      );
      logoH = this.logo.height * scale;
      this.page.drawImage(this.logo, {
        x: MX,
        y: PAGE_H - TOP - logoH,
        width: this.logo.width * scale,
        height: logoH,
      });
    }
    const right = PAGE_W - MX;
    const blockW = CONTENT_W * (this.logo ? 0.62 : 1);
    let y = TOP;
    const nameSize = first ? 12 : 9.5;
    for (const line of this.wrap(
      this.d.issuerName,
      this.bold,
      nameSize,
      blockW,
    )) {
      const draw = this.logo ? this.textRight.bind(this) : this.text.bind(this);
      draw(
        line,
        this.logo ? right : MX,
        y + nameSize,
        nameSize,
        this.bold,
        this.brand,
      );
      y += nameSize + 3;
    }
    if (first) {
      for (const raw of this.d.issuerLines) {
        for (const line of this.wrap(
          raw,
          this.font,
          SIZE.small + 0.4,
          blockW,
        )) {
          if (this.logo)
            this.textRight(
              line,
              right,
              y + 7.4,
              SIZE.small + 0.4,
              this.font,
              MUTED,
            );
          else this.text(line, MX, y + 7.4, SIZE.small + 0.4, this.font, MUTED);
          y += 9.4;
        }
      }
    }
    y = Math.max(y, TOP + logoH) + 8;
    this.page.drawRectangle({
      x: MX,
      y: PAGE_H - y - 2,
      width: CONTENT_W,
      height: 2,
      color: this.brand,
    });
    y += 10;

    // Title row: document title + subtitle on the left, badge on the right.
    const titleSize = first ? SIZE.title : 11;
    this.text(
      this.d.title,
      MX,
      y + titleSize,
      titleSize,
      this.bold,
      this.brand,
    );
    const badgeW = this.d.badge ? this.badgeWidth(this.d.badge.text) : 0;
    if (this.d.badge) {
      this.badge(this.d.badge.text, this.d.badge.tone, right - badgeW, y + 1);
    }
    if (first) {
      y += titleSize + 4;
      for (const line of this.wrap(
        this.d.subtitle,
        this.bold,
        SIZE.body,
        CONTENT_W - badgeW - 12,
      )) {
        this.text(line, MX, y + SIZE.body, SIZE.body, this.bold, INK);
        y += SIZE.body * LINE;
      }
      this.y = y + 8;
      this.referenceBand();
    } else {
      const titleW = this.bold.widthOfTextAtSize(this.d.title, titleSize);
      this.text(
        this.d.number,
        MX + titleW + 10,
        y + titleSize - 0.5,
        SIZE.label,
        this.bold,
        MUTED,
      );
      this.y = y + titleSize + 6;
      this.hline(this.y, RULE, 0.6);
      this.y += 10;
    }
  }

  /** Document information band: label over value, three per row. */
  private referenceBand() {
    const fields = this.d.reference;
    if (!fields.length) return;
    const perRow = 3;
    const cellW = CONTENT_W / perRow;
    const rowH = 26;
    const rows = Math.ceil(fields.length / perRow);
    const h = rows * rowH + 6;
    this.page.drawRectangle({
      x: MX,
      y: PAGE_H - this.y - h,
      width: CONTENT_W,
      height: h,
      borderColor: RULE,
      borderWidth: 0.6,
      color: grayscale(0.975),
    });
    fields.forEach((field, i) => {
      const x = MX + (i % perRow) * cellW + 9;
      const top = this.y + 5 + Math.floor(i / perRow) * rowH;
      this.text(
        field.label.toUpperCase(),
        x,
        top + 8,
        SIZE.small,
        this.bold,
        MUTED,
      );
      const value = this.fit(field.value, this.bold, SIZE.body, cellW - 16);
      this.text(value, x, top + 20, SIZE.body, this.bold, INK);
    });
    this.y += h + 12;
  }

  private watermark() {
    const word = clean(this.d.watermark);
    if (!word) return;
    const size = Math.min(110, 560 / Math.max(1, word.length * 0.6));
    const w = this.bold.widthOfTextAtSize(word, size);
    const angle = Math.atan2(PAGE_H, PAGE_W);
    this.page.drawText(word, {
      x: PAGE_W / 2 - (Math.cos(angle) * w) / 2 + (Math.sin(angle) * size) / 3,
      y: PAGE_H / 2 - (Math.sin(angle) * w) / 2 - (Math.cos(angle) * size) / 3,
      size,
      font: this.bold,
      color: grayscale(0.5),
      opacity: 0.14,
      rotate: degrees((angle * 180) / Math.PI),
    });
  }

  /** Footers need the final page count, so they are drawn last. */
  private footers() {
    const pages = this.pdf.getPages();
    pages.forEach((page, i) => {
      this.page = page;
      const base = PAGE_H - FOOTER_H + 12;
      this.hline(base, RULE, 0.6);
      const pageLabel = `Page ${i + 1} of ${pages.length}`;
      const pageW = this.bold.widthOfTextAtSize(pageLabel, SIZE.small);
      this.text(
        this.fit(this.d.terms, this.font, SIZE.small, CONTENT_W),
        MX,
        base + 10,
        SIZE.small,
        this.font,
        MUTED,
      );
      this.text(
        this.fit(
          [this.d.issuerRegistration, this.d.issuerFooter]
            .filter(Boolean)
            .join('  |  '),
          this.font,
          SIZE.small,
          CONTENT_W - pageW - 16,
        ),
        MX,
        base + 20,
        SIZE.small,
        this.font,
        MUTED,
      );
      this.textRight(
        pageLabel,
        PAGE_W - MX,
        base + 20,
        SIZE.small,
        this.bold,
        INK,
      );
      this.text(
        `System generated document. ${titleCase(this.d.title)} ${this.d.number}, generated ${this.d.generatedAt}.`,
        MX,
        base + 30,
        SIZE.small - 0.4,
        this.font,
        MUTED,
      );
    });
  }

  /* ---------------------------- sections -------------------------------- */

  private section(section: DocSection) {
    if (section.pageBreakBefore) this.addPage(false);
    // Keep the heading with at least the start of its first block.
    this.ensure(26 + this.firstBlockMinHeight(section.blocks[0]));
    this.y += 4;
    this.text(
      section.title.toUpperCase(),
      MX,
      this.y + 10,
      SIZE.heading,
      this.bold,
      this.brand,
    );
    this.y += 14;
    this.hline(this.y, this.brand, 0.9);
    this.y += 7;
    for (const block of section.blocks) this.block(block);
    this.y += 8;
  }

  private firstBlockMinHeight(block: DocBlock | undefined) {
    if (!block) return 0;
    switch (block.kind) {
      case 'premium':
        return this.premiumHeight(block);
      case 'signatures':
        return 70;
      case 'regulatory':
        return 70;
      case 'table':
        return 38;
      default:
        return 24;
    }
  }

  private block(block: DocBlock) {
    switch (block.kind) {
      case 'fields':
        return this.fields(block.fields, block.columns);
      case 'subheading':
        this.ensure(30);
        this.y += 3;
        this.text(block.text, MX, this.y + 9, SIZE.body + 0.4, this.bold, INK);
        this.y += 14;
        return;
      case 'paragraph':
        return this.paragraph(block.text, MX, CONTENT_W);
      case 'bullets':
        for (const item of block.items) this.bullet(item);
        this.y += 3;
        return;
      case 'table':
        return this.table(block.columns, block.rows, block.totals);
      case 'premium':
        return this.premium(block);
      case 'regulatory':
        return this.regulatory(block.fields, block.qr);
      case 'signatures':
        return this.signatures(block.signatories, block.stamp);
      case 'stamp':
        return this.stamp(block.text, block.tone);
    }
  }

  /** Label/value grid in one or two columns; rows never split across pages. */
  private fields(
    fields: DocField[],
    columns: 1 | 2,
    width = CONTENT_W,
    x0 = MX,
  ) {
    const gap = 18;
    const colW = columns === 2 ? (width - gap) / 2 : width;
    const labelW = colW * (columns === 2 ? 0.4 : 0.3);
    const valueW = colW - labelW - 6;
    for (let i = 0; i < fields.length; i += columns) {
      const row = fields.slice(i, i + columns);
      const cells = row.map((f) => ({
        label: this.wrap(f.label, this.font, SIZE.label, labelW - 4),
        value: this.wrap(f.value, this.bold, SIZE.body, valueW),
      }));
      const lines = Math.max(
        ...cells.map((c) => Math.max(c.label.length, c.value.length)),
      );
      const h = lines * SIZE.body * LINE + 7;
      this.ensure(h);
      cells.forEach((cell, c) => {
        const x = x0 + c * (colW + gap);
        cell.label.forEach((line, n) =>
          this.text(
            line,
            x,
            this.y + 10 + n * SIZE.body * LINE,
            SIZE.label,
            this.font,
            MUTED,
          ),
        );
        cell.value.forEach((line, n) =>
          this.text(
            line,
            x + labelW,
            this.y + 10 + n * SIZE.body * LINE,
            SIZE.body,
            this.bold,
            INK,
          ),
        );
        this.page.drawLine({
          start: { x, y: PAGE_H - this.y - h + 1 },
          end: { x: x + colW, y: PAGE_H - this.y - h + 1 },
          thickness: 0.4,
          color: RULE,
        });
      });
      this.y += h;
    }
    this.y += 6;
  }

  private paragraph(value: string, x: number, width: number) {
    for (const para of value.split(/\n{2,}/)) {
      for (const line of this.wrap(para, this.font, SIZE.body, width)) {
        this.ensure(SIZE.body * LINE);
        this.text(line, x, this.y + SIZE.body, SIZE.body, this.font, INK);
        this.y += SIZE.body * LINE;
      }
      this.y += 4;
    }
  }

  private bullet(item: string) {
    const lines = this.wrap(item, this.font, SIZE.body, CONTENT_W - 14);
    // Short items stay together; long ones may continue on the next page.
    if (lines.length <= 4) this.ensure(lines.length * SIZE.body * LINE);
    lines.forEach((line, n) => {
      this.ensure(SIZE.body * LINE);
      if (n === 0) {
        this.page.drawCircle({
          x: MX + 4,
          y: PAGE_H - this.y - SIZE.body * 0.62,
          size: 1.5,
          color: this.brand,
        });
      }
      this.text(line, MX + 14, this.y + SIZE.body, SIZE.body, this.font, INK);
      this.y += SIZE.body * LINE;
    });
    this.y += 2;
  }

  /**
   * Table with a header row that repeats on every page it continues onto.
   * Rows are never split; long cell text wraps within its column.
   */
  private table(columns: DocColumn[], rows: string[][], totals?: string[]) {
    const scale = CONTENT_W / columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => c.width * scale);
    const size = SIZE.body - 0.5;
    const headerLines = columns.map((c, i) =>
      this.wrap(c.header, this.bold, SIZE.label, widths[i] - 8),
    );
    const headerH =
      Math.max(...headerLines.map((l) => l.length)) * SIZE.label * LINE + 8;
    const drawHeader = () => {
      this.page.drawRectangle({
        x: MX,
        y: PAGE_H - this.y - headerH,
        width: CONTENT_W,
        height: headerH,
        color: this.brand,
      });
      let x = MX;
      headerLines.forEach((lines, i) => {
        lines.forEach((line, n) =>
          this.cellText(
            line,
            x,
            widths[i],
            columns[i].align,
            this.y + 4 + SIZE.label + n * SIZE.label * LINE,
            SIZE.label,
            this.bold,
            WHITE,
          ),
        );
        x += widths[i];
      });
      this.y += headerH;
    };
    const rowHeight = (cells: string[][]) =>
      Math.max(1, ...cells.map((l) => l.length)) * size * LINE + 7;

    // Never leave a header orphaned at the foot of a page.
    this.ensure(headerH + rowHeight([[' ']]));
    drawHeader();
    rows.forEach((row, r) => {
      const cells = row.map((value, i) =>
        this.wrap(value, this.font, size, widths[i] - 8),
      );
      const h = rowHeight(cells);
      if (this.ensure(h)) drawHeader();
      if (r % 2 === 1) {
        this.page.drawRectangle({
          x: MX,
          y: PAGE_H - this.y - h,
          width: CONTENT_W,
          height: h,
          color: ZEBRA,
        });
      }
      let x = MX;
      cells.forEach((lines, i) => {
        lines.forEach((line, n) =>
          this.cellText(
            line,
            x,
            widths[i],
            columns[i].align,
            this.y + 4 + size + n * size * LINE,
            size,
            this.font,
            INK,
          ),
        );
        x += widths[i];
      });
      this.y += h;
      this.hline(this.y, RULE, 0.35);
    });
    if (totals) {
      const cells = totals.map((value, i) =>
        this.wrap(value, this.bold, size, widths[i] - 8),
      );
      const h = rowHeight(cells) + 2;
      if (this.ensure(h)) drawHeader();
      this.hline(this.y, this.brand, 1);
      let x = MX;
      cells.forEach((lines, i) => {
        lines.forEach((line, n) =>
          this.cellText(
            line,
            x,
            widths[i],
            columns[i].align,
            this.y + 5 + size + n * size * LINE,
            size,
            this.bold,
            INK,
          ),
        );
        x += widths[i];
      });
      this.y += h;
      this.hline(this.y, this.brand, 1);
    }
    this.y += 10;
  }

  private premiumHeight(block: Extract<DocBlock, { kind: 'premium' }>) {
    const words = block.words ? 26 : 0;
    return (block.lines.length + (block.after?.length ?? 0)) * 15 + 34 + words;
  }

  /** Totals box, right-aligned and kept together on one page. */
  private premium(block: Extract<DocBlock, { kind: 'premium' }>) {
    this.ensure(this.premiumHeight(block));
    const boxW = Math.min(CONTENT_W, 300);
    const x = PAGE_W - MX - boxW;
    const amountRight = PAGE_W - MX - 8;
    const size = SIZE.body;
    this.text(
      `Amounts in ${block.currency}`,
      MX,
      this.y + 10,
      SIZE.label,
      this.font,
      MUTED,
    );
    const line = (l: {
      label: string;
      amount: string;
      muted?: boolean;
      bold?: boolean;
    }) => {
      const color = l.muted ? MUTED : INK;
      const font = l.bold ? this.bold : this.font;
      this.text(
        this.fit(l.label, font, size, boxW - 110),
        x + 8,
        this.y + 10,
        size,
        font,
        color,
      );
      if (l.amount)
        this.textRight(
          l.amount,
          amountRight,
          this.y + 10,
          size,
          this.bold,
          color,
        );
      this.y += 15;
      this.page.drawLine({
        start: { x, y: PAGE_H - this.y + 1 },
        end: { x: PAGE_W - MX, y: PAGE_H - this.y + 1 },
        thickness: 0.35,
        color: RULE,
      });
    };
    block.lines.forEach(line);
    this.y += 3;
    // Total: brand border and bold type, so it reads in black and white too.
    const h = 22;
    this.page.drawRectangle({
      x,
      y: PAGE_H - this.y - h,
      width: boxW,
      height: h,
      color: this.brand,
    });
    this.text(block.totalLabel, x + 8, this.y + 14.5, 9.6, this.bold, WHITE);
    this.textRight(
      block.total,
      amountRight,
      this.y + 14.5,
      10.4,
      this.bold,
      WHITE,
    );
    this.y += h + 4;
    block.after?.forEach(line);
    if (block.words) {
      this.y += 3;
      for (const w of this.wrap(
        `Amount in words: ${block.words}`,
        this.bold,
        SIZE.label,
        CONTENT_W,
      )) {
        this.textRight(w, PAGE_W - MX, this.y + 9, SIZE.label, this.bold, INK);
        this.y += SIZE.label * LINE;
      }
    }
    this.y += 8;
  }

  /** Regulatory fields on the left, verification QR code on the right. */
  private regulatory(fields: DocField[], qr?: string) {
    const image = qr ? (this.qrs.get(qr) ?? null) : null;
    const qrSize = 72;
    const width = image ? CONTENT_W - qrSize - 18 : CONTENT_W;
    const start = this.y;
    this.ensure(image ? qrSize + 8 : 24);
    const top = this.y;
    this.fields(fields, 1, width);
    if (image) {
      this.page.drawImage(image, {
        x: PAGE_W - MX - qrSize,
        y: PAGE_H - top - qrSize,
        width: qrSize,
        height: qrSize,
      });
      this.textRight(
        'Scan to verify',
        PAGE_W - MX,
        top + qrSize + 9,
        SIZE.small,
        this.font,
        MUTED,
      );
      this.y = Math.max(this.y, top + qrSize + 14);
    }
    if (this.y === start) this.y += 4;
  }

  /** Signature lines side by side, with an optional company stamp box. */
  private signatures(
    signatories: { role: string; name?: string; title?: string }[],
    stamp?: boolean,
  ) {
    const slots = signatories.length + (stamp ? 1 : 0);
    if (!slots) return;
    const gap = 18;
    const w = (CONTENT_W - gap * (slots - 1)) / slots;
    const h = 64;
    this.ensure(h + 6);
    const top = this.y;
    signatories.forEach((s, i) => {
      const x = MX + i * (w + gap);
      const lineY = top + 34;
      this.page.drawLine({
        start: { x, y: PAGE_H - lineY },
        end: { x: x + w, y: PAGE_H - lineY },
        thickness: 0.6,
        color: INK,
      });
      this.text(s.role, x, lineY + 10, SIZE.label, this.bold, INK);
      const who = [s.name, s.title].filter(Boolean).join(', ');
      if (who)
        this.text(
          this.fit(who, this.font, SIZE.label, w),
          x,
          lineY + 20,
          SIZE.label,
          this.font,
          MUTED,
        );
    });
    if (stamp) {
      const x = MX + signatories.length * (w + gap);
      this.page.drawRectangle({
        x,
        y: PAGE_H - top - h + 8,
        width: w,
        height: h - 8,
        borderColor: RULE,
        borderWidth: 0.8,
        borderDashArray: [3, 2],
      });
      const label = 'Company stamp';
      this.text(
        label,
        x + (w - this.font.widthOfTextAtSize(label, SIZE.small)) / 2,
        top + h / 2 + 3,
        SIZE.small,
        this.font,
        MUTED,
      );
    }
    this.y = top + h + 6;
  }

  /** Rubber-stamp mark, e.g. PAID IN FULL; double border for grey prints. */
  private stamp(value: string, tone: DocTone) {
    const size = 15;
    const w = this.bold.widthOfTextAtSize(value, size) + 28;
    const h = 32;
    this.ensure(h + 10);
    const x = PAGE_W - MX - w;
    const color = TONE[tone].ink;
    this.page.drawRectangle({
      x,
      y: PAGE_H - this.y - h,
      width: w,
      height: h,
      borderColor: color,
      borderWidth: 2,
      rotate: degrees(0),
    });
    this.page.drawRectangle({
      x: x + 3,
      y: PAGE_H - this.y - h + 3,
      width: w - 6,
      height: h - 6,
      borderColor: color,
      borderWidth: 0.6,
    });
    this.text(value, x + 14, this.y + 21, size, this.bold, color);
    this.y += h + 10;
  }

  /* ---------------------------- primitives ------------------------------ */

  private badgeWidth(value: string) {
    return this.bold.widthOfTextAtSize(clean(value), SIZE.label) + 16;
  }

  /** Pill badge with a border so it survives black-and-white printing. */
  private badge(value: string, tone: DocTone, x: number, top: number) {
    const w = this.badgeWidth(value);
    const h = 16;
    const t = TONE[tone];
    this.page.drawRectangle({
      x,
      y: PAGE_H - top - h,
      width: w,
      height: h,
      color: t.fill,
      borderColor: t.ink,
      borderWidth: 0.8,
    });
    this.text(value, x + 8, top + 11, SIZE.label, this.bold, t.ink);
  }

  private text(
    value: string,
    x: number,
    top: number,
    size: number,
    font: PDFFont,
    color: Color = INK,
  ) {
    const s = clean(value);
    if (!s) return;
    this.page.drawText(s, { x, y: PAGE_H - top, size, font, color });
  }

  private textRight(
    value: string,
    right: number,
    top: number,
    size: number,
    font: PDFFont,
    color: Color = INK,
  ) {
    const s = clean(value);
    this.text(
      s,
      right - font.widthOfTextAtSize(s, size),
      top,
      size,
      font,
      color,
    );
  }

  private cellText(
    value: string,
    x: number,
    width: number,
    align: DocColumn['align'],
    top: number,
    size: number,
    font: PDFFont,
    color: Color,
  ) {
    const w = font.widthOfTextAtSize(clean(value), size);
    const left =
      align === 'right'
        ? x + width - 4 - w
        : align === 'center'
          ? x + (width - w) / 2
          : x + 4;
    this.text(value, left, top, size, font, color);
  }

  private hline(top: number, color: Color, thickness: number) {
    this.page.drawLine({
      start: { x: MX, y: PAGE_H - top },
      end: { x: PAGE_W - MX, y: PAGE_H - top },
      thickness,
      color,
    });
  }

  /** Truncates a single line with an ellipsis to fit `width`. */
  private fit(value: string, font: PDFFont, size: number, width: number) {
    let s = clean(value);
    if (font.widthOfTextAtSize(s, size) <= width) return s;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > width)
      s = s.slice(0, -1);
    return `${s.trimEnd()}...`;
  }

  /** Word-wraps text to `width`, breaking words longer than a line. */
  wrap(value: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) out.push(line);
        line = word;
        while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
          let cut = line.length - 1;
          while (
            cut > 1 &&
            font.widthOfTextAtSize(line.slice(0, cut), size) > width
          )
            cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      if (line || !out.length) out.push(line);
    }
    return out;
  }
}

/* ------------------------------------------------------------------------ */
/* Helpers shared with the builders                                          */
/* ------------------------------------------------------------------------ */

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function hexColor(value: string | undefined): Color | null {
  const m = value && /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!m) return null;
  return rgb(
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255,
  );
}

async function embedQr(pdf: PDFDocument, text: string) {
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

/** Embeds a PNG or JPEG logo; returns null for anything else. */
export async function embedLogo(pdf: PDFDocument, bytes: Uint8Array | null) {
  if (!bytes || bytes.length < 4) return null;
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50)
      return await pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8)
      return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
  return null;
}

/**
 * Standard PDF fonts only encode WinAnsi; replace the characters that commonly
 * appear in stored data and drop anything else that cannot be drawn.
 */
export function clean(value: string) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, '');
}
