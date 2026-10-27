import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  IDENTIFIER_CONSTANTS,
  IDENTIFIER_DATE_FORMATS,
  IDENTIFIER_SEQUENCE_LENGTHS,
  IdentifierType,
} from '@insurance-max/portal-shared/constants/identifier.constants';
import { PolicyTransactionType } from '@insurance-max/contracts';
import { Company } from '../../platform/companies/entities/company.entity';

const POLICY_TRANSACTION_IDENTIFIER_TYPE: Record<
  PolicyTransactionType,
  IdentifierType
> = {
  [PolicyTransactionType.ENDORSEMENT]: IdentifierType.ENDORSEMENT,
  [PolicyTransactionType.CANCELLATION]: IdentifierType.CANCELLATION,
  [PolicyTransactionType.RENEWAL]: IdentifierType.RENEWAL,
};

const POLICY_TRANSACTION_IDENTIFIER_CONSTANT: Record<
  PolicyTransactionType,
  string
> = {
  [PolicyTransactionType.ENDORSEMENT]: IDENTIFIER_CONSTANTS.endorsement,
  [PolicyTransactionType.CANCELLATION]: IDENTIFIER_CONSTANTS.cancellation,
  [PolicyTransactionType.RENEWAL]: IDENTIFIER_CONSTANTS.renewal,
};

const POLICY_TRANSACTION_SEQUENCE_LENGTH: Record<
  PolicyTransactionType,
  number
