import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  IDENTIFIER_CONSTANTS,
  IDENTIFIER_DATE_FORMATS,
  IDENTIFIER_SEQUENCE_LENGTHS,
  IdentifierType,
} from '@insurance-max/portal-shared/constants/identifier.constants';
import { Company } from '../../platform/companies/entities/company.entity';

interface GeneratedIdentifierRow {
  id: string;
  identifier_type: IdentifierType;
  identifier_value: string;
  company_id: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

@Injectable()
export class IdentifierGeneratorService {
  private readonly logger = new Logger(IdentifierGeneratorService.name);
  private readonly timeZone = 'Africa/Dar_es_Salaam';

  constructor(private readonly dataSource: DataSource) {}

  async generateCompanyIdentifierPrefix(
    companyName: string,
    manager?: EntityManager,
  ): Promise<string> {
    const repository = this.getCompanyRepository(manager);
    const basePrefix = this.derivePrefix(companyName);

    if (!basePrefix) {
      throw new BadRequestException(
        'The company identifier prefix could not be derived from the company name.',
      );
    }

    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const candidate = suffix === 0 ? basePrefix : `${basePrefix}${String(suffix).padStart(2, '0')}`;
      const existing = await repository
        .createQueryBuilder('company')
        .select(['company.id'])
        .where('company.identifier_prefix = :candidate', { candidate })
        .andWhere('company.deleted_at IS NULL')
        .getOne();

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique company identifier prefix');
  }

  async generateQuotationNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const company = await this.resolveCompany(companyId, manager);
    const prefix = company.identifier_prefix;

    if (!prefix) {
      throw new BadRequestException(
        'The company identifier prefix has not been configured.',
      );
    }

    const today = this.formatDate(new Date(), IDENTIFIER_DATE_FORMATS.quotation);
    return this.generateFormattedIdentifier({
      companyId,
      identifierType: IdentifierType.QUOTATION,
      prefix,
      datePart: today,
      sequenceLength: IDENTIFIER_SEQUENCE_LENGTHS.quotation,
      readableConstant: IDENTIFIER_CONSTANTS.quotation,
      manager,
    });
  }

  async generateCoverNoteNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const company = await this.resolveCompany(companyId, manager);
    const companyCode = this.resolveCompanyCode(company);
    const now = new Date();
    const datePart = this.formatDate(now, IDENTIFIER_DATE_FORMATS.coverNoteDate);
    const timePart = this.formatDate(now, IDENTIFIER_DATE_FORMATS.coverNoteTime);

