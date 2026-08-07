import { createHash } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

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

  renderTemplate(
    template: string,
    data: Record<string, unknown>,
  ): string {
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

  renderPdf(params: { title: string; body: string }): Buffer {
    const contentLines = [
      params.title,
      '',
      ...params.body.split(/\r?\n/),
    ].slice(0, 45);

    const bodyCommands = contentLines
      .map((line, index) => {
        const escaped = this.escapePdfText(line);
        const yOffset = index === 0 ? '0 0 Td' : '0 -16 Td';
        return `${yOffset} (${escaped}) Tj`;
      })
      .join('\n');

    const stream = `BT
/F1 12 Tf
50 760 Td
${bodyCommands}
ET`;

    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream
${stream}
endstream endobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;

    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n 
`;
    }

    pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

    return Buffer.from(pdf, 'utf8');
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

  private escapePdfText(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableSerialize(item)}`)
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
