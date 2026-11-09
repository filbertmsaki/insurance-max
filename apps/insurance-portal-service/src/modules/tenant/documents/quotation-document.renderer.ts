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
import { clean, embedLogo } from './motor-schedule.renderer';
import type {
  DocBlock,
  DocColumn,
  DocField,
  DocSection,
  QuotationDocument,
} from './quotation-document.model';

/* A4 portrait, points. */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 40;
const TOP = 36;
const FOOTER_H = 46;
const CONTENT_W = PAGE_W - MX * 2;

/* Corporate palette; every colour stays distinct when printed in grey. */
const BRAND = rgb(0.075, 0.2, 0.38);
const BRAND_TINT = rgb(0.91, 0.94, 0.97);
const INK = grayscale(0.12);
const MUTED = grayscale(0.42);
const RULE = grayscale(0.78);
const ZEBRA = grayscale(0.965);

const SIZE = { body: 8.4, label: 7.4, small: 6.8, heading: 9.6 };
const LINE = 1.32;

/** Renders the customer-facing quotation document as an A4 PDF. */
export async function renderQuotationDocument(
  doc: QuotationDocument,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Insurance Quotation ${doc.quotationNo}`);
  pdf.setSubject(doc.subtitle);
  pdf.setAuthor(doc.issuerName || 'Insurance MAX');
  pdf.setCreator('Insurance MAX');
  pdf.setProducer('Insurance MAX');
  const layout = new Layout(
    pdf,
    await pdf.embedFont(StandardFonts.Helvetica),
    await pdf.embedFont(StandardFonts.HelveticaBold),
    await embedLogo(pdf, doc.issuerLogo),
    doc,
  );
  layout.render();
  return pdf.save();
}

class Layout {
  private page!: PDFPage;
  /** Distance from the top edge to the drawing cursor. */
  private y = 0;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly logo: PDFImage | null,
    private readonly d: QuotationDocument,
  ) {}

  render() {
    this.addPage(true);
    for (const section of this.d.sections) this.section(section);
    this.footers();
  }

  /* ----------------------------- pages ---------------------------------- */

  private addPage(first: boolean) {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.watermark();
    if (first) this.letterhead();
    else this.runningHeader();
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

  private letterhead() {
    let top = TOP;
    let textX = MX;
    if (this.logo) {
      const scale = Math.min(110 / this.logo.width, 54 / this.logo.height);
      const w = this.logo.width * scale;
      const h = this.logo.height * scale;
      this.page.drawImage(this.logo, {
        x: MX,
        y: PAGE_H - top - h,
        width: w,
        height: h,
      });
      textX = MX + w + 12;
    }
    // Issuer block on the left, document title on the right.
    const titleW = 190;
    const issuerW = PAGE_W - MX - titleW - textX - 8;
    let y = top;
    for (const line of this.wrap(this.d.issuerName, this.bold, 12, issuerW)) {
      this.text(line, textX, y + 10, 12, this.bold, BRAND);
      y += 14;
    }
    for (const raw of this.d.issuerLines) {
      for (const line of this.wrap(raw, this.font, SIZE.small, issuerW)) {
        this.text(line, textX, y + 7, SIZE.small, this.font, MUTED);
        y += 8.6;
      }
    }
    const right = PAGE_W - MX;
    this.textRight(this.d.title, right, top + 14, 15, this.bold, BRAND);
    let ty = top + 28;
    for (const line of this.wrap(this.d.subtitle, this.bold, 8.6, titleW)) {
      this.textRight(line, right, ty, 8.6, this.bold, INK);
      ty += 11;
    }
    const logoBottom = this.logo
      ? top +
        Math.min(
          54,
          this.logo.height *
            Math.min(110 / this.logo.width, 54 / this.logo.height),
        )
      : top;
    top = Math.max(y, ty, logoBottom) + 8;
    this.page.drawRectangle({
      x: MX,
      y: PAGE_H - top - 2,
      width: CONTENT_W,
      height: 2,
      color: BRAND,
    });
    this.y = top + 10;
    this.referenceBand();
  }

  /** Quotation reference band: label over value, three per row. */
  private referenceBand() {
    const fields = this.d.reference;
    if (!fields.length) return;
    const perRow = 3;
    const cellW = CONTENT_W / perRow;
    const rows = Math.ceil(fields.length / perRow);
    const rowH = 25;
    const h = rows * rowH + 6;
    this.page.drawRectangle({
      x: MX,
      y: PAGE_H - this.y - h,
      width: CONTENT_W,
      height: h,
      color: BRAND_TINT,
      borderColor: RULE,
      borderWidth: 0.5,
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
      const value = this.fit(field.value, this.bold, 9, cellW - 16);
      this.text(value, x, top + 19, 9, this.bold, INK);
    });
    this.y += h + 12;
  }

  private runningHeader() {
    const y = TOP + 8;
    this.text(this.d.issuerName, MX, y, SIZE.label, this.bold, BRAND);
    this.textRight(
      `Insurance Quotation  ${this.d.quotationNo}`,
      PAGE_W - MX,
      y,
      SIZE.label,
      this.bold,
      MUTED,
    );
    this.hline(y + 5, RULE, 0.6);
    this.y = y + 16;
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
      color: grayscale(0.55),
      opacity: 0.13,
      rotate: degrees((angle * 180) / Math.PI),
    });
  }

  /** Page footers need the final page count, so they are drawn last. */
  private footers() {
    const pages = this.pdf.getPages();
    pages.forEach((page, i) => {
      this.page = page;
      const base = PAGE_H - FOOTER_H + 14;
      this.hline(base, RULE, 0.6);
      this.text(
        this.fit(this.d.issuerFooter, this.font, SIZE.small, CONTENT_W - 150),
        MX,
        base + 11,
        SIZE.small,
        this.font,
        MUTED,
      );
      this.textRight(
        `Quotation ${this.d.quotationNo}   |   Page ${i + 1} of ${pages.length}`,
        PAGE_W - MX,
        base + 11,
        SIZE.small,
        this.bold,
        MUTED,
      );
      this.text(
        `Generated ${this.d.generatedAt}. This document is a quotation, not a policy or cover note.`,
        MX,
        base + 21,
        SIZE.small - 0.6,
        this.font,
        MUTED,
      );
    });
  }

  /* ---------------------------- sections -------------------------------- */

  private section(section: DocSection) {
    if (section.pageBreakBefore) this.addPage(false);
    // Keep the heading with at least the start of its first block.
    this.ensure(24 + this.firstBlockMinHeight(section.blocks[0]));
    this.y += 4;
    this.text(
      section.title.toUpperCase(),
      MX,
      this.y + 9,
      SIZE.heading,
      this.bold,
      BRAND,
    );
    this.y += 13;
    this.hline(this.y, BRAND, 0.9);
    this.y += 7;
    for (const block of section.blocks) this.block(block);
    this.y += 8;
  }

  private firstBlockMinHeight(block: DocBlock | undefined) {
    if (!block) return 0;
    if (block.kind === 'premium') return this.premiumHeight(block);
    if (block.kind === 'table') return 36;
    return 22;
  }

  private block(block: DocBlock) {
    switch (block.kind) {
      case 'fields':
        return this.fields(block.fields, block.columns);
      case 'subheading':
        this.ensure(30);
        this.y += 3;
        this.text(block.text, MX, this.y + 8, SIZE.body + 0.4, this.bold, INK);
        this.y += 13;
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
    }
  }

  /** Label/value grid in one or two columns; rows never split across pages. */
  private fields(fields: DocField[], columns: 1 | 2) {
    const gap = 16;
    const colW = columns === 2 ? (CONTENT_W - gap) / 2 : CONTENT_W;
    const labelW = colW * (columns === 2 ? 0.4 : 0.3);
    const valueW = colW - labelW - 6;
    for (let i = 0; i < fields.length; i += columns) {
      const row = fields.slice(i, i + columns);
      const cells = row.map((f) => ({
        label: this.wrap(f.label, this.bold, SIZE.label, labelW - 4),
        value: this.wrap(f.value, this.font, SIZE.body, valueW),
      }));
      const lines = Math.max(
        ...cells.map((c) => Math.max(c.label.length, c.value.length)),
      );
      const h = lines * SIZE.body * LINE + 7;
      this.ensure(h);
      cells.forEach((cell, c) => {
        const x = MX + c * (colW + gap);
        cell.label.forEach((line, n) =>
          this.text(
            line,
            x,
            this.y + 9 + n * SIZE.body * LINE,
            SIZE.label,
            this.bold,
            MUTED,
          ),
        );
        cell.value.forEach((line, n) =>
          this.text(
            line,
            x + labelW,
            this.y + 9 + n * SIZE.body * LINE,
            SIZE.body,
            this.font,
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
          size: 1.4,
          color: BRAND,
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
    const size = SIZE.body - 0.4;
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
        color: BRAND,
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
            rgb(1, 1, 1),
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
      this.page.drawRectangle({
        x: MX,
        y: PAGE_H - this.y - h,
        width: CONTENT_W,
        height: h,
        color: BRAND_TINT,
      });
      this.hline(this.y, BRAND, 0.9);
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
    }
    this.y += 9;
  }

  private premiumHeight(block: Extract<DocBlock, { kind: 'premium' }>) {
    return block.lines.length * 15 + 30;
  }

  /** Premium summary, kept together on one page. */
  private premium(block: Extract<DocBlock, { kind: 'premium' }>) {
    this.ensure(this.premiumHeight(block));
    const boxW = Math.min(CONTENT_W, 340);
    const x = PAGE_W - MX - boxW;
    const amountRight = PAGE_W - MX - 10;
    this.text(
      `Amounts in ${block.currency}`,
      MX,
      this.y + 9,
      SIZE.label,
      this.font,
      MUTED,
    );
    for (const line of block.lines) {
      const color = line.muted ? MUTED : INK;
      this.text(
        this.fit(line.label, this.font, SIZE.body + 0.4, boxW - 120),
        x + 10,
        this.y + 10,
        SIZE.body + 0.4,
        this.font,
        color,
      );
      if (line.amount)
        this.textRight(
          line.amount,
          amountRight,
          this.y + 10,
          SIZE.body + 0.4,
          this.font,
          color,
        );
      this.y += 15;
      this.page.drawLine({
        start: { x, y: PAGE_H - this.y + 1 },
        end: { x: PAGE_W - MX, y: PAGE_H - this.y + 1 },
        thickness: 0.35,
        color: RULE,
      });
    }
    this.y += 3;
    const h = 22;
    this.page.drawRectangle({
      x,
      y: PAGE_H - this.y - h,
      width: boxW,
      height: h,
      color: BRAND,
    });
    const white = rgb(1, 1, 1);
    this.text(block.totalLabel, x + 10, this.y + 14.5, 9.6, this.bold, white);
    this.textRight(
      block.total,
      amountRight,
      this.y + 14.5,
      10.4,
      this.bold,
      white,
    );
    this.y += h + 8;
  }

  /* ---------------------------- primitives ------------------------------ */

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