    return this.generateFormattedIdentifier({
      companyId,
      identifierType: IdentifierType.COVER_NOTE,
      prefix: companyCode,
      datePart,
      timePart,
      sequenceLength: IDENTIFIER_SEQUENCE_LENGTHS.coverNote,
      readableConstant: IDENTIFIER_CONSTANTS.coverNote,
      manager,
    });
  }

  async generateFleetCoverNoteNumbers(
    companyId: string,
    vehicleCount: number,
    manager?: EntityManager,
  ): Promise<string[]> {
    if (vehicleCount <= 0) {
      return [];
    }

    const numbers: string[] = [];
    for (let index = 0; index < vehicleCount; index += 1) {
      numbers.push(await this.generateCoverNoteNumber(companyId, manager));
    }
    return numbers;
  }

  async generateRequestId(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const company = await this.resolveCompany(companyId, manager);
    const prefix = company.identifier_prefix;

    if (!prefix) {
      throw new BadRequestException(
        'The company identifier prefix has not been configured.',
      );
    }

    const today = this.formatDate(new Date(), IDENTIFIER_DATE_FORMATS.request);
    return this.generateFormattedIdentifier({
      companyId,
      identifierType: IdentifierType.TIRAMIS_REQUEST,
      prefix,
      datePart: today,
      sequenceLength: IDENTIFIER_SEQUENCE_LENGTHS.request,
      readableConstant: IDENTIFIER_CONSTANTS.request,
      manager,
    });
  }

  private async generateFormattedIdentifier(params: {
    companyId: string;
    identifierType: IdentifierType;
    prefix: string;
    datePart: string;
    sequenceLength: number;
    readableConstant: string;
    manager?: EntityManager;
    timePart?: string;
  }): Promise<string> {
    const manager = params.manager;
    const sequenceDate = params.datePart;
    // Use a non-null sentinel for "no time bucket" so Postgres uniqueness
    // and conflict detection work for quotation/request sequences too.
    const sequenceTimeBucket = params.timePart ?? '';
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const sequence = await this.incrementSequence({
        companyId: params.companyId,
        identifierType: params.identifierType,
        sequenceDate,
        sequenceTimeBucket,
        manager,
      });

      const suffix = String(sequence).padStart(params.sequenceLength, '0');
      const identifier =
        params.identifierType === IdentifierType.COVER_NOTE
          ? `${params.prefix}-${params.readableConstant}-${sequenceDate}-${sequenceTimeBucket}-${suffix}`
          : `${params.prefix}-${params.readableConstant}-${sequenceDate}-${suffix}`;

      try {
        await this.insertGeneratedIdentifier({
          companyId: params.companyId,
          identifierType: params.identifierType,
          identifierValue: identifier,
          manager,
        });
        return identifier;
      } catch (error) {
        if (!this.isDuplicateConstraintError(error)) {
          this.logger.error(
            `Failed to persist generated identifier for ${params.identifierType}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
      }
    }

    throw new ConflictException(
      `Unable to generate a unique ${params.identifierType.toLowerCase().replace(/_/g, ' ')}. Please try again.`,
    );
  }

  private async incrementSequence(params: {
    companyId: string;
    identifierType: IdentifierType;
    sequenceDate: string;
    sequenceTimeBucket: string;
    manager?: EntityManager;
  }): Promise<number> {
    const manager = params.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      `
        WITH existing AS (
          SELECT id
          FROM identifier_sequences
          WHERE company_id = $1
            AND identifier_type = $2
            AND sequence_date = $3
            AND COALESCE(sequence_time_bucket, '') = $4
          ORDER BY
            CASE WHEN sequence_time_bucket = $4 THEN 0 ELSE 1 END,
            current_value DESC,
            updated_at DESC,
            created_at DESC,
            id DESC
          LIMIT 1
          FOR UPDATE
        ),
        updated AS (
          UPDATE identifier_sequences
          SET current_value = current_value + 1,
              sequence_time_bucket = $4,
              updated_at = NOW()
          WHERE id IN (SELECT id FROM existing)
          RETURNING current_value
        ),
        inserted AS (
          INSERT INTO identifier_sequences (
            company_id,
            identifier_type,
            sequence_date,
            sequence_time_bucket,
            current_value
          )
          SELECT $1, $2, $3, $4, 1
          WHERE NOT EXISTS (SELECT 1 FROM existing)
          RETURNING current_value
        )
        SELECT current_value FROM updated
        UNION ALL
        SELECT current_value FROM inserted
      `,
      [
        params.companyId,
        params.identifierType,
        params.sequenceDate,
        params.sequenceTimeBucket,
      ],
    );

    const value = Number(rows?.[0]?.current_value);
    if (!Number.isFinite(value) || value <= 0) {
      throw new ConflictException('Unable to generate a unique sequence value');
    }

    return value;
  }

  private async insertGeneratedIdentifier(params: {
    companyId: string;
    identifierType: IdentifierType;
    identifierValue: string;
    manager?: EntityManager;
  }): Promise<void> {
    const manager = params.manager ?? this.dataSource.manager;
    await manager.query(
      `
        INSERT INTO generated_identifiers (
          identifier_type,
          identifier_value,
          company_id,
          related_entity_type,
          related_entity_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        params.identifierType,
        params.identifierValue,
        params.companyId,
        null,
        null,
      ],
    );
  }

  private async resolveCompany(
    companyId: string,
    manager?: EntityManager,
  ): Promise<Company> {
    const repository = this.getCompanyRepository(manager);
    const company = await repository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new BadRequestException('Current company was not found');
    }

    return company;
  }

  private resolveCompanyCode(company: Company): string {
    const code = company.tira_company_code || company.tira_insurer_company_code;

    if (!code) {
      throw new BadRequestException(
        'The company code has not been configured.',
      );
    }

    return code.trim().toUpperCase();
  }

  private derivePrefix(companyName: string): string {
    return companyName
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean)
      .map((word) => word[0]!.toUpperCase())
      .join('')
      .replace(/[^A-Z0-9]/g, '');
  }

  private formatDate(date: Date, format: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      year: format.includes('yy') ? '2-digit' : 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: format.includes('H') ? '2-digit' : undefined,
      minute: format.includes('m') ? '2-digit' : undefined,
      second: format.includes('s') ? '2-digit' : undefined,
      hour12: false,
    }).formatToParts(date);

    const lookup = new Map(parts.map((part) => [part.type, part.value]));
    const year = lookup.get('year') ?? '';
    const month = lookup.get('month') ?? '';
    const day = lookup.get('day') ?? '';
    const hour = lookup.get('hour') ?? '';
    const minute = lookup.get('minute') ?? '';
    const second = lookup.get('second') ?? '';

    switch (format) {
      case IDENTIFIER_DATE_FORMATS.quotation:
      case IDENTIFIER_DATE_FORMATS.request:
        return `${year}${month}${day}`.slice(-6);
      case IDENTIFIER_DATE_FORMATS.coverNoteDate:
        return `${lookup.get('year') ?? ''}${month}${day}`;
      case IDENTIFIER_DATE_FORMATS.coverNoteTime:
        return `${hour}${minute}${second}`;
      default:
        return `${year}${month}${day}`;
    }
  }

  private getCompanyRepository(manager?: EntityManager) {
    return manager?.getRepository(Company) ?? this.dataSource.getRepository(Company);
  }

  private isDuplicateConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const driverError = error as { code?: string; constraint?: string };
    return (
      driverError.code === '23505' ||
      String(driverError.constraint || '').includes('generated_identifiers')
    );
  }
}
