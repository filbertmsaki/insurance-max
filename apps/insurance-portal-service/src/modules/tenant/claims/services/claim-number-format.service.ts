import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataSource } from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import { renderNumberPrefix } from '../../../shared/identifiers/business-reference.service';

/**
 * Claims document types a company can renumber, with the default format
 * used when none is configured (the prefixes hard-coded at each call site).
 */
export const CLAIM_NUMBER_TYPES: ReadonlyArray<{
  document_type: string;
  label: string;
  default_prefix: string;
}> = [
  { document_type: 'CLAIM', label: 'Claim', default_prefix: 'CLM-{YYYY}-' },
  {
    document_type: 'CLAIM_NOTIFICATION',
    label: 'Claim notification',
    default_prefix: 'CLN-{YYYY}-',
  },
  {
    document_type: 'CLAIM_INTIMATION',
    label: 'Claim intimation',
    default_prefix: 'INT-{YYYY}-',
  },
  {
    document_type: 'CLAIM_ASSESSMENT',
    label: 'Claim assessment',
    default_prefix: 'ASM-{YYYY}-',
  },
  {
    document_type: 'CLAIM_DISCHARGE_VOUCHER',
    label: 'Discharge voucher',
    default_prefix: 'DV-{YYYY}-',
  },
  {
    document_type: 'CLAIM_PAYMENT',
    label: 'Claim payment',
    default_prefix: 'CP-{YYYY}-',
  },
  {
    document_type: 'CLAIM_REJECTION',
    label: 'Claim rejection',
    default_prefix: 'CRJ-{YYYY}-',
  },
];

const PREFIX_PATTERN = /^[A-Za-z0-9{}/_-]{1,40}$/;

interface NumberFormatRow {
  document_type: string;
  prefix: string;
  sequence_length: number;
  updated_at: Date;
}

/** Per-company claim number formats (business_document_number_formats). */
@Injectable()
export class ClaimNumberFormatService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async list(companyId: string) {
    const rows: NumberFormatRow[] = await this.dataSource.query(
      `SELECT document_type, prefix, sequence_length, updated_at
         FROM business_document_number_formats
        WHERE company_id = $1 AND document_type = ANY($2::text[])`,
      [companyId, CLAIM_NUMBER_TYPES.map((type) => type.document_type)],
    );

    return CLAIM_NUMBER_TYPES.map((type) => {
      const row = rows.find(
        (item) => item.document_type === type.document_type,
      );
      const prefix = row?.prefix ?? type.default_prefix;
      const length = row?.sequence_length ?? 5;
      return {
        ...type,
        prefix,
        sequence_length: length,
        customised: !!row,
        example: `${renderNumberPrefix(prefix)}${'1'.padStart(length, '0')}`,
        updated_at: row?.updated_at ?? null,
      };
    });
  }

  async save(
    user: AuthenticatedUser,
    input: { document_type: string; prefix: string; sequence_length?: number },
  ) {
    const companyId = user.companyId!;
    const type = this.type(input.document_type);
    const prefix = input.prefix.trim();

    if (!PREFIX_PATTERN.test(prefix)) {
      throw new BadRequestException(
        'Use letters, digits, "-", "/", "_" and the tokens {YYYY}, {YY}, {MM}; at most 40 characters',
      );
    }

    // Two document types with the same prefix would produce the same numbers.
    const others = (await this.list(companyId)).filter(
      (item) => item.document_type !== type.document_type,
    );
    const clash = others.find((item) => item.prefix === prefix);
    if (clash) {
      throw new ConflictException(
        `${clash.label} numbers already use the prefix ${prefix}`,
      );
    }

    const length = input.sequence_length ?? 5;
    await this.dataSource.query(
      `INSERT INTO business_document_number_formats (
         company_id, document_type, prefix, sequence_length, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (company_id, document_type)
       DO UPDATE SET prefix = EXCLUDED.prefix,
                     sequence_length = EXCLUDED.sequence_length,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = now()`,
      [companyId, type.document_type, prefix, length, user.id],
    );
    await this.auditService.log({
      userId: user.id,
      companyId,
      action: 'claim.number_format.updated',
      resource: 'business_document_number_format',
      afterState: {
        document_type: type.document_type,
        prefix,
        sequence_length: length,
      },
    });

    return (await this.list(companyId)).find(
      (item) => item.document_type === type.document_type,
    );
  }

  /** Back to the default format; the running sequence is kept. */
  async reset(user: AuthenticatedUser, documentType: string) {
    const type = this.type(documentType);
    await this.dataSource.query(
      `DELETE FROM business_document_number_formats
        WHERE company_id = $1 AND document_type = $2`,
      [user.companyId, type.document_type],
    );
    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'claim.number_format.reset',
      resource: 'business_document_number_format',
      afterState: { document_type: type.document_type, reset: true },
    });
    return (await this.list(user.companyId!)).find(
      (item) => item.document_type === type.document_type,
    );
  }

  private type(documentType: string) {
    const type = CLAIM_NUMBER_TYPES.find(
      (item) => item.document_type === documentType,
    );
    if (!type) {
      throw new NotFoundException(`Unknown claim number type ${documentType}`);
    }
    return type;
  }
}