> = {
  [PolicyTransactionType.ENDORSEMENT]: IDENTIFIER_SEQUENCE_LENGTHS.endorsement,
  [PolicyTransactionType.CANCELLATION]:
    IDENTIFIER_SEQUENCE_LENGTHS.cancellation,
  [PolicyTransactionType.RENEWAL]: IDENTIFIER_SEQUENCE_LENGTHS.renewal,
};

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
      const candidate =
        suffix === 0
          ? basePrefix
          : `${basePrefix}${String(suffix).padStart(2, '0')}`;
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

    throw new ConflictException(
      'Unable to generate a unique company identifier prefix',
    );
  }

  async generateQuotationNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const company = await this.resolveCompany(companyId, manager);
    const prefix = await this.ensureCompanyIdentifierPrefix(company, manager);

    const today = this.formatDate(
      new Date(),
      IDENTIFIER_DATE_FORMATS.quotation,
    );
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
    const datePart = this.formatDate(
      now,
      IDENTIFIER_DATE_FORMATS.coverNoteDate,
    );
    const timePart = this.formatDate(
      now,
      IDENTIFIER_DATE_FORMATS.coverNoteTime,
    );

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

  async generateSubjectMatterReference(
    companyId: string,
    chassisNumber: string,
    manager?: EntityManager,
  ): Promise<string> {
    const chassisPrefix = chassisNumber
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 60);
    const timestamp = this.formatDate(
      new Date(),
      IDENTIFIER_DATE_FORMATS.subjectMatter,
    );

    return this.generateFormattedIdentifier({
      companyId,
      identifierType: IdentifierType.SUBJECT_MATTER,
      prefix: chassisPrefix || 'VEHICLE',
      datePart: timestamp,
      sequenceLength: IDENTIFIER_SEQUENCE_LENGTHS.subjectMatter,
      readableConstant: IDENTIFIER_CONSTANTS.subjectMatter,
      manager,
    });
  }

  async generateRequestId(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const company = await this.resolveCompany(companyId, manager);
    const prefix = await this.ensureCompanyIdentifierPrefix(company, manager);

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

  async generatePricingQuoteId(manager?: EntityManager): Promise<{
    pricingQuoteId: string;
    sequenceNo: number;
  }> {
    const activeManager = manager ?? this.dataSource.manager;
    const rows = await activeManager.query(
      `SELECT nextval('pricing_quote_identifier_seq') AS sequence_no`,
    );
    const sequenceNo = Number(rows?.[0]?.sequence_no);

    if (!Number.isFinite(sequenceNo) || sequenceNo <= 0) {
      throw new ConflictException(
        'Unable to generate a unique pricing quote sequence value',
      );
    }

    const year = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      year: 'numeric',
    }).format(new Date());

    return {
      pricingQuoteId: `PQ-${year}-${String(sequenceNo).padStart(8, '0')}`,
      sequenceNo,
    };
  }

  async generateInvoiceNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      IdentifierType.INVOICE,
      IDENTIFIER_CONSTANTS.invoice,
      IDENTIFIER_SEQUENCE_LENGTHS.invoice,
      manager,
    );
  }

  async generateReceiptNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      IdentifierType.RECEIPT,
      IDENTIFIER_CONSTANTS.receipt,
      IDENTIFIER_SEQUENCE_LENGTHS.receipt,
      manager,
    );
  }

  async generatePaymentTransactionNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      IdentifierType.PAYMENT_TRANSACTION,
      IDENTIFIER_CONSTANTS.paymentTransaction,
      IDENTIFIER_SEQUENCE_LENGTHS.paymentTransaction,
      manager,
    );
  }

  async generateRefundNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      IdentifierType.REFUND,
      IDENTIFIER_CONSTANTS.refund,
      IDENTIFIER_SEQUENCE_LENGTHS.refund,
      manager,
    );
  }

  async generateCommissionAccrualNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      IdentifierType.COMMISSION_ACCRUAL,
      IDENTIFIER_CONSTANTS.commissionAccrual,
      IDENTIFIER_SEQUENCE_LENGTHS.commissionAccrual,
      manager,
    );
  }

  async generateCommissionPaymentNumber(
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      IdentifierType.COMMISSION_PAYMENT,
      IDENTIFIER_CONSTANTS.commissionPayment,
      IDENTIFIER_SEQUENCE_LENGTHS.commissionPayment,
      manager,
    );
  }

  async generatePolicyTransactionNumber(
    transactionType: PolicyTransactionType,
    companyId: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.generateFinanceIdentifier(
      companyId,
      POLICY_TRANSACTION_IDENTIFIER_TYPE[transactionType],
      POLICY_TRANSACTION_IDENTIFIER_CONSTANT[transactionType],
      POLICY_TRANSACTION_SEQUENCE_LENGTH[transactionType],
      manager,
    );
  }

  private async generateFinanceIdentifier(
    companyId: string,
    identifierType: IdentifierType,
    readableConstant: string,
    sequenceLength: number,
    manager?: EntityManager,
  ): Promise<string> {
    const company = await this.resolveCompany(companyId, manager);
    const prefix = await this.ensureCompanyIdentifierPrefix(company, manager);
    const today = this.formatDate(new Date(), IDENTIFIER_DATE_FORMATS.finance);

    return this.generateFormattedIdentifier({
      companyId,
      identifierType,
      prefix,
      datePart: today,
      sequenceLength,
      readableConstant,
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
    // Quotation counters span all dates; the formatted reference still uses
    // the actual creation date supplied in datePart.
    const sequenceDate =
      params.identifierType === IdentifierType.QUOTATION
        ? 'LIFETIME'
        : params.datePart;
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
      const identifier = this.assembleIdentifier({
        identifierType: params.identifierType,
        prefix: params.prefix,
        readableConstant: params.readableConstant,
        sequenceDate: params.datePart,
        sequenceTimeBucket,
        suffix,
      });

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

  /**
   * Quotation numbers use a short, compact business reference
   * ({prefix}{yyMMdd}{seq}, e.g. "AICL260729001") with no separators or
   * readable-constant segment — distinct from the dashed
   * {prefix}-{constant}-{date}-{seq} shape every other identifier type
   * still uses. Existing quotation numbers generated before this format
   * (the dashed "AICL-QTN-260729-000005" style) are untouched by this —
   * it only governs newly generated values.
   */
  private assembleIdentifier(params: {
    identifierType: IdentifierType;
    prefix: string;
    readableConstant: string;
    sequenceDate: string;
    sequenceTimeBucket: string;
    suffix: string;
  }): string {
    const {
      identifierType,
      prefix,
      readableConstant,
      sequenceDate,
      sequenceTimeBucket,
      suffix,
    } = params;

    if (identifierType === IdentifierType.QUOTATION) {
      return `${prefix}${sequenceDate}${suffix}`;
    }

    if (identifierType === IdentifierType.COVER_NOTE) {
      return `${prefix}-${readableConstant}-${sequenceDate}-${sequenceTimeBucket}-${suffix}`;
    }

    if (identifierType === IdentifierType.SUBJECT_MATTER) {
      return `${prefix}${sequenceDate}${suffix}`;
    }

    return `${prefix}-${readableConstant}-${sequenceDate}-${suffix}`;
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
          -- With no row yet there is nothing to lock, so concurrent first
          -- callers both reach this INSERT; the loser waits for the winner
          -- and increments instead of failing on UQ_identifier_sequences_scope.
          ON CONFLICT (company_id, identifier_type, sequence_date, sequence_time_bucket)
          DO UPDATE SET current_value = identifier_sequences.current_value + 1,
                        updated_at = NOW()
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

  private async ensureCompanyIdentifierPrefix(
    company: Company,
    manager?: EntityManager,
  ): Promise<string> {
    const currentPrefix = company.identifier_prefix?.trim().toUpperCase();
    if (currentPrefix) {
      if (currentPrefix !== company.identifier_prefix) {
        await this.getCompanyRepository(manager).update(
          { id: company.id },
          { identifier_prefix: currentPrefix },
        );
      }
      return currentPrefix;
    }

    const repository = this.getCompanyRepository(manager);
    const existingCompany = await repository.findOne({
      where: { id: company.id },
      select: { id: true, identifier_prefix: true },
    });
    const existingPrefix = existingCompany?.identifier_prefix
      ?.trim()
      .toUpperCase();
    if (existingPrefix) {
      return existingPrefix;
    }

    const generatedPrefix = await this.generateCompanyIdentifierPrefix(
      company.name,
      manager,
    );

    const updateResult = await repository
      .createQueryBuilder()
      .update(Company)
      .set({
        identifier_prefix: generatedPrefix,
      })
      .where('id = :id', { id: company.id })
      .andWhere('identifier_prefix IS NULL')
      .execute();

    if (updateResult.affected && updateResult.affected > 0) {
      return generatedPrefix;
    }

    const refreshedCompany = await repository.findOne({
      where: { id: company.id },
      select: { id: true, identifier_prefix: true },
    });
    const refreshedPrefix = refreshedCompany?.identifier_prefix
      ?.trim()
      .toUpperCase();
    if (refreshedPrefix) {
      return refreshedPrefix;
    }

    throw new BadRequestException(
      'The company identifier prefix has not been configured.',
    );
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
      .map((word) => word[0].toUpperCase())
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
      case IDENTIFIER_DATE_FORMATS.subjectMatter:
        return `${lookup.get('year') ?? ''}${month}${day}${hour}${minute}${second}`;
      default:
        return `${year}${month}${day}`;
    }
  }

  private getCompanyRepository(manager?: EntityManager) {
    return (
      manager?.getRepository(Company) ?? this.dataSource.getRepository(Company)
    );
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
