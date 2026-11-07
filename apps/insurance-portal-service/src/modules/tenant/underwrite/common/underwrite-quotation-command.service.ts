import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  quotationFlowForUnderwriteLine,
  UnderwriteLine,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CategoryAccessService } from '../../category-access/category-access.service';
import { ProductAccessService } from '../../product-access/product-access.service';
import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationsService } from '../../quotations/quotations.service';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { AuditService } from '../../../shared/audit/audit.service';
import { FleetRegisterService } from '../fleet/fleet-register.service';

/**
 * Line-scoped quotation writes for the Underwrite wizards.
 *
 * Every command delegates to the existing QuotationsService method used by
 * the legacy controller (draft, finalize, delete), so pricing, channel
 * authorization, validation and lifecycle rules are unchanged. This layer
 * only guarantees that the payload and the stored record belong to the line
 * addressed by the route, and applies the same product/category access check
 * as `QuotationsController`.
 */
@Injectable()
export class UnderwriteQuotationCommandService {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly categoryAccessService: CategoryAccessService,
    private readonly productAccessService: ProductAccessService,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(InsuranceProduct)
    private readonly insuranceProductRepository: Repository<InsuranceProduct>,
    private readonly fleetRegisterService: FleetRegisterService,
    private readonly auditService: AuditService,
  ) {}

  private readonly logger = new Logger(UnderwriteQuotationCommandService.name);

  async createDraft(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    dto: SaveQuotationDraftDto,
  ) {
    this.assertPayloadFlow(line, dto.quotation_flow);
    const categoryId =
      line === UnderwriteLine.MOTOR
        ? await this.resolveMotorProductCategory(
            user.companyId!,
            dto.insurer_company_id,
            dto.product_id,
          )
        : dto.category_id;
    await this.assertCanCreatePolicyForProduct(
      user,
      categoryId,
      dto.product_id,
    );
    return this.quotationsService.createDraft(
      user.companyId!,
      { ...dto, category_id: categoryId },
      user,
    );
  }

  /**
   * Duplicate quotation (business decision D2, 2026-11-07).
   *
   * The client sends the source quotation's form values as a new draft; the
   * server checks the user may read the source in this line, refuses
   * policy-transaction quotations, strips every identifier that must be new
   * (cover note numbers, Fleet ID, pricing quotes) and creates an ordinary
   * draft through `createDraft`, so the usual product, channel and scope
   * rules apply. Approval, payment, invoices and TIRA state are never copied:
   * the copy starts as a fresh DRAFT and is repriced when finalized.
   */
  async duplicate(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    sourceId: string,
    dto: SaveQuotationDraftDto,
  ) {
    // Read scope first (404 if the user may not see the source).
    const source = await this.quotationsService.findOneForUser(user, sourceId);
    await this.assertStoredFlow(line, sourceId);
    const stored = await this.quotationRepository.findOne({
      select: { id: true, source_policy_transaction_id: true },
      where: { id: sourceId },
    });
    if (stored?.source_policy_transaction_id) {
      throw new BadRequestException({
        code: 'QUOTATION_DUPLICATE_NOT_ALLOWED',
        message:
          'Endorsement, cancellation and renewal quotations cannot be duplicated.',
      });
    }

    const created = await this.createDraft(user, line, {
      ...dto,
      draft_payload: stripDuplicateIdentifiers(dto.draft_payload),
    });

    await this.auditService.logCritical({
      userId: user.id,
      actorType: 'user',
      companyId: user.companyId!,
      action: 'quotation.duplicated',
      eventCategory: 'quotation',
      resource: 'quotation',
      resourceId: created.id,
      reason: `Duplicated from quotation ${source.quotation_no}`,
      beforeState: {
        source_quotation_id: sourceId,
        source_quotation_no: source.quotation_no,
      },
      afterState: {
        quotation_id: created.id,
        quotation_no: created.quotation_no,
        line,
      },
    });

    return created;
  }

  async getForEdit(user: AuthenticatedUser, line: UnderwriteLine, id: string) {
    const quotation = await this.quotationsService.findOneForEditForUser(
      user,
      id,
    );
    await this.assertStoredFlow(line, id);
    return quotation;
  }

  async updateDraft(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    id: string,
    dto: UpdateQuotationDraftDto,
  ) {
    this.assertPayloadFlow(line, dto.quotation_flow);
    await this.assertStoredFlow(line, id);
    const categoryId =
      line === UnderwriteLine.MOTOR
        ? await this.resolveMotorProductCategory(
            user.companyId!,
            dto.insurer_company_id,
            dto.product_id,
          )
        : dto.category_id;
    await this.assertCanCreatePolicyForProduct(
      user,
      categoryId,
      dto.product_id,
    );
    return this.quotationsService.updateDraft(
      user.companyId!,
      id,
      { ...dto, category_id: categoryId },
      user,
    );
  }

  async finalize(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    id: string,
    dto: UpdateQuotationDto,
  ) {
    this.assertPayloadFlow(line, dto.internal_quotation.quotation_flow);
    await this.assertStoredFlow(line, id);
    const categoryId =
      line === UnderwriteLine.MOTOR
        ? await this.resolveMotorProductCategory(
            user.companyId!,
            dto.internal_quotation.insurer_company_id,
            dto.internal_quotation.product_id,
          )
        : dto.internal_quotation.category_id;
    await this.assertCanCreatePolicyForProduct(
      user,
      categoryId,
      dto.internal_quotation.product_id,
    );
    const resolvedDto = {
      ...dto,
      internal_quotation: {
        ...dto.internal_quotation,
        category_id: categoryId,
      },
    };
    // Non-Motor risk-detail and document gates run inside
    // QuotationsService.finalize, so the legacy route enforces them too.
    const quotation = await this.quotationsService.finalize(
      user.companyId!,
      id,
      resolvedDto,
      user,
    );

    if (line === UnderwriteLine.FLEET) {
      // Projection only: a register failure must never undo a completed
      // quotation. It can be re-run from the fleet quotation screen.
      await this.fleetRegisterService
        .syncFromQuotation(user.companyId!, id)
        .catch((error: unknown) =>
          this.logger.error(
            `Fleet register sync failed for quotation ${id}`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }

    return quotation;
  }

  async removeDraft(user: AuthenticatedUser, line: UnderwriteLine, id: string) {
    await this.assertStoredFlow(line, id);
    await this.quotationsService.removeDraftForUser(user, id);
    return { message: 'Quotation draft deleted successfully' };
  }

  private assertPayloadFlow(line: UnderwriteLine, flow: string | undefined) {
    if (flow !== quotationFlowForUnderwriteLine(line)) {
      throw new BadRequestException({
        code: 'UNDERWRITE_LINE_MISMATCH',
        message: `This quotation flow (${String(flow)}) does not belong to the ${line} line.`,
      });
    }
  }

  /** 404 (not 403) so ids from another line are not disclosed. */
  private async assertStoredFlow(line: UnderwriteLine, id: string) {
    const stored = await this.quotationRepository.findOne({
      select: { id: true, quotation_flow: true },
      where: { id },
    });
    if (stored?.quotation_flow !== quotationFlowForUnderwriteLine(line)) {
      throw new NotFoundException('Quotation not found');
    }
  }

  /** Motor category is configured on the product; the submitted category is never authoritative. */
  private async resolveMotorProductCategory(
    companyId: string,
    insurerCompanyId: string | null | undefined,
    productId: string,
  ): Promise<string> {
    const product = await this.insuranceProductRepository.findOne({
      select: { id: true, category_id: true },
      where: {
        id: productId,
        company_id: insurerCompanyId || companyId,
      },
    });
    if (!product) {
      throw new NotFoundException('Insurance product was not found');
    }
    return product.category_id;
  }

  /** Same rule as `QuotationsController.assertCanCreatePolicyForProduct`. */
  private async assertCanCreatePolicyForProduct(
    user: AuthenticatedUser,
    categoryId: string,
    productId: string,
  ): Promise<void> {
    const context = {
      company_user_id: user.companyMembershipId!,
      branch_id: user.activeBranchId ?? undefined,
      department_id: user.activeDepartmentId ?? undefined,
    };

    const [categoryAccess, productAccess] = await Promise.all([
      this.categoryAccessService.resolveAccess(user.companyId!, {
        ...context,
        category_id: categoryId,
      }),
      this.productAccessService.resolveAccess(user.companyId!, {
        ...context,
        product_id: productId,
      }),
    ]);

    if (!categoryAccess.can_create_policy || !productAccess.can_create_policy) {
      throw new ForbiddenException(
        'You are not allowed to create policies for this product',
      );
    }
  }
}

/** Identifiers a duplicate must never inherit (they are issued anew). */
export const DUPLICATE_STRIPPED_KEYS = new Set([
  'quotation_id',
  'quotation_no',
  'status',
  'fleet_id',
  'cover_note_number',
  'cover_note_reference_number',
  'prev_cover_note_reference_number',
  'sticker_number',
  'pricing_quote_id',
  'pricing_snapshot',
  'premium_override_id',
]);

/** Deep copy of a draft payload without identifiers that must be new. */
export function stripDuplicateIdentifiers(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !DUPLICATE_STRIPPED_KEYS.has(key))
          .map(([key, item]) => [key, strip(item)]),
      );
    }
    return value;
  };
  return (strip(payload ?? {}) as Record<string, unknown>) ?? {};
}
