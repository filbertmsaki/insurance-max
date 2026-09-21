import { createHash } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage, RGB } from 'pdf-lib';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;
const TITLE_SIZE = 16;
const HEADER_RESERVE = 42;
const FOOTER_RESERVE = 34;

export interface RenderedPdf {
  buffer: Buffer;
  pageCount: number;
  layoutReview: {
    status: 'PASSED' | 'WARNINGS';
    warnings: string[];
    engine: string;
  };
}

interface RenderStyle {
  margin: number;
  fontSize: number;
  lineHeight: number;
  titleSize: number;
  headingSize: number;
  smallSize: number;
  primaryColor: RGB;
  mutedColor: RGB;
}

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
}

interface DrawContext {
  doc: PDFDocument;
  fonts: FontSet;
  page: PDFPage;
  style: RenderStyle;
  cursorY: number;
  warnings: string[];
}

@Injectable()
export class DocumentRenderService {
  validateVariableSchema(
    schema: Record<string, unknown> | null | undefined,
    data: Record<string, unknown>,
  ) {
    if (!schema || typeof schema !== 'object') {
      return;
    }

    this.validateSchemaNode(schema, data, '');
  }

  renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, path) => {
      const value = this.getValueByPath(data, path);

      if (value === null || value === undefined) {
        return '';
      }

      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  hashDefinition(value: unknown): string {
    return createHash('sha256')
      .update(this.stableSerialize(value))
      .digest('hex');
  }

  async renderPdf(params: {
    title: string;
    body: string;
    header?: string | null;
    footer?: string | null;
    stylesheet?: string | null;
  }): Promise<RenderedPdf> {
    const doc = await PDFDocument.create();
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    const style = this.resolveStyle(params.stylesheet);
    const warnings: string[] = [];
    const context: DrawContext = {
      doc,
      fonts,
      page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
      style,
      cursorY: this.firstContentY(style, params.header),
      warnings,
    };

    this.drawWrappedText(context, {
      text: params.title,
      x: style.margin,
      maxWidth: PAGE_WIDTH - style.margin * 2,
      font: fonts.bold,
      size: style.titleSize,
      color: rgb(0.05, 0.08, 0.12),
    });
    context.cursorY -= style.lineHeight;

    const lines = params.body.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (this.isTableLine(line)) {
        const tableLines: string[] = [];
        while (index < lines.length && this.isTableLine(lines[index])) {
          tableLines.push(lines[index]);
          index += 1;
        }
        index -= 1;
        this.drawTable(context, tableLines);
        continue;
      }

      this.drawBodyLine(context, line);
    }

    const pageCount = doc.getPageCount();
    doc.getPages().forEach((page, index) => {
      this.drawChrome(page, {
        fonts,
        style,
        title: params.title,
        header: params.header,
        footer: params.footer,
        pageNumber: index + 1,
        pageCount,
      });
    });

    return {
      buffer: Buffer.from(await doc.save()),
      pageCount,
      layoutReview: {
        status: warnings.length > 0 ? 'WARNINGS' : 'PASSED',
        warnings,
        engine: 'pdf-lib-text-template-v2',
      },
    };
  }

  private drawBodyLine(context: DrawContext, line: string) {
    const trimmed = line.trim();
    const maxWidth = PAGE_WIDTH - context.style.margin * 2;

    if (!trimmed) {
      context.cursorY -= context.style.lineHeight * 0.6;
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      context.cursorY -= context.style.lineHeight * 0.35;
      this.drawWrappedText(context, {
        text: heading[2],
        x: context.style.margin,
        maxWidth,
        font: context.fonts.bold,
        size: heading[1].length === 1 ? context.style.headingSize : 12,
        color: context.style.primaryColor,
      });
      context.cursorY -= context.style.lineHeight * 0.25;
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      this.drawWrappedText(context, {
        text: `- ${bullet[1]}`,
        x: context.style.margin + 12,
        maxWidth: maxWidth - 12,
        font: context.fonts.regular,
        size: context.style.fontSize,
        color: rgb(0.08, 0.1, 0.14),
      });
      return;
    }

    this.drawWrappedText(context, {
      text: trimmed,
      x: context.style.margin,
      maxWidth,
      font: context.fonts.regular,
      size: context.style.fontSize,
      color: rgb(0.08, 0.1, 0.14),
    });
  }

  private drawWrappedText(
    context: DrawContext,
    params: {
      text: string;
      x: number;
      maxWidth: number;
      font: PDFFont;
      size: number;
      color: RGB;
    },
  ) {
    const lines = this.wrapLine(
      params.text,
      params.font,
      params.size,
      params.maxWidth,
      context.warnings,
    );

    for (const line of lines) {
      this.ensureVerticalSpace(context, context.style.lineHeight);
      context.page.drawText(line, {
        x: params.x,
        y: context.cursorY,
        size: params.size,
        font: params.font,
        color: params.color,
      });
      context.cursorY -= context.style.lineHeight;
    }
  }

  private drawTable(context: DrawContext, tableLines: string[]) {
    const rows = tableLines
      .map((line) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim()),
      )
      .filter(
        (cells) =>
          !cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, ''))),
      );

    if (!rows.length) {
      return;
    }

    const columnCount = Math.max(...rows.map((row) => row.length));
    const tableWidth = PAGE_WIDTH - context.style.margin * 2;
    const columnWidth = tableWidth / columnCount;
    const rowHeight = context.style.lineHeight * 1.6;

    for (const [rowIndex, row] of rows.entries()) {
      this.ensureVerticalSpace(context, rowHeight + 4);

      const y = context.cursorY - rowHeight + 6;
      const fillColor = rowIndex === 0 ? rgb(0.94, 0.96, 0.98) : rgb(1, 1, 1);
      context.page.drawRectangle({
        x: context.style.margin,
        y,
        width: tableWidth,
        height: rowHeight,
        color: fillColor,
        borderColor: rgb(0.82, 0.86, 0.9),
        borderWidth: 0.5,
      });

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const text = row[columnIndex] ?? '';
        const x = context.style.margin + columnWidth * columnIndex + 6;
        const cellLines = this.wrapLine(
          text,
          rowIndex === 0 ? context.fonts.bold : context.fonts.regular,
          context.style.smallSize,
          columnWidth - 12,
          context.warnings,
        ).slice(0, 2);

        cellLines.forEach((cellLine, lineIndex) => {
          context.page.drawText(cellLine, {
            x,
            y: context.cursorY - 10 - lineIndex * (context.style.smallSize + 2),
            size: context.style.smallSize,
            font: rowIndex === 0 ? context.fonts.bold : context.fonts.regular,
            color: rgb(0.08, 0.1, 0.14),
          });
        });
      }

      context.cursorY -= rowHeight;
    }

    context.cursorY -= context.style.lineHeight * 0.5;
  }

  private drawChrome(
    page: PDFPage,
    params: {
      fonts: FontSet;
      style: RenderStyle;
      title: string;
      header?: string | null;
      footer?: string | null;
      pageNumber: number;
      pageCount: number;
    },
  ) {
    const { style, fonts } = params;
    const headerText = this.interpolatePageTokens(
      params.header || params.title,
      params.pageNumber,
      params.pageCount,
    );
    const footerText = this.interpolatePageTokens(
      params.footer || 'Page {{page_number}} of {{page_count}}',
      params.pageNumber,
      params.pageCount,
    );

    page.drawText(headerText, {
      x: style.margin,
      y: PAGE_HEIGHT - style.margin + 12,
      size: style.smallSize,
      font: fonts.bold,
      color: style.mutedColor,
    });
    page.drawLine({
      start: { x: style.margin, y: PAGE_HEIGHT - style.margin },
      end: { x: PAGE_WIDTH - style.margin, y: PAGE_HEIGHT - style.margin },
      thickness: 0.5,
      color: rgb(0.82, 0.86, 0.9),
    });
    page.drawLine({
      start: { x: style.margin, y: style.margin - 8 },
      end: { x: PAGE_WIDTH - style.margin, y: style.margin - 8 },
      thickness: 0.5,
      color: rgb(0.82, 0.86, 0.9),
    });
    page.drawText(footerText, {
      x: style.margin,
      y: style.margin - 26,
      size: style.smallSize,
      font: fonts.regular,
      color: style.mutedColor,
    });
  }

  private ensureVerticalSpace(context: DrawContext, height: number) {
    const bottom = context.style.margin + FOOTER_RESERVE;
    if (context.cursorY - height >= bottom) {
      return;
    }

    context.page = context.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    context.cursorY = this.contentStartY(context.style);
  }

  private wrapLine(
    line: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number,
    warnings: string[] = [],
  ): string[] {
    if (!line.length) {
      return [''];
    }

    const words = line.split(/\s+/);
    const wrapped: string[] = [];
    let current = '';

    for (const word of words) {
      const safeWords =
        font.widthOfTextAtSize(word, fontSize) > maxWidth
          ? this.breakLongWord(word, font, fontSize, maxWidth, warnings)
          : [word];

      for (const safeWord of safeWords) {
        const candidate = current ? `${current} ${safeWord}` : safeWord;

        if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && current) {
          wrapped.push(current);
          current = safeWord;
        } else {
          current = candidate;
        }
      }
    }

    if (current) {
      wrapped.push(current);
    }

    return wrapped;
  }

  private breakLongWord(
    word: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number,
    warnings: string[],
  ): string[] {
    const parts: string[] = [];
    let current = '';

    for (const character of word) {
      if (font.widthOfTextAtSize(current + character, fontSize) > maxWidth) {
        if (current) {
          parts.push(current);
        }
        current = character;
      } else {
        current += character;
      }
    }

    if (current) {
      parts.push(current);
    }

    warnings.push(`Long unbroken text was wrapped in ${parts.length} parts.`);
    return parts;
  }

  private isTableLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
  }

  private resolveStyle(stylesheet: string | null | undefined): RenderStyle {
    const defaults: RenderStyle = {
      margin: MARGIN,
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      titleSize: TITLE_SIZE,
      headingSize: 14,
      smallSize: 9,
      primaryColor: rgb(0.1, 0.22, 0.42),
      mutedColor: rgb(0.38, 0.45, 0.53),
    };

    if (!stylesheet?.trim()) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(stylesheet) as Record<string, unknown>;
      return {
        ...defaults,
        margin: this.numberInRange(parsed.margin, 36, 90, defaults.margin),
        fontSize: this.numberInRange(parsed.fontSize, 8, 14, defaults.fontSize),
        lineHeight: this.numberInRange(
          parsed.lineHeight,
          12,
          22,
          defaults.lineHeight,
        ),
        titleSize: this.numberInRange(
          parsed.titleSize,
          14,
          24,
          defaults.titleSize,
        ),
        headingSize: this.numberInRange(
          parsed.headingSize,
          12,
          20,
          defaults.headingSize,
        ),
        smallSize: this.numberInRange(
          parsed.smallSize,
          7,
          11,
          defaults.smallSize,
        ),
        primaryColor: this.parseRgb(parsed.primaryColor, defaults.primaryColor),
        mutedColor: this.parseRgb(parsed.mutedColor, defaults.mutedColor),
      };
    } catch {
      return defaults;
    }
  }

  private numberInRange(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(maximum, Math.max(minimum, numeric));
  }

  private parseRgb(value: unknown, fallback: RGB): RGB {
    if (!Array.isArray(value) || value.length !== 3) {
      return fallback;
    }

    const [red, green, blue] = value.map((channel) =>
      this.numberInRange(channel, 0, 1, 0),
    );
    return rgb(red, green, blue);
  }

  private firstContentY(style: RenderStyle, header?: string | null) {
    return this.contentStartY(style) - (header ? 0 : HEADER_RESERVE * 0.3);
  }

  private contentStartY(style: RenderStyle) {
    return PAGE_HEIGHT - style.margin - HEADER_RESERVE;
  }

  private interpolatePageTokens(
    text: string,
    pageNumber: number,
    pageCount: number,
  ) {
    return text
      .replace(/{{\s*page_number\s*}}/g, String(pageNumber))
      .replace(/{{\s*page_count\s*}}/g, String(pageCount));
  }

  private validateSchemaNode(
    schema: Record<string, unknown>,
    data: Record<string, unknown>,
    path: string,
  ) {
    const required = Array.isArray(schema.required)
      ? (schema.required as string[])
      : [];
    const properties =
      schema.properties && typeof schema.properties === 'object'
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : {};

    for (const key of required) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = this.getValueByPath(data, fullPath);

      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(
          `Missing required template variable: ${fullPath}`,
        );
      }
    }

    for (const [key, nestedSchema] of Object.entries(properties)) {
      const fullPath = path ? `${path}.${key}` : key;
      const nestedValue = this.getValueByPath(data, fullPath);

      if (
        nestedValue &&
        typeof nestedValue === 'object' &&
        nestedSchema &&
        typeof nestedSchema === 'object'
      ) {
        this.validateSchemaNode(
          nestedSchema,
          nestedValue as Record<string, unknown>,
          '',
        );
      }
    }
  }

  private getValueByPath(
    value: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, value);
  }

  private stableSerialize(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([left], [right]) => left.localeCompare(right),
      );

      return `{${entries
        .map(
          ([key, item]) =>
            `${JSON.stringify(key)}:${this.stableSerialize(item)}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
