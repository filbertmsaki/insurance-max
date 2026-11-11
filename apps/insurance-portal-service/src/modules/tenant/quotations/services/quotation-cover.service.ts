import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type UnderwriteCover,
  classifyUnderwriteCover,
  collectRiskCodes,
  getUnderwriteCoverDefinition,
  parseUnderwriteCover,
  resolveUnderwriteCover,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { EntityManager } from 'typeorm';
import { coversForPermission } from '../../../shared/authorization/underwrite-cover-scope';
import { Quotation } from '../entities/quotation.entity';

/** The quotation permission whose cover grant a write needs. */
export type QuotationCoverWrite = 'quotations:create' | 'quotations:update';

export interface ApplyQuotationCoverOptions {
  /**
   * The acting user. Omitted for system-generated quotations (renewals,
   * endorsements), which inherit an already authorised source.
   */
  user?: Pick<AuthenticatedUser, 'permissions'> | null;
  /** Permission the write is performed under. */
  write?: QuotationCoverWrite;
  /** Cover stated by the client; only decides an incomplete draft. */
  intent?: string | null;
  /**
   * Include risks of the draft payload (draft writes). Complete writes
   * classify from the stored risks only, which are authoritative.
   */
  includeDraftPayload?: boolean;
}

/**
 * Classifies a quotation's underwriting cover from what is stored (flow,
 * product, every stored and draft risk, cover period) and enforces the
 * user's cover grant. Runs inside the write transaction, after the write, so
 * the decision is made on the persisted state and a refusal rolls the write
 * back. A client label alone can never make a record Short-Term.
 */
@Injectable()
export class QuotationCoverService {
  async applyInTransaction(
    manager: EntityManager,
    quotationId: string,
    options: ApplyQuotationCoverOptions = {},
  ): Promise<UnderwriteCover> {
    const quotation = await manager.getRepository(Quotation).findOne({
      select: {
        id: true,
        quotation_flow: true,
        product_id: true,
        underwrite_cover: true,
        draft_payload: true,
      },
      where: { id: quotationId },
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    const [productRow] = await manager.query(
      `SELECT product_code FROM insurance_products WHERE id = $1`,
      [quotation.product_id],
    );
    const storedRisks = await manager.query(
      `
        SELECT DISTINCT risk.risk_code
        FROM quotation_cover_notes cover_note
        JOIN quotation_cover_note_entries entry
          ON entry.cover_note_id = cover_note.id
        JOIN quotation_entry_risks risk ON risk.entry_id = entry.id
        WHERE cover_note.quotation_id = $1
      `,
      [quotationId],
    );
    const [period] = await manager.query(
      `
        SELECT
          MIN(cover_note_start_date) AS cover_start,
          MAX(cover_note_end_date) AS cover_end
        FROM quotation_cover_notes
        WHERE quotation_id = $1
      `,
      [quotationId],
    );

    const productCode = productRow?.product_code ?? null;
    const classification = classifyUnderwriteCover({
      quotationFlow: quotation.quotation_flow,
      productCode,
      riskCodes: [
        ...storedRisks.map((row) => row.risk_code),
        ...(options.includeDraftPayload
          ? collectRiskCodes(quotation.draft_payload)
          : []),
      ],
      coverStart: period?.cover_start ?? null,
      coverEnd: period?.cover_end ?? null,
    });
    const resolution = resolveUnderwriteCover(classification, {
      quotationFlow: quotation.quotation_flow,
      productCode,
      intent: options.intent ?? null,
      existing: quotation.underwrite_cover,
    });
    if (resolution.error !== undefined) {
      throw new BadRequestException({
        code: 'UNDERWRITE_COVER_MISMATCH',
        message: resolution.error,
      });
    }

    const cover = resolution.cover;
    const previous = parseUnderwriteCover(quotation.underwrite_cover);
    if (options.user) {
      this.assertCoverWritable(options.user, cover, options.write, {
        reason: classification.reason,
        previous,
      });
    }

    if (quotation.underwrite_cover !== cover) {
      await manager
        .getRepository(Quotation)
        .update({ id: quotationId }, { underwrite_cover: cover });
    }
    return cover;
  }

  /**
   * The user must hold the write's cover grant on the resulting cover and,
   * when the write changes the cover, the edit grant on the previous one.
   */
  assertCoverWritable(
    user: Pick<AuthenticatedUser, 'permissions'>,
    cover: UnderwriteCover,
    write: QuotationCoverWrite = 'quotations:update',
    context: { reason?: string | null; previous?: UnderwriteCover | null } = {},
  ): void {
    const permissions = new Set(user.permissions ?? []);
    const allowed = coversForPermission(permissions, write);
    const label = getUnderwriteCoverDefinition(cover).label;
    if (allowed && !allowed.includes(cover)) {
      throw new ForbiddenException({
        code: 'UNDERWRITE_COVER_FORBIDDEN',
        message: context.reason
          ? `You do not have access to ${label} quotations. ${context.reason}`
          : `You do not have access to ${label} quotations.`,
        details: { cover, permission: write, allowed_covers: allowed },
      });
    }
    const { previous } = context;
    if (previous && previous !== cover) {
      const editable = coversForPermission(permissions, 'quotations:update');
      if (editable && !editable.includes(previous)) {
        throw new ForbiddenException({
          code: 'UNDERWRITE_COVER_FORBIDDEN',
          message: `You do not have access to ${getUnderwriteCoverDefinition(previous).label} quotations.`,
          details: { cover: previous, permission: 'quotations:update' },
        });
      }
    }
  }
}
