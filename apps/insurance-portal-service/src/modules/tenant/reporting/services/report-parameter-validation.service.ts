import { Injectable, BadRequestException } from '@nestjs/common';
import type { ReportParameterDefinition } from '@insurance-max/contracts';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';

import { ReportDefinition } from '../entities/report-definition.entity';

interface ValidationResult {
  parameters: Record<string, unknown>;
  parameterHash: string;
  sensitiveKeys: string[];
}

@Injectable()
export class ReportParameterValidationService {
  validate(
    definition: ReportDefinition,
    payload: Record<string, unknown> | null | undefined,
  ): ValidationResult {
    const schema = definition.parameters ?? [];
    const rawPayload = this.ensurePlainObject(payload ?? {});
    const defaults = this.ensurePlainObject(definition.default_filters ?? {});
    const allowedKeys = new Set(schema.map((item) => item.key));

    for (const key of Object.keys(rawPayload)) {
      if (!allowedKeys.has(key)) {
        throw new BadRequestException(
          `Unknown report parameter "${key}" for ${definition.code}`,
        );
      }
    }

    const parameters: Record<string, unknown> = {};
    const sensitiveKeys: string[] = [];

    for (const item of schema) {
      const candidate =
        rawPayload[item.key] !== undefined
          ? rawPayload[item.key]
          : defaults[item.key] !== undefined
            ? defaults[item.key]
            : item.defaultValue;

      if (candidate === undefined || candidate === null || candidate === '') {
        if (item.required) {
          throw new BadRequestException(
            `Missing required report parameter "${item.key}"`,
          );
        }
        continue;
      }

      const normalized = this.normalizeValue(item, candidate);
      parameters[item.key] = normalized;
      if (item.sensitive) {
        sensitiveKeys.push(item.key);
      }
    }

    return {
      parameters,
      parameterHash: this.computeHash(parameters),
      sensitiveKeys,
    };
  }

  computeDefinitionHash(definition: ReportDefinition): string {
    const payload = {
      code: definition.code,
      version: definition.version ?? 1,
      category: definition.category ?? null,
      supportedFormats: definition.supported_formats ?? [],
      sensitivity: definition.sensitivity ?? null,
      permission: definition.permission ?? null,
      maximumRows: definition.maximum_rows ?? definition.max_rows ?? null,
      asynchronousOnly: definition.asynchronous_only ?? false,
      parameters: definition.parameters ?? [],
    };

    return this.computeHash(payload);
  }

  private normalizeValue(
    definition: ReportParameterDefinition,
    value: unknown,
  ): unknown {
    switch (definition.dataType) {
      case 'STRING':
        return this.normalizeString(definition, value);
      case 'NUMBER':
        return this.normalizeNumber(definition, value);
      case 'BOOLEAN':
        return this.normalizeBoolean(value);
      case 'DATE':
        return this.normalizeDate(value, definition.key);
      case 'DATE_RANGE':
        return this.normalizeDateRange(value, definition.key);
      case 'ENUM':
        return this.normalizeEnum(definition, value);
      case 'UUID':
        return this.normalizeUuid(value, definition.key);
      case 'UUID_ARRAY':
        return this.normalizeUuidArray(value, definition.key);
      default:
        return value;
    }
  }

  private normalizeString(
    definition: ReportParameterDefinition,
    value: unknown,
  ): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        `Report parameter "${definition.key}" must be a string`,
      );
    }

    return value.trim();
  }

  private normalizeNumber(
    definition: ReportParameterDefinition,
    value: unknown,
  ): number {
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      throw new BadRequestException(
        `Report parameter "${definition.key}" must be numeric`,
      );
    }

    if (definition.minimum !== undefined && numeric < definition.minimum) {
      throw new BadRequestException(
        `Report parameter "${definition.key}" must be >= ${definition.minimum}`,
      );
    }

    if (definition.maximum !== undefined && numeric > definition.maximum) {
      throw new BadRequestException(
        `Report parameter "${definition.key}" must be <= ${definition.maximum}`,
      );
    }

    return numeric;
  }

  private normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    throw new BadRequestException(
      'Boolean report parameter must be true/false',
    );
  }

  private normalizeDate(value: unknown, key: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`Report parameter "${key}" must be a date`);
    }

    const normalized = value.trim();
    const parsed = DateTime.fromISO(normalized, { zone: 'utc' });
    if (!parsed.isValid || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(
        `Report parameter "${key}" must be an ISO date (YYYY-MM-DD)`,
      );
    }

    return normalized;
  }

  private normalizeDateRange(
    value: unknown,
    key: string,
  ): { from: string; to: string } {
    if (Array.isArray(value) && value.length === 2) {
      return {
        from: this.normalizeDate(value[0], `${key}.from`),
        to: this.normalizeDate(value[1], `${key}.to`),
      };
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'from' in value &&
      'to' in value
    ) {
      return {
        from: this.normalizeDate(value.from, `${key}.from`),
        to: this.normalizeDate(value.to, `${key}.to`),
      };
    }

    throw new BadRequestException(
      `Report parameter "${key}" must be a date range`,
    );
  }

  private normalizeEnum(
    definition: ReportParameterDefinition,
    value: unknown,
  ): string {
    const normalized = this.normalizeString(definition, value);
    const allowedValues = (definition.allowedValues ?? []).map(
      (item) => item.value,
    );

    if (allowedValues.length > 0 && !allowedValues.includes(normalized)) {
      throw new BadRequestException(
        `Report parameter "${definition.key}" must be one of: ${allowedValues.join(', ')}`,
      );
    }

    return normalized;
  }

  private normalizeUuid(value: unknown, key: string): string {
    if (typeof value !== 'string' || !this.isUuid(value.trim())) {
      throw new BadRequestException(`Report parameter "${key}" must be a UUID`);
    }

    return value.trim();
  }

  private normalizeUuidArray(value: unknown, key: string): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(
        `Report parameter "${key}" must be an array of UUIDs`,
      );
    }

    return value.map((item, index) =>
      this.normalizeUuid(item, `${key}[${index}]`),
    );
  }

  private computeHash(value: unknown): string {
    return createHash('sha256')
      .update(this.stableStringify(value))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private ensurePlainObject(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) {
      return {};
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Report parameters must be an object');
    }

    return Object.fromEntries(Object.entries(value));
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
