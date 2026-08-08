import { createHash } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;
const TITLE_SIZE = 16;

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

  async renderPdf(params: { title: string; body: string }): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const maxTextWidth = PAGE_WIDTH - MARGIN * 2;

    const wrappedLines = params.body
      .split(/\r?\n/)
      .flatMap((line) => this.wrapLine(line, font, FONT_SIZE, maxTextWidth));

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    page.drawText(params.title, {
      x: MARGIN,
      y: cursorY,
      size: TITLE_SIZE,
      font: boldFont,
    });
    cursorY -= TITLE_SIZE + LINE_HEIGHT;

    for (const line of wrappedLines) {
      if (cursorY < MARGIN) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
      }

      if (line.length) {
        page.drawText(line, { x: MARGIN, y: cursorY, size: FONT_SIZE, font });
      }

      cursorY -= LINE_HEIGHT;
    }

    return Buffer.from(await doc.save());
  }

  private wrapLine(
    line: string,
    font: import('pdf-lib').PDFFont,
    fontSize: number,
    maxWidth: number,
  ): string[] {
    if (!line.length) {
      return [''];
    }

    const words = line.split(' ');
    const wrapped: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) {
      wrapped.push(current);
    }

    return wrapped;
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
