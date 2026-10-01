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
import { FleetRegisterService } from '../fleet/fleet-register.service';
import { NonMotorRiskService } from '../non-motor/non-motor-risk.service';

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
    private readonly nonMotorRiskService: NonMotorRiskService,
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
    if (line === UnderwriteLine.NON_MOTOR) {
      // Risk details must satisfy the product's risk schema, and mandatory
      // documents must be attached, before the quotation is completed.
      await this.nonMotorRiskService.assertCompleteForFinalize(
        user.companyId!,
        id,
        dto.internal_quotation.product_id,
        dto.internal_quotation.sub_class_id,
      );
      await this.nonMotorRiskService.assertDocumentsCompleteForFinalize(
        user.companyId!,
        id,
        dto.internal_quotation.product_id,
        dto.internal_quotation.sub_class_id,
      );
    }
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
