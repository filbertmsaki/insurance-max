import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  moneyEqual,
  numbersEqual,
  roundMoney,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import {
  DataSource,
  EntityManager,
  Brackets,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { TiramisRequestType } from '../../tiramis/enums/tiramis-request-type.enum';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import { CustomerKycStatus } from '../customers/enums/customer-kyc-status.enum';
import { CustomerGender } from '../customers/enums/customer-gender.enum';
import { CustomerPolicyHolderType } from '../customers/enums/customer-policy-holder-type.enum';
import { CustomerType } from '../customers/enums/customer-type.enum';
import { CustomerStatus } from '../customers/enums/customer-status.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceBusinessLine } from '../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from './dto/quotation-draft.dto';
import {
  CoverNoteAddonDto,
  CreateQuotationDto,
  MotorDetailDto,
  PolicyHolderDto,
  RiskCoveredDto,
  SubjectMatterCoveredDto,
  TaxChargedDto,
  SubmitQuotationDto,
  UpdateQuotationDto,
} from './dto/quotation-payload.dto';
import { FilterQuotationDto } from './dto/filter-quotation.dto';
import { DecideQuotationPremiumOverrideDto } from './dto/quotation-premium-override.dto';
import { RequestQuotationPremiumOverrideDto } from './dto/quotation-premium-override.dto';
import { TransitionQuotationStatusDto } from './dto/transition-quotation-status.dto';
import { Quotation } from './entities/quotation.entity';
import { QuotationStatusHistory } from './entities/quotation-status-history.entity';
import { QuotationCoverNoteEntry } from './entities/structured/quotation-cover-note-entry.entity';
import { QuotationCoverNote } from './entities/structured/quotation-cover-note.entity';
import { QuotationEntryAddonTax } from './entities/structured/quotation-entry-addon-tax.entity';
import { QuotationEntryAddon } from './entities/structured/quotation-entry-addon.entity';
import { QuotationEntryRisk } from './entities/structured/quotation-entry-risk.entity';
import { QuotationMotorDetail } from './entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from './entities/structured/quotation-policy-holder.entity';
import { QuotationRiskDiscount } from './entities/structured/quotation-risk-discount.entity';
import { QuotationRiskPremiumOverride } from './entities/structured/quotation-risk-premium-override.entity';
import { QuotationRiskTax } from './entities/structured/quotation-risk-tax.entity';
import { QuotationSubjectMatter } from './entities/structured/quotation-subject-matter.entity';
import { QuotationEntryType } from './enums/quotation-entry-type.enum';
import { QuotationFlow } from './enums/quotation-flow.enum';
import { ApprovalStatus } from './enums/approval-status.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { QuotationPremiumOverrideStatus } from './enums/quotation-premium-override-status.enum';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from './enums/quotation-status-transition-action.enum';
import { QuotationType } from './enums/quotation-type.enum';
import { TiraStatus } from './enums/tira-status.enum';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationPreviewMapper } from './mappers/quotation-preview.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { parseTiramisDateTime } from './utils/tiramis-date.util';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { PaymentTransaction } from '../billing-commission/entities/payment-transaction.entity';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionEvent } from '../tiramis-integration/entities/portal-tira-submission-event.entity';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import type { TenantDataScope } from '../../shared/authorization/interfaces/tenant-data-scope.interface';
import { AuditService } from '../../shared/audit/audit.service';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { PricingChargeService } from '../pricing/application/pricing-charge.service';
import { ExchangeRateGovernanceService } from '../pricing/application/exchange-rate-governance.service';
import { PricingQuoteService } from '../pricing/application/pricing-quote.service';
import type { ExchangeRateSnapshot } from '../pricing/domain/pricing.types';
import {
  PricingQuote,
  PricingQuoteScope,
  PricingQuoteStatus,
} from '../pricing/entities/pricing-quote.entity';
import { PricingRateBook } from '../pricing-rate-books/entities/pricing-rate-book.entity';
import { PricingRateBookStatus } from '../pricing-rate-books/enums/pricing-rate-book-status.enum';
import {
  EDITABLE_QUOTATION_STATUSES,
  TERMINAL_QUOTATION_STATUSES,
} from './utils/quotation-status-transition.util';
import { QuotationLifecycleService } from './services/quotation-lifecycle.service';

type NumericValue = number | string | null | undefined;

interface ScopeValidationResult {
  product: InsuranceProduct;
  customerId: string | null;
  riskByCode: Map<string, InsuranceRisk>;
}

interface PricingAuthorityRiskContext {
  riskId: string | null;
}

interface ApprovedPremiumOverrideSnapshot {
  pricing_quote_id: string | null;
  risk_code: string;
  proposed_premium: number;
}

interface PricingAdjustmentControl {
  max_rate: number | null;
  max_amount: number | null;
  approval_threshold_rate: number | null;
  approval_threshold_amount: number | null;
  effective_from: string | null;
  effective_to: string | null;
}

interface AuthoritativePricingValidationOptions {
  productId: string;
  riskByCode: Map<string, PricingAuthorityRiskContext>;
  quotationId?: string;
  approvedOverridePremiums?: Map<string, ApprovedPremiumOverrideSnapshot>;
}

interface PricingValidationAuditContext {
  userId?: string | null;
  quotationId?: string | null;
  quotationNo?: string | null;
  reason: string;
}

type QuotationPricingStatus = 'CURRENT' | 'STALE' | 'EXPIRED' | 'MISSING';

export interface QuotationPricingIntegrationSummary {
  pricing_status: QuotationPricingStatus;
  is_stale: boolean;
  current_pricing_quote_id: string | null;
  pricing_quote_ids: string[];
  last_calculated_at: string | null;
  pricing_expires_at: string | null;
  rate_book_version: string | null;
  base_premium: number;
  total_discounts: number;
  total_loadings: number;
  total_taxes: number;
  final_payable_premium: number;
  override_status: string;
  approval_status: string;
  stale_reasons: string[];
}

interface ResolvedHeader {
  sale_point_code: string;
  cover_note_start_date: string;
  cover_note_end_date: string;
  payment_mode: number;
  currency_code: string;
  exchange_rate: number;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  commision_paid: number;
  commision_rate: number;
  officer_name: string;
  officer_title: string;
  product_code: string;
  policy_holders: PolicyHolderDto[];
  fleet_id?: string;
  fleet_type?: number;
  fleet_size?: number;
  comprehensive_insured?: number;
}

interface ResolvedEntry {
  fleet_entry: number;
  cover_note_number: string;
  prev_cover_note_reference_number: string | null;
  cover_note_desc: string;
  operative_clause: string;
  endorsement_type: number | null;
  endorsement_reason: string | null;
  endorsement_premium_earned: number | null;
  risks_covered: RiskCoveredDto[];
  subject_matters_covered: SubjectMatterCoveredDto[];
  cover_note_addons: CoverNoteAddonDto[];
  motor_dtl?: MotorDetailDto;
}

interface PostgreSqlDriverError {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
}

const DIRECT_PAYMENT_MODE = 1;
const MONEY_TOLERANCE = 0.01;
const RATE_TOLERANCE = 0.000001;
const PRICING_VIEW_BREAKDOWN_PERMISSION = 'pricing.view_breakdown';
const PRICING_REQUEST_DISCOUNT_PERMISSION = 'pricing.request_discount';
const PRICING_APPROVE_DISCOUNT_PERMISSION = 'pricing.approve_discount';
const PRICING_AUDIT_VIEW_PERMISSIONS = [
  'pricing.view_audit',
  'pricing.request_override',
  'pricing.approve_override',
] as const;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly quotationsRepository: QuotationsRepository,
    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly payloadMapper: QuotationPayloadMapper,
    private readonly previewMapper: QuotationPreviewMapper,
    private readonly tiramisPayloadMapper: QuotationTiramisPayloadMapper,
    private readonly payloadValidator: QuotationPayloadValidator,
    private readonly tiramisBusinessSubmitService: TiramisBusinessSubmitService,
    private readonly tiramisSubmissionTrackingRepository: TiramisSubmissionTrackingRepository,
    private readonly identifierGeneratorService: IdentifierGeneratorService,
    private readonly quotationLifecycleService: QuotationLifecycleService,
    private readonly auditService: AuditService,
    private readonly pricingChargeService: PricingChargeService,
    private readonly exchangeRateGovernanceService: ExchangeRateGovernanceService,
    private readonly pricingQuoteService: PricingQuoteService,
    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>,
    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,
  ) {}

  private resolveUserScope(user: AuthenticatedUser): TenantDataScope {
    return this.dataAccessScopeService.resolve(user);
  }

  private async assertUserCanReadQuotation(
    user: AuthenticatedUser,
    quotationId: string,
  ): Promise<TenantDataScope> {
    const scope = this.resolveUserScope(user);

    await this.quotationsRepository.assertReadable(scope, quotationId);

    return scope;
  }

  private async assertUserCanWriteQuotation(
    user: AuthenticatedUser,
    quotationId: string,
  ): Promise<TenantDataScope> {
    const scope = this.resolveUserScope(user);

    await this.quotationsRepository.assertWritable(scope, quotationId);

    return scope;
  }

  async create(
    companyId: string,
    payload: CreateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'>,
  ) {
    const contextPayload = await this.resolveCreationContext(
      companyId,
      payload,
      user.id,
    );
    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      contextPayload,
    );

    const scope = await this.validateScope(companyId, preparedPayload);
    await this.refreshPricingBeforeSave(
      companyId,
      preparedPayload,
      scope,
      user,
    );
    const exchangeRateSnapshot = await this.resolveExchangeRateSnapshot(
      companyId,
      preparedPayload,
      user,
    );
    await this.validateAuthoritativePricing(companyId, preparedPayload, {
      productId: scope.product.id,
      riskByCode: this.createPricingAuthorityRiskIndex(scope.riskByCode),
    });
    this.assertDiscountPermissions(preparedPayload, user);
    const lifecycleContext = {
      changedBy: user.id,
      changedByType: 'USER' as const,
      source: 'USER' as const,
      channel: preparedPayload.internal_quotation.channel_type,
      reason: 'Quotation requirements evaluated after creation',
    };

    try {
      const quotationId = await this.dataSource.transaction(async (manager) => {
        const customerId = await this.resolveOrCreateCustomerId(
          manager,
          companyId,
          payload,
          scope.customerId,
          user.id,
        );

        const quotationNo =
          await this.identifierGeneratorService.generateQuotationNumber(
            companyId,
            manager,
          );

        const quotation = await this.persistRoot(
          manager,
          companyId,
          quotationNo,
          preparedPayload,
          user.id,
          customerId,
          null,
        );

        await this.persistAggregate(
          manager,
          quotation,
          preparedPayload,
          scope.riskByCode,
          customerId,
          user.id,
          exchangeRateSnapshot,
        );

        return quotation.id;
      });

      await this.quotationLifecycleService.evaluateRequirements(
        companyId,
        quotationId,
        lifecycleContext,
      );

      const quotation = await this.findOne(companyId, quotationId);
      await this.logDiscountAuditEntries(
        companyId,
        quotationId,
        quotation.quotation_no,
        preparedPayload,
        user.id,
      );
      return quotation;
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async createDraft(
    companyId: string,
    dto: SaveQuotationDraftDto,
    userId: string,
  ) {
    try {
      const quotationId = await this.dataSource.transaction(async (manager) => {
        const quotationNo =
          await this.identifierGeneratorService.generateQuotationNumber(
            companyId,
            manager,
          );
        const { branchId, salePointCode } =
          await this.resolveDraftBranchContext(companyId, userId);
        const productCode = await this.resolveDraftProductCode(
          manager,
          dto.product_id,
        );
        const quotation = await manager.getRepository(Quotation).save(
          manager.getRepository(Quotation).create({
            company_id: companyId,
            insurer_company_id: dto.insurer_company_id ?? companyId,
            intermediary_company_id: dto.intermediary_company_id ?? null,
            branch_id: branchId,
            department_id: dto.department_id ?? null,
            created_by: userId,
            updated_by: userId,
            customer_id: dto.customer_id ?? null,
            category_id: dto.category_id,
            product_id: dto.product_id,
            sub_class_id: dto.sub_class_id ?? null,
            quotation_no: quotationNo,
            quotation_type: dto.quotation_type,
            quotation_flow: dto.quotation_flow,
            is_fleet: dto.is_fleet,
            channel_type: dto.channel_type,
            status: QuotationStatus.DRAFT,
            requires_approval: false,
            requires_payment: false,
            approval_status: ApprovalStatus.NOT_REQUIRED,
            payment_status: PaymentStatus.NOT_REQUIRED,
            tira_status: TiraStatus.NOT_SUBMITTED,
            current_wizard_step: dto.current_wizard_step ?? null,
            draft_payload: this.cloneDraftPayload(dto.draft_payload),
          }),
        );

        await this.upsertDraftPlaceholderAggregate(
          manager,
          quotation,
          dto,
          salePointCode,
          productCode,
        );

        return quotation.id;
      });

      return this.findOneForEdit(companyId, quotationId);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async replace(
    companyId: string,
    id: string,
    payload: UpdateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'>,
  ) {
    await this.assertUserCanWriteQuotation(user as AuthenticatedUser, id);

    const existing = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    this.assertQuotationEditable(existing);
    this.assertNoPremiumOverrideHistory(existing);

    const contextPayload = this.resolveExistingQuotationContext(
      payload,
      existing,
    );
    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      contextPayload,
      existing,
    );

    const scope = await this.validateScope(companyId, preparedPayload);
    await this.refreshPricingBeforeSave(
      companyId,
      preparedPayload,
      scope,
      user,
    );
    const exchangeRateSnapshot = await this.resolveExchangeRateSnapshot(
      companyId,
      preparedPayload,
      user,
    );
    await this.validateAuthoritativePricing(
      companyId,
      preparedPayload,
      {
        productId: scope.product.id,
        riskByCode: this.createPricingAuthorityRiskIndex(scope.riskByCode),
        quotationId: existing.id,
      },
      {
        userId: user.id,
        quotationId: existing.id,
        quotationNo: existing.quotation_no,
        reason: 'Quotation payload validation succeeded before replacement',
      },
    );
    this.assertDiscountPermissions(preparedPayload, user, existing);
    const lifecycleContext = {
      changedBy: user.id,
      changedByType: 'USER' as const,
      source: 'USER' as const,
      channel: preparedPayload.internal_quotation.channel_type,
      reason: 'Quotation payload was replaced',
    };
    let shouldEvaluateRequirements = false;

    try {
      await this.dataSource.transaction(async (manager) => {
        const lockedQuotation = await this.lockQuotationForUpdate(
          manager,
          companyId,
          id,
        );

        this.assertQuotationEditable(lockedQuotation);

        if (
          payload.expected_updated_at &&
          lockedQuotation.updated_at.toISOString() !==
            payload.expected_updated_at
        ) {
          throw new ConflictException(
            'This quotation was updated by another user. Reload the latest version before saving your changes.',
          );
        }

        const previousStatus = lockedQuotation.status;
        const customerId = await this.resolveOrCreateCustomerId(
          manager,
          companyId,
          preparedPayload,
          scope.customerId,
          user.id,
        );

        await manager.getRepository(QuotationCoverNote).delete({
          quotation_id: id,
        });

        await manager.getRepository(QuotationPolicyHolder).delete({
          quotation_id: id,
        });

        const quotation = await this.persistRoot(
          manager,
          companyId,
          lockedQuotation.quotation_no,
          preparedPayload,
          user.id,
          customerId,
          lockedQuotation,
        );

        await this.persistAggregate(
          manager,
          quotation,
          preparedPayload,
          scope.riskByCode,
          customerId,
          user.id,
          exchangeRateSnapshot,
        );

        if (previousStatus !== QuotationStatus.DRAFT) {
          shouldEvaluateRequirements = true;
        }
      });

      if (shouldEvaluateRequirements) {
        await this.quotationLifecycleService.evaluateRequirements(
          companyId,
          id,
          lifecycleContext,
        );
      }

      const quotation = await this.findOne(companyId, id);
      await this.logDiscountAuditEntries(
        companyId,
        id,
        quotation.quotation_no,
        preparedPayload,
        user.id,
      );
      return quotation;
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async updateDraft(
    companyId: string,
    id: string,
    dto: UpdateQuotationDraftDto,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    const userId = user.id;
    const existing = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    this.assertDraftWritable(existing);

    if (
      dto.expected_updated_at &&
      existing.updated_at.toISOString() !== dto.expected_updated_at
    ) {
      throw new ConflictException(
        'This quotation draft was updated by another user. Reload the latest version before saving your changes.',
      );
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const quotation = await this.lockQuotationForUpdate(
          manager,
          companyId,
          id,
        );
        this.assertDraftWritable(quotation);

        const salePointCode =
          quotation.cover_note?.sale_point_code?.trim() ||
          (await this.resolveDraftBranchContext(companyId, userId))
            .salePointCode;
        const productCode = await this.resolveDraftProductCode(
          manager,
          dto.product_id,
        );

        Object.assign(quotation, {
          insurer_company_id: dto.insurer_company_id ?? quotation.company_id,
          intermediary_company_id: dto.intermediary_company_id ?? null,
          department_id: dto.department_id ?? null,
          customer_id: dto.customer_id ?? null,
          category_id: dto.category_id,
          product_id: dto.product_id,
          sub_class_id: dto.sub_class_id ?? null,
          quotation_type: dto.quotation_type,
          quotation_flow: dto.quotation_flow,
          is_fleet: dto.is_fleet,
          channel_type: dto.channel_type,
          updated_by: userId,
          status: QuotationStatus.DRAFT,
          requires_approval: false,
          requires_payment: false,
          approval_status: ApprovalStatus.NOT_REQUIRED,
          payment_status: PaymentStatus.NOT_REQUIRED,
          tira_status: TiraStatus.NOT_SUBMITTED,
          current_wizard_step: dto.current_wizard_step ?? null,
          draft_payload: this.cloneDraftPayload(dto.draft_payload),
        });
        await manager.getRepository(Quotation).save(quotation);

        await this.upsertDraftPlaceholderAggregate(
          manager,
          quotation,
          dto,
          salePointCode,
          productCode,
        );
      });

      return this.findOneForEdit(companyId, id);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async finalize(
    companyId: string,
    id: string,
    payload: UpdateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'>,
  ) {
    await this.assertUserCanWriteQuotation(user as AuthenticatedUser, id);

    const existing = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    this.assertDraftWritable(existing);

    const quotation = await this.replace(companyId, id, payload, user);
    await this.quotationLifecycleService.evaluateRequirements(companyId, id, {
      changedBy: user.id,
      changedByType: 'USER',
      source: 'USER',
      channel: payload.internal_quotation.channel_type,
      reason: 'Quotation finalized from draft',
    });

    await this.dataSource.getRepository(Quotation).update(
      { id, company_id: companyId },
      {
        current_wizard_step: null,
        draft_payload: null,
      },
    );

    return this.findOne(companyId, quotation.id, user);
  }

  async submitForApprovalAction(
    companyId: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    await this.quotationLifecycleService.submitForApproval(companyId, id, {
      changedBy: user.id,
      changedByType: 'USER',
      source: 'USER',
      reason: 'Quotation submitted for approval',
    });

    return this.findOneForUser(user, id);
  }

  async requestPayment(companyId: string, id: string, user: AuthenticatedUser) {
    await this.assertUserCanWriteQuotation(user, id);

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    this.assertPaymentRequestAllowed(quotation);

    const latestInvoice = await this.findLatestInvoice(companyId, id);
    const invoice =
      latestInvoice &&
      !['VOID', 'CANCELLED'].includes(
        String(latestInvoice.status).toUpperCase(),
      )
        ? latestInvoice
        : await this.createQuotationPaymentInvoice(
            companyId,
            quotation,
            user.id,
          );

    await this.quotationLifecycleService.markPaymentRequested(companyId, id, {
      changedBy: user.id,
      changedByType: 'USER',
      source: 'USER',
      reason: `Invoice ${invoice.invoice_no} generated for quotation payment`,
      requestId: invoice.id,
    });

    return this.findOneForUser(user, id);
  }

  async retryTiraSubmission(
    companyId: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    return this.submit(
      companyId,
      id,
      {
        force_resubmit: true,
      },
      user,
    );
  }

  async cancelQuotationAction(
    companyId: string,
    id: string,
    cancellationReason: string,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    const trimmedReason = cancellationReason.trim();
    if (!trimmedReason) {
      throw new BadRequestException(
        'A cancellation reason is required to cancel a quotation',
      );
    }

    await this.dataSource.getRepository(Quotation).update(
      { id, company_id: companyId },
      {
        cancellation_reason: trimmedReason,
        updated_by: user.id,
      },
    );

    await this.quotationLifecycleService.cancelQuotation(companyId, id, {
      changedBy: user.id,
      changedByType: 'USER',
      source: 'USER',
      reason: trimmedReason,
    });

    return this.findOneForUser(user, id);
  }

  async findAll(companyId: string, query: FilterQuotationDto) {
    const result = await this.quotationsRepository.findAll(companyId, query);

    return {
      items: result.items.map((quotation) =>
        this.payloadMapper.toListItem(
          quotation,
          result.extrasByQuotationId.get(quotation.id),
        ),
      ),
      meta: result.meta,
    };
  }

  async findAllForUser(user: AuthenticatedUser, query: FilterQuotationDto) {
    const scope = this.resolveUserScope(user);

    const result = await this.quotationsRepository.findAllForScope(
      scope,
      query,
    );

    return {
      items: result.items.map((quotation) =>
        this.payloadMapper.toListItem(
          quotation,
          result.extrasByQuotationId.get(quotation.id),
        ),
      ),
      meta: result.meta,
    };
  }

  async findOne(
    companyId: string,
    id: string,
    user?: Pick<AuthenticatedUser, 'permissions'> | null,
  ) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    return {
      ...this.payloadMapper.toResponse(quotation),
      current_wizard_step: quotation.current_wizard_step ?? null,
      draft_payload: quotation.draft_payload ?? null,
      cancellation_reason: quotation.cancellation_reason ?? null,
      pricing_integration: this.canViewPricingBreakdown(user)
        ? await this.evaluateQuotationPricingIntegration(companyId, quotation)
        : null,
    };
  }

  async findOneForUser(user: AuthenticatedUser, id: string) {
    const scope = this.resolveUserScope(user);
    const quotation = await this.quotationsRepository.findOneAggregateForScope(
      scope,
      id,
    );

    return {
      ...this.payloadMapper.toResponse(quotation),
      current_wizard_step: quotation.current_wizard_step ?? null,
      draft_payload: quotation.draft_payload ?? null,
      cancellation_reason: quotation.cancellation_reason ?? null,
      pricing_integration: this.canViewPricingBreakdown(user)
        ? await this.evaluateQuotationPricingIntegration(
            quotation.company_id,
            quotation,
          )
        : null,
    };
  }

  async findOneForEdit(
    companyId: string,
    id: string,
    user?: Pick<AuthenticatedUser, 'permissions'> | null,
  ) {
    return this.findOne(companyId, id, user);
  }

  async findOneForEditForUser(user: AuthenticatedUser, id: string) {
    await this.assertUserCanWriteQuotation(user, id);

    return this.findOneForUser(user, id);
  }

  async getAuthoritativePayload(companyId: string, id: string) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    return this.payloadMapper.toAuthoritativePayload(quotation);
  }

  async getAuthoritativePayloadForUser(user: AuthenticatedUser, id: string) {
    const scope = this.resolveUserScope(user);
    const quotation = await this.quotationsRepository.findOneAggregateForScope(
      scope,
      id,
    );

    return this.payloadMapper.toAuthoritativePayload(quotation);
  }

  async getPreview(
    companyId: string,
    id: string,
    user?: Pick<AuthenticatedUser, 'permissions'>,
  ) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    const [
      invoice,
      receipt,
      paymentTransaction,
      portalSubmission,
      tiramisTracking,
      tiramisTrackingByEntry,
    ] = await Promise.all([
      this.findLatestInvoice(companyId, quotation.id),
      this.findLatestReceipt(companyId, quotation.id),
      this.findLatestPaymentTransaction(companyId, quotation.id),
      this.findLatestPortalSubmission(companyId, quotation.id),
      this.findLatestTiramisTracking(companyId, quotation),
      this.findTiramisTrackingByEntry(companyId, quotation),
    ]);

    const response = this.previewMapper.toResponse(
      quotation,
      {
        invoice,
        receipt,
        paymentTransaction,
        portalSubmission,
        portalSubmissionEvents: portalSubmission?.events ?? [],
        tiramisTracking,
        tiramisTrackingByEntry,
      },
      {
        includePremiumOverrides: this.canViewPricingAudit(user),
      },
    );

    return {
      ...response,
      pricing_integration: this.canViewPricingBreakdown(user)
        ? await this.evaluateQuotationPricingIntegration(companyId, quotation)
        : null,
    };
  }

  async getPreviewForUser(user: AuthenticatedUser, id: string) {
    const scope = this.resolveUserScope(user);
    const quotation = await this.quotationsRepository.findOneAggregateForScope(
      scope,
      id,
    );

    /*
     * Do not automatically expose another company's invoices,
     * receipts or payment transactions through partner access.
     */
    const isRecordOwner = quotation.company_id === scope.companyId;

    const [
      invoice,
      receipt,
      paymentTransaction,
      portalSubmission,
      tiramisTracking,
      tiramisTrackingByEntry,
    ] = await Promise.all([
      isRecordOwner
        ? this.findLatestInvoice(quotation.company_id, quotation.id)
        : Promise.resolve(null),
      isRecordOwner
        ? this.findLatestReceipt(quotation.company_id, quotation.id)
        : Promise.resolve(null),
      isRecordOwner
        ? this.findLatestPaymentTransaction(quotation.company_id, quotation.id)
        : Promise.resolve(null),
      this.findLatestPortalSubmission(quotation.company_id, quotation.id),
      this.findLatestTiramisTracking(quotation.company_id, quotation),
      this.findTiramisTrackingByEntry(quotation.company_id, quotation),
    ]);

    const response = this.previewMapper.toResponse(
      quotation,
      {
        invoice,
        receipt,
        paymentTransaction,
        portalSubmission,
        portalSubmissionEvents: portalSubmission?.events ?? [],
        tiramisTracking,
        tiramisTrackingByEntry,
      },
      {
        includePremiumOverrides: this.canViewPricingAudit(user),
      },
    );

    return {
      ...response,
      pricing_integration: this.canViewPricingBreakdown(user)
        ? await this.evaluateQuotationPricingIntegration(
            quotation.company_id,
            quotation,
          )
        : null,
    };
  }

  async requestPremiumOverride(
    companyId: string,
    quotationId: string,
    riskId: string,
    dto: RequestQuotationPremiumOverrideDto,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, quotationId);

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      quotationId,
    );
    this.assertPremiumOverrideWorkflowAllowed(quotation);

    const risk = this.findQuotationRiskOrFail(quotation, riskId);
    this.assertNoPendingPremiumOverride(risk);

    const originalCalculatedPremium =
      await this.resolveOriginalCalculatedPremium(companyId, risk);
    const proposedPremium = roundMoney(dto.proposed_premium);
    this.assertPremiumOverrideProposal(
      risk,
      originalCalculatedPremium,
      proposedPremium,
    );

    const premiumOverride = await this.dataSource.transaction(
      async (manager) => {
        await this.lockQuotationForUpdate(manager, companyId, quotationId);
        const repository = manager.getRepository(QuotationRiskPremiumOverride);

        const savedPremiumOverride = await repository.save(
          repository.create({
            risk_id: risk.id,
            sequence_no: (risk.premium_overrides?.length ?? 0) + 1,
            original_calculated_premium: this.numeric(
              originalCalculatedPremium,
              2,
            ),
            proposed_premium: this.numeric(proposedPremium, 2),
            difference_amount: this.numeric(
              roundMoney(proposedPremium - originalCalculatedPremium),
              2,
            ),
            difference_percentage:
              originalCalculatedPremium > 0
                ? this.numeric(
                    ((proposedPremium - originalCalculatedPremium) /
                      originalCalculatedPremium) *
                      100,
                    6,
                  )
                : null,
            override_reason: dto.override_reason.trim(),
            supporting_notes: dto.supporting_notes?.trim() || null,
            requested_by: user.id,
            requested_at: new Date(),
            approval_status: QuotationPremiumOverrideStatus.PENDING,
          }),
        );

        await manager.getRepository(Quotation).update(quotation.id, {
          updated_by: user.id,
        });

        return savedPremiumOverride;
      },
    );

    await this.auditService.log({
      userId: user.id,
      companyId,
      action: 'quotation.premium_override.requested',
      resource: 'quotation_risk',
      resourceId: risk.id,
      metadata: {
        quotationId,
        quotationNo: quotation.quotation_no,
        riskId: risk.id,
        riskCode: risk.risk_code,
        premiumOverrideId: premiumOverride.id,
        old_value: {
          premium_before_discount: originalCalculatedPremium,
        },
        new_value: {
          proposed_premium: proposedPremium,
          difference_amount: roundMoney(
            proposedPremium - originalCalculatedPremium,
          ),
        },
        reason: dto.override_reason.trim(),
        correlation_id: premiumOverride.id,
      },
    });

    return {
      id: premiumOverride.id,
      approval_status: premiumOverride.approval_status,
    };
  }

  async approvePremiumOverride(
    companyId: string,
    quotationId: string,
    riskId: string,
    overrideId: string,
    dto: DecideQuotationPremiumOverrideDto,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, quotationId);

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      quotationId,
    );
    this.assertPremiumOverrideWorkflowAllowed(quotation);

    const risk = this.findQuotationRiskOrFail(quotation, riskId);
    const premiumOverride = this.findPremiumOverrideOrFail(risk, overrideId);

    if (
      premiumOverride.approval_status !== QuotationPremiumOverrideStatus.PENDING
    ) {
      throw new ConflictException(
        'Only pending premium overrides can be approved',
      );
    }

    if (
      premiumOverride.requested_by &&
      premiumOverride.requested_by === user.id
    ) {
      throw new ConflictException(
        'You cannot approve your own premium override request',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.lockQuotationForUpdate(manager, companyId, quotationId);

      await manager.getRepository(QuotationRiskPremiumOverride).update(
        { id: premiumOverride.id, risk_id: risk.id },
        {
          approval_status: QuotationPremiumOverrideStatus.APPROVED,
          approved_by: user.id,
          approved_at: new Date(),
          rejection_reason: null,
        },
      );

      await this.applyApprovedPremiumOverride(
        manager,
        quotation,
        risk,
        premiumOverride.proposed_premium,
      );

      await manager.getRepository(Quotation).update(quotation.id, {
        updated_by: user.id,
      });
    });

    await this.auditService.log({
      userId: user.id,
      companyId,
      action: 'quotation.premium_override.approved',
      resource: 'quotation_risk',
      resourceId: risk.id,
      metadata: {
        quotationId,
        quotationNo: quotation.quotation_no,
        riskId: risk.id,
        riskCode: risk.risk_code,
        premiumOverrideId: premiumOverride.id,
        old_value: {
          premium_before_discount: Number(
            premiumOverride.original_calculated_premium,
          ),
        },
        new_value: {
          proposed_premium: Number(premiumOverride.proposed_premium),
        },
        reason: dto.rejection_reason?.trim() || premiumOverride.override_reason,
        correlation_id: premiumOverride.id,
      },
    });

    return {
      id: premiumOverride.id,
      approval_status: QuotationPremiumOverrideStatus.APPROVED,
    };
  }

  async rejectPremiumOverride(
    companyId: string,
    quotationId: string,
    riskId: string,
    overrideId: string,
    dto: DecideQuotationPremiumOverrideDto,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, quotationId);

    const rejectionReason = dto.rejection_reason?.trim();
    if (!rejectionReason) {
      throw new BadRequestException(
        'A rejection reason is required when rejecting a premium override',
      );
    }

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      quotationId,
    );
    this.assertPremiumOverrideWorkflowAllowed(quotation);

    const risk = this.findQuotationRiskOrFail(quotation, riskId);
    const premiumOverride = this.findPremiumOverrideOrFail(risk, overrideId);

    if (
      premiumOverride.approval_status !== QuotationPremiumOverrideStatus.PENDING
    ) {
      throw new ConflictException(
        'Only pending premium overrides can be rejected',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.lockQuotationForUpdate(manager, companyId, quotationId);

      await manager.getRepository(QuotationRiskPremiumOverride).update(
        { id: premiumOverride.id, risk_id: risk.id },
        {
          approval_status: QuotationPremiumOverrideStatus.REJECTED,
          approved_by: user.id,
          approved_at: new Date(),
          rejection_reason: rejectionReason,
        },
      );

      await manager.getRepository(Quotation).update(quotation.id, {
        updated_by: user.id,
      });
    });

    await this.auditService.log({
      userId: user.id,
      companyId,
      action: 'quotation.premium_override.rejected',
      resource: 'quotation_risk',
      resourceId: risk.id,
      metadata: {
        quotationId,
        quotationNo: quotation.quotation_no,
        riskId: risk.id,
        riskCode: risk.risk_code,
        premiumOverrideId: premiumOverride.id,
        old_value: {
          proposed_premium: Number(premiumOverride.proposed_premium),
        },
        new_value: {
          approval_status: QuotationPremiumOverrideStatus.REJECTED,
        },
        reason: rejectionReason,
        correlation_id: premiumOverride.id,
      },
      status: 'failure',
    });

    return {
      id: premiumOverride.id,
      approval_status: QuotationPremiumOverrideStatus.REJECTED,
    };
  }

  async remove(companyId: string, id: string): Promise<void> {
    return this.removeDraft(companyId, id);
  }

  async removeDraft(companyId: string, id: string): Promise<void> {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    await this.assertDraftDeletionAllowed(companyId, quotation);

    const result = await this.dataSource.getRepository(Quotation).softDelete({
      id,
      company_id: companyId,
    });

    if (!result.affected) {
      throw new NotFoundException('Quotation not found');
    }
  }

  async removeDraftForUser(user: AuthenticatedUser, id: string): Promise<void> {
    await this.assertUserCanWriteQuotation(user, id);

    const quotation = await this.quotationsRepository.findOneAggregate(
      user.companyId!,
      id,
    );

    await this.assertDraftDeletionAllowed(user.companyId!, quotation);

    const result = await this.dataSource.getRepository(Quotation).softDelete({
      id,
      company_id: user.companyId!,
    });

    if (!result.affected) {
      throw new NotFoundException('Quotation not found');
    }
  }

  async submit(
    companyId: string,
    id: string,
    dto: SubmitQuotationDto | undefined,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    const submitOptions = dto ?? {};

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    if (TERMINAL_QUOTATION_STATUSES.includes(quotation.status)) {
      throw new ConflictException(
        `Quotation in ${quotation.status} status cannot be submitted`,
      );
    }

    if (
      quotation.submitted_at &&
      !submitOptions.force_resubmit &&
      !submitOptions.return_existing
    ) {
      throw new ConflictException(
        'Quotation has already been submitted. Use return_existing to return the existing submission or force_resubmit to send it again.',
      );
    }

    const shouldReuseExistingSubmission =
      !!submitOptions.return_existing &&
      quotation.tira_status !== TiraStatus.NOT_SUBMITTED;
    const requestType = this.toTiramisRequestType(quotation.quotation_flow);

    const { tiramisPayload } = await this.prepareTrustedTiraSubmission(
      companyId,
      quotation,
      submitOptions,
      user.id,
    );

    if (!shouldReuseExistingSubmission) {
      await this.quotationLifecycleService.startTiraSubmission(
        companyId,
        quotation.id,
        {
          changedBy: user.id,
          changedByType: 'USER',
          source: 'USER',
          channel: quotation.channel_type,
          reason: submitOptions.force_resubmit
            ? 'Quotation resubmitted to TIRAMIS'
            : 'Quotation submitted to TIRAMIS',
          metadata: {
            forceResubmit: !!submitOptions.force_resubmit,
            returnExisting: !!submitOptions.return_existing,
          },
        },
        {
          allowRetryFromFailure: !!submitOptions.force_resubmit,
        },
      );
    }

    let result: Record<string, unknown>;

    try {
      result = await this.tiramisBusinessSubmitService.submitAnyBusinessRecord({
        requestType,
        sourceModule: 'quotations',
        sourceRecordId: quotation.id,
        businessReference: this.payloadMapper.businessReference(quotation),
        payload: tiramisPayload,
        forceResubmit: submitOptions.force_resubmit,
        returnExisting: submitOptions.return_existing,
        authContext: {
          ...user,
          userId: user.id,
          companyId,
          branchId:
            quotation.branch_id ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).branchId ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).activeBranchId ??
            null,
          activeBranchId:
            quotation.branch_id ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).branchId ??
            (
              user as AuthenticatedUser & {
                branchId?: string | null;
                activeBranchId?: string | null;
              }
            ).activeBranchId ??
            null,
        },
      });
    } catch (error) {
      if (!shouldReuseExistingSubmission) {
        await this.quotationLifecycleService.markTiraFailed(
          companyId,
          quotation.id,
          {
            changedBy: user.id,
            changedByType: 'USER',
            source: 'SYSTEM',
            channel: quotation.channel_type,
            reason:
              error instanceof Error
                ? error.message
                : 'TIRAMIS submission failed',
            metadata: {
              error:
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                    }
                  : { value: String(error) },
            },
          },
        );
      }
      throw error;
    }

    const submittedAt = new Date();

    if (!shouldReuseExistingSubmission) {
      await this.quotationLifecycleService.markTiraSubmitted(
        companyId,
        quotation.id,
        {
          changedBy: user.id,
          changedByType: 'USER',
          source: 'USER',
          channel: quotation.channel_type,
          reason: 'TIRAMIS accepted the submission request',
          tiraRequestId:
            typeof (result as { requestId?: unknown }).requestId === 'string'
              ? ((result as { requestId?: string }).requestId ?? null)
              : null,
          metadata: result,
        },
      );
    }

    return {
      quotation_id: quotation.id,
      quotation_no: quotation.quotation_no,
      request_type: requestType,
      submitted_at: submittedAt.toISOString(),
      submission: result,
    };
  }

  async transitionStatus(
    companyId: string,
    id: string,
    dto: TransitionQuotationStatusDto,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    const userId = user.id;
    const context = {
      changedBy: userId,
      changedByType: 'USER',
      source: 'USER',
      reason: dto.reason?.trim() || undefined,
      comments: dto.comments?.trim() || undefined,
      paymentTransactionId: dto.payment_transaction_id?.trim() || undefined,
      requestId: dto.request_id?.trim() || undefined,
      tiraRequestId: dto.tira_request_id?.trim() || undefined,
      tiraResponseId: dto.tira_response_id?.trim() || undefined,
      metadata: dto.metadata ?? undefined,
    };

    if (
      [
        QuotationStatusTransitionAction.REQUEST_CHANGES,
        QuotationStatusTransitionAction.REJECT_APPROVAL,
        QuotationStatusTransitionAction.CANCEL,
        QuotationStatusTransitionAction.EXPIRE,
      ].includes(dto.action) &&
      !context.reason
    ) {
      throw new BadRequestException(
        `A reason is required to ${dto.action.toLowerCase().replace(/_/g, ' ')}`,
      );
    }

    if (this.requiresPricingAuthorityValidation(dto.action)) {
      const quotation = await this.quotationsRepository.findOneAggregate(
        companyId,
        id,
      );
      const payload = this.payloadMapper.toAuthoritativePayload(quotation);
      await this.validateAuthoritativePricing(
        companyId,
        payload,
        {
          productId: quotation.product_id,
          riskByCode: this.createPersistedPricingAuthorityRiskIndex(quotation),
          quotationId: quotation.id,
          approvedOverridePremiums:
            this.buildApprovedPremiumOverrideIndex(quotation),
        },
        {
          userId,
          quotationId: quotation.id,
          quotationNo: quotation.quotation_no,
          reason: `Quotation pricing validated before status transition ${dto.action}`,
        },
      );
    }

    switch (dto.action) {
      case QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS:
        await this.quotationLifecycleService.evaluateRequirements(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.SUBMIT_FOR_APPROVAL:
        await this.quotationLifecycleService.submitForApproval(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.APPROVE:
        await this.quotationLifecycleService.approveQuotation(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.REQUEST_CHANGES:
        await this.quotationLifecycleService.requestChanges(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.REJECT_APPROVAL:
        await this.quotationLifecycleService.rejectApproval(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PAYMENT_REQUESTED:
        await this.quotationLifecycleService.markPaymentRequested(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PAYMENT_PROCESSING:
        await this.quotationLifecycleService.markPaymentProcessing(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PARTIALLY_PAID:
        await this.quotationLifecycleService.markPartiallyPaid(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PAYMENT_PAID:
        await this.quotationLifecycleService.markPaymentPaid(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PAYMENT_FAILED:
        await this.quotationLifecycleService.markPaymentFailed(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PAYMENT_EXPIRED:
        await this.quotationLifecycleService.markPaymentExpired(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.MARK_PAYMENT_REFUNDED:
        await this.quotationLifecycleService.markPaymentRefunded(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.CANCEL:
        await this.quotationLifecycleService.cancelQuotation(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.EXPIRE:
        await this.quotationLifecycleService.expireQuotation(
          companyId,
          id,
          context,
        );
        break;
      case QuotationStatusTransitionAction.CONVERT:
        await this.quotationLifecycleService.convertQuotation(
          companyId,
          id,
          context,
        );
        break;
      default:
        throw new ConflictException(
          `Unsupported quotation transition ${dto.action}`,
        );
    }

    return this.findOneForUser(user, id);
  }

  private assertDraftWritable(quotation: Quotation): void {
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new ConflictException('Only draft quotations can be updated');
    }

    if (quotation.tira_status !== TiraStatus.NOT_SUBMITTED) {
      throw new ConflictException(
        'Only unsubmitted draft quotations can be updated',
      );
    }
  }

  private async resolveDraftBranchContext(companyId: string, userId: string) {
    const assignment = await this.branchUserRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.branch', 'branch')
      .innerJoin('assignment.company_user', 'companyUser')
      .where('companyUser.user_id = :userId', { userId })
      .andWhere('companyUser.company_id = :companyId', { companyId })
      .andWhere('companyUser.status = :membershipStatus', {
        membershipStatus: 'active',
      })
      .andWhere('assignment.is_active_branch = true')
      .getOne();

    const branch = assignment?.branch;
    if (
      !assignment ||
      !branch ||
      branch.company_id !== companyId ||
      branch.status !== 'active' ||
      branch.deleted_at
    ) {
      throw new BadRequestException(
        'You do not have a valid active branch. Please select an active branch before saving a quotation draft.',
      );
    }

    const defaultSalePoints = await this.salePointRepository.find({
      where: {
        companyId,
        branchId: branch.id,
        isDefault: true,
        isActive: true,
      },
    });
    if (defaultSalePoints.length !== 1) {
      throw new BadRequestException(
        'The active branch does not have a valid default sales point. Please configure it before saving a quotation draft.',
      );
    }

    return {
      branchId: branch.id,
      salePointCode: defaultSalePoints[0].salePointCode.trim().toUpperCase(),
    };
  }

  private async resolveDraftProductCode(
    manager: EntityManager,
    productId: string,
  ): Promise<string> {
    const product = await manager.getRepository(InsuranceProduct).findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Selected product was not found');
    }

    return (
      product.tiramis_product_code?.trim() ||
      product.product_code?.trim() ||
      product.id
    );
  }

  private cloneDraftPayload(
    payload: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    return JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>;
  }

  private async upsertDraftPlaceholderAggregate(
    manager: EntityManager,
    quotation: Quotation,
    draft: SaveQuotationDraftDto | UpdateQuotationDraftDto,
    salePointCode: string,
    productCode: string,
  ) {
    const payload = this.cloneDraftPayload(draft.draft_payload);
    const coverNoteRepository = manager.getRepository(QuotationCoverNote);
    const entryRepository = manager.getRepository(QuotationCoverNoteEntry);
    const motorRepository = manager.getRepository(QuotationMotorDetail);

    const today = new Date().toISOString().slice(0, 10);
    const validFrom = this.draftDateTime(payload, 'valid_from', today, false);
    const validUntil = this.draftDateTime(payload, 'valid_until', today, true);
    const fleet = this.draftObject(payload, 'fleet');
    const fleetItems = this.draftArray(fleet, 'items');
    const firstFleetItem =
      fleetItems.length > 0 ? fleetItems[0] : ({} as Record<string, unknown>);

    const coverNote = await coverNoteRepository.save(
      coverNoteRepository.create({
        ...(await coverNoteRepository.findOne({
          where: { quotation_id: quotation.id },
        })),
        quotation_id: quotation.id,
        cover_note_type: this.draftInteger(payload, 'cover_note_type', 1),
        sale_point_code: salePointCode,
        cover_note_start_date: parseTiramisDateTime(validFrom),
        cover_note_end_date: parseTiramisDateTime(validUntil),
        payment_mode: this.draftInteger(
          payload,
          'payment_mode_tira',
          DIRECT_PAYMENT_MODE,
        ),
        currency_code: this.draftString(payload, 'currency', 'TZS')
          .trim()
          .toUpperCase(),
        exchange_rate: this.numeric(
          this.draftNumber(payload, 'exchange_rate', 1),
          6,
        ),
        exchange_rate_snapshot: null,
        total_premium_excluding_tax: this.numeric(
          this.draftNumber(payload, 'basic_premium', 0),
          2,
        ),
        total_premium_including_tax: this.numeric(
          this.draftNumber(payload, 'total_premium', 0),
          2,
        ),
        commission_paid: this.numeric(
          this.draftNumber(payload, 'commission_paid', 0),
          2,
        ),
        commission_rate: this.numeric(
          this.draftNumber(payload, 'commission_rate', 0),
          6,
        ),
        officer_name: this.draftString(
          payload,
          'officer_name',
          'Draft quotation',
        ),
        officer_title: this.draftString(payload, 'officer_title', 'Draft'),
        product_code: productCode,
        fleet_id:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? this.draftString(fleet, 'fleet_id', quotation.quotation_no)
            : null,
        fleet_type:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? this.draftInteger(fleet, 'fleet_type', 1)
            : null,
        fleet_size:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? Math.max(
                this.draftInteger(fleet, 'declared_total_vehicles', 0),
                fleetItems.length,
              )
            : null,
        comprehensive_insured:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? this.draftInteger(fleet, 'comprehensive_insured_count', 0)
            : null,
      }),
    );

    const entryType =
      draft.quotation_flow === QuotationFlow.MOTOR_FLEET
        ? QuotationEntryType.FLEET_ITEM
        : QuotationEntryType.STANDARD;
    const coverNoteNumber =
      draft.quotation_flow === QuotationFlow.MOTOR_FLEET
        ? this.draftString(
            firstFleetItem,
            'cover_note_number',
            `${quotation.quotation_no}-1`,
          )
        : this.draftString(
            payload,
            'cover_note_number',
            quotation.quotation_no,
          );
    const endorsementType =
      draft.quotation_flow === QuotationFlow.MOTOR_FLEET
        ? this.draftNullableInteger(firstFleetItem, 'endorsement_type')
        : this.draftNullableInteger(payload, 'endorsement_type');
    const endorsementReason =
      draft.quotation_flow === QuotationFlow.MOTOR_FLEET
        ? this.draftNullableString(firstFleetItem, 'endorsement_reason')
        : this.draftNullableString(payload, 'endorsement_reason');
    const endorsementPremiumEarned =
      endorsementType === null
        ? null
        : this.numeric(
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftNumber(
                  firstFleetItem,
                  'endorsement_premium_earned',
                  0,
                )
              : this.draftNumber(payload, 'endorsement_premium_earned', 0),
            2,
          );
    const entry = await entryRepository.save(
      entryRepository.create({
        ...(await entryRepository.findOne({
          where: {
            cover_note_id: coverNote.id,
            entry_number: 1,
          },
        })),
        cover_note_id: coverNote.id,
        entry_type: entryType,
        entry_number: 1,
        fleet_entry:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET ? 1 : null,
        cover_note_number: coverNoteNumber,
        prev_cover_note_reference_number:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? this.draftNullableString(
                firstFleetItem,
                'prev_cover_note_reference_number',
              )
            : this.draftNullableString(payload, 'prev_cover_note_reference'),
        cover_note_desc:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? this.draftString(
                firstFleetItem,
                'cover_note_desc',
                'Draft vehicle',
              )
            : this.draftString(payload, 'cover_note_desc', 'Draft quotation'),
        operative_clause:
          draft.quotation_flow === QuotationFlow.MOTOR_FLEET
            ? this.draftString(firstFleetItem, 'operative_clause', 'Draft')
            : this.draftString(payload, 'operative_clause', 'Draft'),
        endorsement_type: endorsementType,
        endorsement_reason: endorsementReason,
        endorsement_premium_earned: endorsementPremiumEarned,
      }),
    );

    if (
      draft.quotation_flow === QuotationFlow.MOTOR_SINGLE ||
      draft.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      const motorSource =
        draft.quotation_flow === QuotationFlow.MOTOR_FLEET
          ? (this.draftObject(firstFleetItem, 'motor_dtl') ?? firstFleetItem)
          : this.draftObject(payload, 'motor');
      const tareWeight = roundMoney(
        Math.max(this.draftNumber(motorSource, 'tare_weight', 0), 0),
      );
      const grossWeight = roundMoney(
        Math.max(
          this.draftNumber(motorSource, 'gross_weight', tareWeight),
          tareWeight,
        ),
      );

      await motorRepository.save(
        motorRepository.create({
          ...(await motorRepository.findOne({
            where: {
              entry_id: entry.id,
            },
          })),
          entry_id: entry.id,
          motor_category: Math.max(
            this.draftInteger(
              motorSource,
              draft.quotation_flow === QuotationFlow.MOTOR_FLEET
                ? 'motor_category'
                : 'motor_category_code',
              1,
            ),
            1,
          ),
          motor_type: Math.max(
            this.draftInteger(
              motorSource,
              draft.quotation_flow === QuotationFlow.MOTOR_FLEET
                ? 'motor_type'
                : 'motor_type_code',
              1,
            ),
            1,
          ),
          registration_number:
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftString(
                  motorSource,
                  'registration_number',
                  'DRAFT-REG',
                )
              : this.draftString(motorSource, 'registration_no', 'DRAFT-REG'),
          chassis_number:
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftString(motorSource, 'chassis_number', 'DRAFT-CHASSIS')
              : this.draftString(motorSource, 'chassis_no', 'DRAFT-CHASSIS'),
          make: this.draftString(motorSource, 'make', 'Draft'),
          model: this.draftString(motorSource, 'model', 'Draft'),
          model_number:
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftNullableString(motorSource, 'model_number')
              : this.draftNullableString(motorSource, 'model_no'),
          body_type: this.draftString(motorSource, 'body_type', 'Draft'),
          color: this.draftString(motorSource, 'color', 'Draft'),
          engine_number:
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftString(motorSource, 'engine_number', 'DRAFT-ENGINE')
              : this.draftString(motorSource, 'engine_no', 'DRAFT-ENGINE'),
          engine_capacity:
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftString(motorSource, 'engine_capacity', '0')
              : this.draftString(motorSource, 'cubic_capacity', '0'),
          fuel_used:
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftString(motorSource, 'fuel_used', 'UNKNOWN')
              : this.draftString(motorSource, 'fuel_type', 'UNKNOWN'),
          number_of_axles: Math.max(
            this.draftInteger(motorSource, 'number_of_axles', 1),
            1,
          ),
          axle_distance: this.numeric(
            this.draftNumber(motorSource, 'axle_distance', 0),
            2,
          ),
          sitting_capacity: Math.max(
            draft.quotation_flow === QuotationFlow.MOTOR_FLEET
              ? this.draftInteger(motorSource, 'sitting_capacity', 1)
              : this.draftInteger(motorSource, 'seating_capacity', 1),
            1,
          ),
          year_of_manufacture: Math.min(
            Math.max(
              this.draftInteger(
                motorSource,
                draft.quotation_flow === QuotationFlow.MOTOR_FLEET
                  ? 'year_of_manufacture'
                  : 'manufacture_year',
                2000,
              ),
              1886,
            ),
            2100,
          ),
          tare_weight: this.numeric(tareWeight, 2),
          gross_weight: this.numeric(grossWeight, 2),
          motor_usage: Math.max(
            this.draftInteger(
              motorSource,
              draft.quotation_flow === QuotationFlow.MOTOR_FLEET
                ? 'motor_usage'
                : 'motor_usage_code',
              1,
            ),
            1,
          ),
          owner_name: this.draftString(
            motorSource,
            'owner_name',
            'Draft owner',
          ),
          owner_category: Math.max(
            this.draftInteger(motorSource, 'owner_category', 1),
            1,
          ),
          owner_address: this.draftString(
            motorSource,
            'owner_address',
            'Draft address',
          ),
        }),
      );
    } else {
      await motorRepository.delete({
        entry_id: entry.id,
      });
    }
  }

  private draftObject(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown> | null {
    const value = payload?.[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private draftArray(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown>[] {
    const value = payload?.[key];
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private draftString(
    payload: Record<string, unknown> | null | undefined,
    key: string,
    fallback = '',
  ): string {
    const value = payload?.[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || fallback;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return fallback;
  }

  private draftNullableString(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ): string | null {
    const value = this.draftString(payload, key, '');
    return value ? value : null;
  }

  private draftNumber(
    payload: Record<string, unknown> | null | undefined,
    key: string,
    fallback = 0,
  ): number {
    const value = payload?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = Number(value);
      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }

    return fallback;
  }

  private draftInteger(
    payload: Record<string, unknown> | null | undefined,
    key: string,
    fallback = 0,
  ): number {
    return Math.trunc(this.draftNumber(payload, key, fallback));
  }

  private draftNullableInteger(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ): number | null {
    const value = this.draftNullableString(payload, key);
    if (value === null) {
      return null;
    }

    const normalized = Number(value);
    return Number.isFinite(normalized) ? Math.trunc(normalized) : null;
  }

  private draftDateTime(
    payload: Record<string, unknown> | null | undefined,
    key: string,
    fallbackDate: string,
    endOfDay: boolean,
  ): string {
    const value = this.draftString(payload, key, fallbackDate);
    if (value.includes('T')) {
      return value;
    }

    return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  private assertPaymentRequestAllowed(quotation: Quotation): void {
    if (quotation.status === QuotationStatus.DRAFT) {
      throw new ConflictException(
        'Complete the quotation before requesting payment',
      );
    }

    if (!quotation.requires_payment) {
      throw new ConflictException('Payment is not required for this quotation');
    }

    if (
      quotation.requires_approval &&
      quotation.approval_status !== ApprovalStatus.APPROVED
    ) {
      throw new ConflictException(
        `Approval must be completed before requesting payment. Current approval status is ${quotation.approval_status}.`,
      );
    }

    if (
      ![
        PaymentStatus.NOT_INITIATED,
        PaymentStatus.FAILED,
        PaymentStatus.EXPIRED,
      ].includes(quotation.payment_status)
    ) {
      throw new ConflictException(
        `Payment cannot be requested from ${quotation.payment_status}.`,
      );
    }

    if (!quotation.customer_id) {
      throw new ConflictException(
        'A linked customer is required before requesting payment',
      );
    }
  }

  private async createQuotationPaymentInvoice(
    companyId: string,
    quotation: Quotation,
    userId: string,
  ): Promise<Invoice> {
    const invoiceRepository = this.dataSource.getRepository(Invoice);
    const invoiceNo = await this.nextInvoiceNumber(companyId);
    const currency =
      quotation.cover_note?.currency_code?.trim().toUpperCase() ?? 'TZS';
    const grossAmount = Number(
      quotation.cover_note?.total_premium_excluding_tax ?? 0,
    );
    const totalAmount = Number(
      quotation.cover_note?.total_premium_including_tax ?? grossAmount,
    );
    const taxAmount = roundMoney(totalAmount - grossAmount);
    const customerId = quotation.customer_id;

    if (!customerId) {
      throw new ConflictException(
        'A linked customer is required before requesting payment',
      );
    }

    const invoice = invoiceRepository.create({
      company_id: companyId,
      insurer_company_id: quotation.insurer_company_id,
      intermediary_company_id: quotation.intermediary_company_id ?? null,
      customer_id: customerId,
      quotation_id: quotation.id,
      invoice_no: invoiceNo,
      invoice_type: 'POLICY',
      currency,
      gross_amount: this.numeric(grossAmount, 2),
      discount_amount: this.numeric(0, 2),
      tax_amount: this.numeric(taxAmount, 2),
      charges_amount: this.numeric(0, 2),
      total_amount: this.numeric(totalAmount, 2),
      paid_amount: this.numeric(0, 2),
      balance_amount: this.numeric(totalAmount, 2),
      status: 'ISSUED',
      created_by: userId,
      updated_by: userId,
    });

    return invoiceRepository.save(invoice);
  }

  private async nextInvoiceNumber(companyId: string): Promise<string> {
    const repository = this.dataSource.getRepository(Invoice);
    const prefix = `INV-${new Date().getFullYear()}-`;
    const last = await repository
      .createQueryBuilder('invoice')
      .where('invoice.company_id = :companyId', { companyId })
      .andWhere('invoice.invoice_no LIKE :prefix', {
        prefix: `${prefix}%`,
      })
      .orderBy('invoice.invoice_no', 'DESC')
      .limit(1)
      .getOne();

    const current = last?.invoice_no ?? '';
    const next = current ? Number(current.substring(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private async assertDraftDeletionAllowed(
    companyId: string,
    quotation: Quotation,
  ): Promise<void> {
    if (quotation.submitted_at) {
      throw new ConflictException('A submitted quotation cannot be deleted');
    }

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new ConflictException('Only draft quotations can be deleted');
    }

    if (quotation.tira_status !== TiraStatus.NOT_SUBMITTED) {
      throw new ConflictException(
        'Only quotations that were never submitted to TIRA can be deleted',
      );
    }

    if (
      ![ApprovalStatus.NOT_REQUIRED, ApprovalStatus.NOT_SUBMITTED].includes(
        quotation.approval_status,
      )
    ) {
      throw new ConflictException(
        'Drafts with approval history cannot be deleted',
      );
    }

    if (
      ![PaymentStatus.NOT_REQUIRED, PaymentStatus.NOT_INITIATED].includes(
        quotation.payment_status,
      )
    ) {
      throw new ConflictException(
        'Drafts with payment activity cannot be deleted',
      );
    }

    if (
      quotation.approval_submitted_at ||
      quotation.approval_decided_at ||
      quotation.payment_requested_at ||
      quotation.payment_completed_at ||
      quotation.tira_request_id ||
      quotation.tira_response_id
    ) {
      throw new ConflictException(
        'Draft quotations with approval, payment, or TIRA history cannot be deleted',
      );
    }

    if (quotation.status_history.length > 0) {
      throw new ConflictException(
        'Draft quotations with audit history cannot be deleted',
      );
    }

    const [
      invoiceCount,
      receiptCount,
      paymentTransactionCount,
      portalCount,
      trackingCount,
    ] = await Promise.all([
      this.dataSource.getRepository(Invoice).count({
        where: {
          company_id: companyId,
          quotation_id: quotation.id,
        },
      }),
      this.dataSource
        .getRepository(Receipt)
        .createQueryBuilder('receipt')
        .innerJoin('receipt.invoice', 'invoice')
        .where('receipt.company_id = :companyId', { companyId })
        .andWhere('invoice.quotation_id = :quotationId', {
          quotationId: quotation.id,
        })
        .andWhere('receipt.deleted_at IS NULL')
        .getCount(),
      this.dataSource
        .getRepository(PaymentTransaction)
        .createQueryBuilder('paymentTransaction')
        .innerJoin('paymentTransaction.invoice', 'invoice')
        .where('paymentTransaction.company_id = :companyId', { companyId })
        .andWhere('invoice.quotation_id = :quotationId', {
          quotationId: quotation.id,
        })
        .andWhere('paymentTransaction.deleted_at IS NULL')
        .getCount(),
      this.dataSource.getRepository(PortalTiraSubmission).count({
        where: {
          company_id: companyId,
          quotation_id: quotation.id,
        },
      }),
      this.dataSource
        .getRepository(TiramisSubmissionTrackingEntity)
        .createQueryBuilder('tracking')
        .where('tracking.sourceCompanyId = :companyId', { companyId })
        .andWhere('tracking.quotationId = :quotationId', {
          quotationId: quotation.id,
        })
        .andWhere('tracking.deletedAt IS NULL')
        .getCount(),
    ]);

    if (
      invoiceCount > 0 ||
      receiptCount > 0 ||
      paymentTransactionCount > 0 ||
      portalCount > 0 ||
      trackingCount > 0
    ) {
      throw new ConflictException(
        'Draft quotations with approval, payment, TIRA, or financial history cannot be deleted',
      );
    }
  }

  private async validateScope(
    companyId: string,
    payload: CreateQuotationDto,
  ): Promise<ScopeValidationResult> {
    const internal = payload.internal_quotation;
    const header = this.resolveHeader(payload);

    const companyRepository = this.dataSource.getRepository(Company);
    const branchRepository = this.dataSource.getRepository(Branch);
    const departmentRepository = this.dataSource.getRepository(Department);
    const categoryRepository = this.dataSource.getRepository(InsuranceCategory);
    const productRepository = this.dataSource.getRepository(InsuranceProduct);
    const subClassRepository = this.dataSource.getRepository(InsuranceSubClass);
    const riskRepository = this.dataSource.getRepository(InsuranceRisk);

    const [tenantCompany, insurerCompany, category, product] =
      await Promise.all([
        companyRepository.findOne({ where: { id: companyId } }),
        companyRepository.findOne({
          where: { id: internal.insurer_company_id },
        }),
        categoryRepository.findOne({
          where: {
            id: internal.category_id,
            company_id: internal.insurer_company_id,
          },
        }),
        productRepository.findOne({
          where: {
            id: internal.product_id,
            company_id: internal.insurer_company_id,
          },
        }),
      ]);

    if (!tenantCompany) {
      throw new BadRequestException('Current company was not found');
    }

    if (tenantCompany.status !== 'active') {
      throw new BadRequestException('Current company is not active');
    }

    if (!insurerCompany) {
      throw new BadRequestException('Insurer company was not found');
    }

    if (insurerCompany.status !== 'active') {
      throw new BadRequestException('Insurer company is not active');
    }

    if (!category) {
      throw new BadRequestException(
        'Insurance category was not found for the selected insurer',
      );
    }

    if (!category.is_active) {
      throw new BadRequestException('Selected insurance category is inactive');
    }

    if (!product) {
      throw new BadRequestException(
        'Insurance product was not found for the selected insurer',
      );
    }

    if (!product.is_active) {
      throw new BadRequestException('Selected insurance product is inactive');
    }

    if (product.category_id !== category.id) {
      throw new BadRequestException(
        'Selected product does not belong to the selected category',
      );
    }

    const expectedBusinessLine =
      internal.quotation_flow === QuotationFlow.NON_MOTOR
        ? InsuranceBusinessLine.NON_MOTOR
        : InsuranceBusinessLine.MOTOR;

    if (
      category.business_line !== expectedBusinessLine ||
      product.business_line !== expectedBusinessLine
    ) {
      throw new BadRequestException(
        `Category and product must support ${expectedBusinessLine}`,
      );
    }

    if (
      internal.quotation_flow === QuotationFlow.MOTOR_FLEET &&
      !product.supports_fleet
    ) {
      throw new BadRequestException(
        'Selected product does not support motor fleet quotations',
      );
    }

    if (
      product.tiramis_product_code &&
      this.normalizeUppercase(product.tiramis_product_code) !==
        this.normalizeUppercase(header.product_code)
    ) {
      throw new BadRequestException(
        `cover note product_code must be ${product.tiramis_product_code}`,
      );
    }

    if (internal.intermediary_company_id) {
      const intermediary = await companyRepository.findOne({
        where: {
          id: internal.intermediary_company_id,
        },
      });

      if (!intermediary) {
        throw new BadRequestException('Intermediary company was not found');
      }

      if (intermediary.status !== 'active') {
        throw new BadRequestException('Intermediary company is not active');
      }
    }

    if (internal.branch_id) {
      const branch = await branchRepository.findOne({
        where: {
          id: internal.branch_id,
          company_id: companyId,
        },
      });

      if (!branch) {
        throw new BadRequestException(
          'Branch was not found for the current company',
        );
      }

      if (branch.status !== 'active') {
        throw new BadRequestException('Selected branch is inactive');
      }

      if (
        branch.sale_point_code &&
        this.normalizeUppercase(branch.sale_point_code) !==
          this.normalizeUppercase(header.sale_point_code)
      ) {
        throw new BadRequestException(
          `cover note sale_point_code must be ${branch.sale_point_code} for the selected branch`,
        );
      }
    }

    if (internal.department_id) {
      const department = await departmentRepository.findOne({
        where: {
          id: internal.department_id,
          company_id: companyId,
        },
      });

      if (!department) {
        throw new BadRequestException(
          'Department was not found for the current company',
        );
      }

      if (department.status !== 'active') {
        throw new BadRequestException('Selected department is inactive');
      }

      if (
        internal.branch_id &&
        department.branch_id &&
        department.branch_id !== internal.branch_id
      ) {
        throw new BadRequestException(
          'Selected department does not belong to the selected branch',
        );
      }
    }

    let selectedSubClass: InsuranceSubClass | null = null;

    if (internal.sub_class_id) {
      selectedSubClass = await subClassRepository.findOne({
        where: {
          id: internal.sub_class_id,
          company_id: internal.insurer_company_id,
          product_id: internal.product_id,
        },
      });

      if (!selectedSubClass) {
        throw new BadRequestException(
          'Sub-class was not found for the selected product',
        );
      }

      if (!selectedSubClass.is_active) {
        throw new BadRequestException('Selected sub-class is inactive');
      }
    }

    const requestedRiskCodes = Array.from(
      new Set(this.collectRiskCodes(payload)),
    );
    const risks =
      requestedRiskCodes.length > 0
        ? await riskRepository.find({
            where: {
              company_id: internal.insurer_company_id,
              product_id: internal.product_id,
              risk_code: In(requestedRiskCodes),
              is_active: true,
            },
            relations: {
              required_factors: {
                factor: true,
              },
            },
          })
        : [];

    const riskByCode = new Map<string, InsuranceRisk>();
    risks.forEach((risk) => {
      riskByCode.set(this.normalizeUppercase(risk.risk_code), risk);
    });

    const missingRiskCodes = requestedRiskCodes.filter(
      (riskCode) => !riskByCode.has(riskCode),
    );

    if (missingRiskCodes.length > 0) {
      throw new BadRequestException(
        'The following risk codes are not configured for the selected product: ' +
          missingRiskCodes.join(', '),
      );
    }

    for (const risk of risks) {
      if (
        selectedSubClass &&
        risk.sub_class_id &&
        risk.sub_class_id !== selectedSubClass.id
      ) {
        throw new BadRequestException(
          `Risk ${risk.risk_code} does not belong to the selected sub-class`,
        );
      }

      if (!selectedSubClass && risk.sub_class_id) {
        throw new BadRequestException(
          `Risk ${risk.risk_code} requires a sub_class_id`,
        );
      }
    }

    const primaryPolicyHolder = header.policy_holders[0];
    const customerId = primaryPolicyHolder
      ? await this.resolveExistingCustomerId(companyId, primaryPolicyHolder)
      : null;

    return {
      product,
      customerId,
      riskByCode,
    };
  }

  private async resolveStoredTiramisContext(
    companyId: string,
    quotation: Quotation,
  ): Promise<{ branchCode: string; salePointCode: string }> {
    const branch = quotation.branch;
    const salePointCode = quotation.cover_note?.sale_point_code?.trim();
    if (
      !branch ||
      branch.company_id !== companyId ||
      branch.status !== 'active' ||
      branch.deleted_at ||
      !branch.code?.trim() ||
      !salePointCode
    ) {
      throw new BadRequestException(
        'The quotation branch or sales point code is not configured. Please update the branch configuration before submitting to TIRA.',
      );
    }

    const matchingSalePoints = await this.salePointRepository.find({
      where: {
        companyId,
        branchId: branch.id,
        salePointCode,
        isActive: true,
      },
    });
    if (matchingSalePoints.length !== 1) {
      throw new BadRequestException(
        'The quotation branch or sales point code is not configured. Please update the branch configuration before submitting to TIRA.',
      );
    }

    return {
      branchCode: branch.code.trim().toUpperCase(),
      salePointCode: matchingSalePoints[0].salePointCode.trim().toUpperCase(),
    };
  }

  private async prepareTrustedTiraSubmission(
    companyId: string,
    quotation: Quotation,
    submitOptions: SubmitQuotationDto,
    userId: string,
  ): Promise<{
    payload: CreateQuotationDto;
    tiramisPayload: Record<string, unknown>;
  }> {
    try {
      this.assertTiraSubmissionReadiness(quotation, submitOptions);

      if (quotation.requires_payment) {
        await this.assertPaymentReady(quotation);
      }

      const tiramisContext = await this.resolveStoredTiramisContext(
        companyId,
        quotation,
      );
      const payload = this.payloadMapper.toAuthoritativePayload(quotation);
      await this.validateAuthoritativePricing(
        companyId,
        payload,
        {
          productId: quotation.product_id,
          riskByCode: this.createPersistedPricingAuthorityRiskIndex(quotation),
          quotationId: quotation.id,
          approvedOverridePremiums:
            this.buildApprovedPremiumOverrideIndex(quotation),
        },
        {
          userId,
          quotationId: quotation.id,
          quotationNo: quotation.quotation_no,
          reason: 'Quotation pricing validated before TIRAMIS submission',
        },
      );

      await this.auditService.log({
        userId,
        companyId,
        action: 'quotation.tira_submission.validated',
        resource: 'quotation',
        resourceId: quotation.id,
        metadata: {
          quotationNo: quotation.quotation_no,
          requestType: this.toTiramisRequestType(quotation.quotation_flow),
          pricingQuoteIds: this.collectQuotationPricingQuoteIds(quotation),
          approvalStatus: quotation.approval_status,
          paymentStatus: quotation.payment_status,
          forceResubmit: !!submitOptions.force_resubmit,
          returnExisting: !!submitOptions.return_existing,
          old_value: null,
          new_value: {
            pricing_quote_ids: this.collectQuotationPricingQuoteIds(quotation),
            approval_status: quotation.approval_status,
            payment_status: quotation.payment_status,
          },
          reason: 'Quotation passed backend TIRAMIS submission validation',
          correlation_id: quotation.id,
        },
      });

      return {
        payload,
        tiramisPayload: this.tiramisPayloadMapper.toTiramisPayload(payload, {
          branchCode: tiramisContext.branchCode,
        }),
      };
    } catch (error) {
      await this.auditService.log({
        userId,
        companyId,
        action: 'quotation.tira_submission.validated',
        resource: 'quotation',
        resourceId: quotation.id,
        status: 'failure',
        metadata: {
          quotationNo: quotation.quotation_no,
          requestType: this.toTiramisRequestType(quotation.quotation_flow),
          pricingQuoteIds: this.collectQuotationPricingQuoteIds(quotation),
          approvalStatus: quotation.approval_status,
          paymentStatus: quotation.payment_status,
          forceResubmit: !!submitOptions.force_resubmit,
          returnExisting: !!submitOptions.return_existing,
          error: this.readErrorMessage(error),
          old_value: null,
          new_value: null,
          reason: 'Quotation failed backend TIRAMIS submission validation',
          correlation_id: quotation.id,
        },
      });
      throw error;
    }
  }

  private assertTiraSubmissionReadiness(
    quotation: Quotation,
    submitOptions: SubmitQuotationDto,
  ): void {
    const shouldReuseExistingSubmission =
      !!submitOptions.return_existing &&
      quotation.tira_status !== TiraStatus.NOT_SUBMITTED;

    if (shouldReuseExistingSubmission) {
      return;
    }

    const approvalSatisfied =
      !quotation.requires_approval ||
      quotation.approval_status === ApprovalStatus.APPROVED;
    if (!approvalSatisfied) {
      throw new ConflictException(
        `Quotation approval is not complete. Current approval status is ${quotation.approval_status}.`,
      );
    }

    const paymentSatisfied =
      !quotation.requires_payment ||
      quotation.payment_status === PaymentStatus.PAID;
    if (!paymentSatisfied) {
      throw new ConflictException(
        `Quotation payment is not complete. Current payment status is ${quotation.payment_status}.`,
      );
    }

    const readyForInitialSubmission =
      quotation.status === QuotationStatus.READY_FOR_SUBMISSION &&
      quotation.tira_status === TiraStatus.NOT_SUBMITTED;
    const readyForRetry =
      !!submitOptions.force_resubmit &&
      quotation.status === QuotationStatus.FAILED &&
      quotation.tira_status === TiraStatus.FAILED;

    if (!readyForInitialSubmission && !readyForRetry) {
      throw new ConflictException(
        'Quotation is not ready for TIRAMIS submission',
      );
    }
  }

  private async refreshPricingBeforeSave(
    companyId: string,
    payload: CreateQuotationDto,
    scope: ScopeValidationResult,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'>,
  ): Promise<void> {
    if (payload.internal_quotation.quotation_type !== QuotationType.MOTOR) {
      return;
    }

    const header = this.resolveHeader(payload);
    const effectiveDate =
      this.extractDateOnly(header.cover_note_start_date) ?? undefined;

    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_SINGLE
    ) {
      const motorDetail = payload.cover_note_dtl.motor_dtl;
      if (!motorDetail) {
        return;
      }

      for (const [index, risk] of (
        payload.cover_note_dtl.risks_covered ?? []
      ).entries()) {
        const configuredRisk = scope.riskByCode.get(
          this.normalizeUppercase(risk.risk_code),
        );
        if (!configuredRisk) {
          continue;
        }
        const includeSumInsured = this.shouldIncludeSumInsuredForPricing(
          configuredRisk,
          risk.sum_insured,
        );

        const result = await this.pricingQuoteService.calculateSingleRiskQuote(
          companyId,
          {
            client_reference: this.buildSaveRecalculationReference(
              payload,
              risk,
              index,
            ),
            risk_id: configuredRisk.id,
            sum_insured: includeSumInsured
              ? roundMoney(risk.sum_insured)
              : undefined,
            factors: this.buildMotorPricingFactors(
              header,
              payload.cover_note_dtl.policy_holders?.[0] ?? null,
              motorDetail,
              risk.sum_insured,
              includeSumInsured,
            ),
            effective_date: effectiveDate,
            quotation_type: payload.internal_quotation.quotation_type,
            currency_code: header.currency_code,
            exchange_rate: header.exchange_rate,
          },
          user.id,
          user,
        );

        this.applyFreshPricingToRisk(risk, result);
      }

      return;
    }

    if (
      payload.internal_quotation.quotation_flow !== QuotationFlow.MOTOR_FLEET
    ) {
      return;
    }

    for (const [entryIndex, entry] of (
      payload.cover_note_dtl.fleet_dtls ?? []
    ).entries()) {
      for (const [riskIndex, risk] of entry.risks_covered.entries()) {
        const configuredRisk = scope.riskByCode.get(
          this.normalizeUppercase(risk.risk_code),
        );
        if (!configuredRisk) {
          continue;
        }
        const includeSumInsured = this.shouldIncludeSumInsuredForPricing(
          configuredRisk,
          risk.sum_insured,
        );

        const result = await this.pricingQuoteService.calculateSingleRiskQuote(
          companyId,
          {
            client_reference: this.buildSaveRecalculationReference(
              payload,
              risk,
              entryIndex * 100 + riskIndex,
            ),
            risk_id: configuredRisk.id,
            sum_insured: includeSumInsured
              ? roundMoney(risk.sum_insured)
              : undefined,
            factors: this.buildMotorPricingFactors(
              header,
              payload.cover_note_dtl.policy_holders?.[0] ?? null,
              entry.motor_dtl,
              risk.sum_insured,
              includeSumInsured,
            ),
            effective_date: effectiveDate,
            quotation_type: payload.internal_quotation.quotation_type,
            currency_code: header.currency_code,
            exchange_rate: header.exchange_rate,
          },
          user.id,
          user,
        );

        this.applyFreshPricingToRisk(risk, result);
      }
    }
  }

  private buildSaveRecalculationReference(
    payload: CreateQuotationDto,
    risk: RiskCoveredDto,
    index: number,
  ): string {
    return [
      'quotation-save',
      payload.internal_quotation.quotation_flow,
      risk.risk_code.trim().toUpperCase(),
      String(index + 1),
      Date.now().toString(36),
    ].join(':');
  }

  private buildMotorPricingFactors(
    header: ResolvedHeader,
    policyHolder: PolicyHolderDto | null,
    motorDetail: MotorDetailDto,
    sumInsured: number,
    includeSumInsured: boolean,
  ): Record<string, string | number | boolean> {
    const factors: Record<string, string | number | boolean> = {
      payment_mode: this.resolvePaymentModeFactorValue(header.payment_mode),
      currency_code: header.currency_code.trim().toUpperCase(),
      exchange_rate: header.exchange_rate,
      sale_point_code: header.sale_point_code.trim().toUpperCase(),
      officer_name: header.officer_name,
      officer_title: header.officer_title,
      policy_holder_type:
        policyHolder?.policy_holder_type === 2 ? 'Corporate' : 'Individual',
      year_of_manufacture: motorDetail.year_of_manufacture,
      seat_capacity: motorDetail.sitting_capacity,
      vehicle_weight_kg: motorDetail.gross_weight,
      cargo_weight_ton: motorDetail.gross_weight,
      motor_usage: this.resolveMotorUsageFactorValue(motorDetail.motor_usage),
      motor_category: String(motorDetail.motor_category),
      motor_type: String(motorDetail.motor_type),
      registration_number: motorDetail.registration_number,
      chassis_number: motorDetail.chassis_number,
      make: motorDetail.make.trim(),
      model: motorDetail.model.trim(),
      body_type: motorDetail.body_type.trim(),
      engine_number: motorDetail.engine_number.trim(),
      engine_capacity: motorDetail.engine_capacity,
      fuel_used: motorDetail.fuel_used.trim(),
      owner_name: motorDetail.owner_name.trim(),
      owner_category: String(motorDetail.owner_category),
    };

    if (includeSumInsured) {
      factors.sum_insured = roundMoney(sumInsured);
    }

    return factors;
  }

  private shouldIncludeSumInsuredForPricing(
    risk: InsuranceRisk,
    sumInsured: number,
  ): boolean {
    if (roundMoney(sumInsured) > 0) {
      return true;
    }

    return (risk.required_factors ?? []).some(
      (requiredFactor) =>
        requiredFactor?.is_required === true &&
        typeof requiredFactor.factor?.code === 'string' &&
        requiredFactor.factor.code.trim().toLowerCase() === 'sum_insured',
    );
  }

  private resolvePaymentModeFactorValue(paymentMode: number): string {
    switch (paymentMode) {
      case 2:
        return 'Cheque';
      case 3:
        return 'EFT';
      case 1:
      default:
        return 'Cash';
    }
  }

  private resolveMotorUsageFactorValue(motorUsage: number): string {
    return motorUsage === 2 ? 'COMMERCIAL' : 'PRIVATE';
  }

  private applyFreshPricingToRisk(
    risk: RiskCoveredDto,
    result: {
      pricing_quote_id: string;
      sum_insured?: number;
      sum_insured_equivalent?: number | null;
      premium_rate?: number | null;
      percentage_rate?: number | null;
      premium_before_discount?: number | null;
      base_premium?: number | null;
      gross_premium?: number | null;
      raw_premium?: number | null;
      final_premium?: number | null;
      premium_after_discount?: number | null;
      premium_excluding_tax_equivalent?: number | null;
      premium_including_tax?: number | null;
    },
  ): void {
    const premiumBeforeDiscount = roundMoney(
      this.firstNumber(
        result.premium_before_discount,
        result.gross_premium,
        result.base_premium,
        result.raw_premium,
        result.final_premium,
        0,
      ) ?? 0,
    );
    const recalculatedDiscounts = (risk.discounts_offered ?? []).map(
      (discount) => ({
        ...discount,
        discount_amount:
          discount.discount_rate > 0
            ? roundMoney(premiumBeforeDiscount * discount.discount_rate)
            : roundMoney(discount.discount_amount),
      }),
    );
    const totalDiscountAmount = roundMoney(
      recalculatedDiscounts.reduce(
        (sum, discount) => sum + roundMoney(discount.discount_amount),
        0,
      ),
    );
    const premiumAfterDiscount = roundMoney(
      Math.max(0, premiumBeforeDiscount - totalDiscountAmount),
    );
    const recalculatedTaxes = (risk.taxes_charged ?? []).map((tax) => ({
      ...tax,
      tax_amount:
        tax.is_tax_exempted === 'Y'
          ? 0
          : roundMoney(premiumAfterDiscount * tax.tax_rate),
    }));
    const totalTaxAmount = roundMoney(
      recalculatedTaxes.reduce(
        (sum, tax) => sum + roundMoney(tax.tax_amount),
        0,
      ),
    );

    risk.pricing_quote_id = result.pricing_quote_id;
    risk.sum_insured = roundMoney(result.sum_insured ?? risk.sum_insured);
    risk.sum_insured_equivalent = roundMoney(
      this.firstNumber(
        result.sum_insured_equivalent,
        result.sum_insured,
        risk.sum_insured,
      ) ?? risk.sum_insured,
    );
    risk.premium_rate =
      this.firstNumber(
        result.premium_rate,
        result.percentage_rate,
        risk.premium_rate,
      ) ?? risk.premium_rate;
    risk.premium_before_discount = premiumBeforeDiscount;
    risk.discounts_offered = recalculatedDiscounts;
    risk.premium_after_discount = premiumAfterDiscount;
    risk.premium_excluding_tax_equivalent = premiumAfterDiscount;
    risk.taxes_charged = recalculatedTaxes;
    risk.premium_including_tax = roundMoney(
      premiumAfterDiscount + totalTaxAmount,
    );
  }

  private firstNumber(
    ...values: Array<number | null | undefined>
  ): number | null {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private async validateAuthoritativePricing(
    companyId: string,
    payload: CreateQuotationDto,
    options: AuthoritativePricingValidationOptions,
    auditContext?: PricingValidationAuditContext,
  ): Promise<void> {
    const previousPayload = auditContext
      ? this.cloneQuotationPayload(payload)
      : null;

    try {
      await this.assertAuthoritativePricing(companyId, payload, options);
      this.payloadValidator.assertValid(payload);
    } catch (error) {
      if (auditContext) {
        await this.logPricingValidationFailure(
          companyId,
          previousPayload ?? payload,
          payload,
          auditContext,
          error,
        );
      }
      throw error;
    }

    if (auditContext && previousPayload) {
      await this.logPricingValidationSuccess(
        companyId,
        previousPayload,
        payload,
        auditContext,
      );
    }
  }

  private async assertAuthoritativePricing(
    companyId: string,
    payload: CreateQuotationDto,
    options: AuthoritativePricingValidationOptions,
  ): Promise<void> {
    const pricingQuoteIds = Array.from(
      new Set(
        this.resolveEntries(payload)
          .flatMap((entry) =>
            entry.risks_covered.map((risk) => risk.pricing_quote_id?.trim()),
          )
          .filter((value): value is string => !!value),
      ),
    );

    if (pricingQuoteIds.length === 0) {
      throw new BadRequestException(
        'At least one pricing quote is required before a quotation can be saved or submitted',
      );
    }

    const conflictingAssignments = await this.findPricingQuoteAssignments(
      companyId,
      pricingQuoteIds,
      options.quotationId ?? null,
    );
    if (conflictingAssignments.length > 0) {
      throw new ConflictException(
        `Pricing quote ${conflictingAssignments[0].pricing_quote_id} is already attached to another quotation`,
      );
    }

    const pricingQuoteRepository = this.dataSource.getRepository(PricingQuote);
    const rateBookRepository = this.dataSource.getRepository(PricingRateBook);
    const quotes = await pricingQuoteRepository.find({
      where: {
        company_id: companyId,
        pricing_quote_id: In(pricingQuoteIds),
      },
    });
    const quoteByPricingQuoteId = new Map(
      quotes.map((quote) => [quote.pricing_quote_id, quote]),
    );
    const missingPricingQuoteIds = pricingQuoteIds.filter(
      (pricingQuoteId) => !quoteByPricingQuoteId.has(pricingQuoteId),
    );

    if (missingPricingQuoteIds.length > 0) {
      throw new BadRequestException(
        `Pricing quote ${missingPricingQuoteIds[0]} was not found for the current company`,
      );
    }

    const rateBookIds = Array.from(
      new Set(
        quotes
          .map((quote) => quote.rate_book_id)
          .filter((value): value is string => !!value),
      ),
    );
    const rateBooks =
      rateBookIds.length > 0
        ? await rateBookRepository.find({
            where: {
              company_id: companyId,
              id: In(rateBookIds),
            },
          })
        : [];
    const rateBookById = new Map(
      rateBooks.map((rateBook) => [rateBook.id, rateBook]),
    );
    const header = this.resolveHeader(payload);
    const normalizedCurrencyCode = header.currency_code.trim().toUpperCase();
    const normalizedQuotationType = payload.internal_quotation.quotation_type;
    const coverStartDate = this.extractDateOnly(header.cover_note_start_date);
    const now = new Date();

    for (const entry of this.resolveEntries(payload)) {
      for (const risk of entry.risks_covered) {
        const pricingQuoteId = risk.pricing_quote_id?.trim();
        if (!pricingQuoteId) {
          throw new BadRequestException(
            `Risk ${risk.risk_code} must include a pricing_quote_id from the backend rating engine`,
          );
        }

        const quote = quoteByPricingQuoteId.get(pricingQuoteId);
        if (!quote) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} was not found for the current company`,
          );
        }

        const normalizedRiskCode = this.normalizeUppercase(risk.risk_code);
        const configuredRisk = options.riskByCode.get(normalizedRiskCode);
        if (!configuredRisk) {
          throw new BadRequestException(
            `Risk ${risk.risk_code} is not configured for pricing validation`,
          );
        }

        if (quote.quote_scope !== PricingQuoteScope.SINGLE_RISK) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} cannot be used for an individual quotation risk`,
          );
        }

        if (quote.calculation_status !== PricingQuoteStatus.CALCULATED) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} is not in a calculated state`,
          );
        }

        if (quote.expires_at.getTime() <= now.getTime()) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} expired on ${quote.expires_at.toISOString()}. Recalculate the premium and try again.`,
          );
        }

        if (quote.product_id && quote.product_id !== options.productId) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} does not belong to the selected product`,
          );
        }

        if (
          quote.risk_id &&
          configuredRisk.riskId &&
          quote.risk_id !== configuredRisk.riskId
        ) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} does not belong to risk ${risk.risk_code}`,
          );
        }

        if (
          quote.quotation_type &&
          quote.quotation_type !== normalizedQuotationType
        ) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} was calculated for quotation type ${quote.quotation_type}, not ${normalizedQuotationType}`,
          );
        }

        if (
          quote.currency_code &&
          this.normalizeUppercase(quote.currency_code) !==
            normalizedCurrencyCode
        ) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} was calculated in currency ${quote.currency_code}, not ${normalizedCurrencyCode}`,
          );
        }

        const quoteExchangeRateSnapshot =
          this.readPricingExchangeRateSnapshot(quote);
        if (quoteExchangeRateSnapshot) {
          if (
            this.normalizeUppercase(
              quoteExchangeRateSnapshot.quotation_currency_code,
            ) !== normalizedCurrencyCode
          ) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} was calculated for currency ${quoteExchangeRateSnapshot.quotation_currency_code}, not ${normalizedCurrencyCode}`,
            );
          }

          if (
            !numbersEqual(
              Number(quoteExchangeRateSnapshot.exchange_rate),
              header.exchange_rate,
            )
          ) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} was calculated with exchange rate ${quoteExchangeRateSnapshot.exchange_rate}, not ${header.exchange_rate}`,
            );
          }

          if (
            coverStartDate &&
            quoteExchangeRateSnapshot.exchange_rate_date &&
            quoteExchangeRateSnapshot.exchange_rate_date !== coverStartDate
          ) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} was calculated for exchange-rate date ${quoteExchangeRateSnapshot.exchange_rate_date}, not ${coverStartDate}`,
            );
          }
        }

        const quotedSumInsured = this.toStoredNumber(
          quote.result_payload['sum_insured'] ??
            quote.input_payload['sum_insured'],
        );
        if (
          quotedSumInsured !== null &&
          !this.moneyEqual(quotedSumInsured, risk.sum_insured)
        ) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} no longer matches the current sum insured for risk ${risk.risk_code}`,
          );
        }

        const quotedPremiumRate = this.toStoredNumber(
          quote.result_payload['percentage_rate'],
        );
        if (
          quotedPremiumRate !== null &&
          !this.ratesEqual(quotedPremiumRate, risk.premium_rate)
        ) {
          throw new BadRequestException(
            `Pricing quote ${pricingQuoteId} no longer matches the premium rate for risk ${risk.risk_code}`,
          );
        }

        if (
          !this.moneyEqual(
            Number(quote.final_premium),
            risk.premium_before_discount,
          )
        ) {
          const approvedOverride =
            options.approvedOverridePremiums?.get(pricingQuoteId) ??
            options.approvedOverridePremiums?.get(normalizedRiskCode);

          if (
            !approvedOverride ||
            !this.moneyEqual(
              approvedOverride.proposed_premium,
              risk.premium_before_discount,
            )
          ) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} no longer matches the premium amount for risk ${risk.risk_code}`,
            );
          }
        }

        const discountControl = this.readPricingAdjustmentControl(
          quote.result_payload,
          'discount_control',
        );
        this.assertDiscountControlCompliance(
          pricingQuoteId,
          risk,
          coverStartDate,
          discountControl,
        );
        this.applyDiscountControlSnapshot(risk, discountControl);
        await this.applyAuthoritativeChargesToRisk(companyId, payload, {
          quote,
          risk,
          configuredRisk,
          productId: options.productId,
          coverStartDate,
        });

        if (quote.rate_book_id) {
          const rateBook = rateBookById.get(quote.rate_book_id);
          if (!rateBook) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} references a rate book that no longer exists`,
            );
          }

          if (rateBook.status !== PricingRateBookStatus.PUBLISHED) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} references rate book ${rateBook.code} ${rateBook.version}, which is no longer published`,
            );
          }

          if (
            coverStartDate &&
            !this.isRateBookEffectiveForDate(rateBook, coverStartDate)
          ) {
            throw new BadRequestException(
              `Pricing quote ${pricingQuoteId} references rate book ${rateBook.code} ${rateBook.version}, which is not effective for ${coverStartDate}`,
            );
          }
        }
      }
    }

    this.recalculateAuthoritativeTotals(payload);
  }

  private async applyAuthoritativeChargesToRisk(
    companyId: string,
    payload: CreateQuotationDto,
    context: {
      quote: PricingQuote;
      risk: RiskCoveredDto;
      configuredRisk: PricingAuthorityRiskContext;
      productId: string;
      coverStartDate: string | null;
    },
  ): Promise<void> {
    const premiumAfterDiscount = roundMoney(
      context.risk.premium_after_discount,
    );
    const premiumExcludingTaxEquivalent = roundMoney(
      context.risk.premium_excluding_tax_equivalent || premiumAfterDiscount,
    );
    const chargeSummary = await this.pricingChargeService.calculateCharges(
      companyId,
      {
        category_id: payload.internal_quotation.category_id,
        product_id: context.productId,
        risk_id: context.configuredRisk.riskId ?? context.quote.risk_id ?? null,
        effective_date: context.coverStartDate,
        basic_premium:
          this.toStoredNumber(context.quote.result_payload['base_premium']) ??
          this.toStoredNumber(context.quote.base_premium) ??
          roundMoney(context.risk.premium_before_discount),
        net_premium: premiumExcludingTaxEquivalent,
        gross_premium: roundMoney(context.risk.premium_before_discount),
      },
    );
    const exemptionsByCode = new Map(
      (context.risk.taxes_charged ?? []).map((tax) => [
        this.normalizeUppercase(tax.tax_code),
        tax,
      ]),
    );

    context.risk.premium_after_discount = premiumExcludingTaxEquivalent;
    context.risk.premium_excluding_tax_equivalent =
      premiumExcludingTaxEquivalent;
    const matchedChargeCodes = new Set<string>();
    const authoritativeTaxes: TaxChargedDto[] = chargeSummary.charges.map(
      (charge): TaxChargedDto => {
        const normalizedChargeCode = this.normalizeUppercase(
          charge.charge_code,
        );
        matchedChargeCodes.add(normalizedChargeCode);
        const existingTax = exemptionsByCode.get(normalizedChargeCode);
        const isTaxExempted = existingTax?.is_tax_exempted === 'Y' ? 'Y' : 'N';

        return {
          tax_code: charge.charge_code,
          is_tax_exempted:
            isTaxExempted === 'Y' ? ('Y' as const) : ('N' as const),
          tax_exemption_type:
            isTaxExempted === 'Y'
              ? (existingTax?.tax_exemption_type?.trim() ?? null)
              : null,
          tax_exemption_reference:
            isTaxExempted === 'Y'
              ? (existingTax?.tax_exemption_reference?.trim() ?? null)
              : null,
          tax_rate: charge.rate ?? 0,
          tax_amount: isTaxExempted === 'Y' ? 0 : charge.computed_amount,
        };
      },
    );
    const preservedTaxes: TaxChargedDto[] = Array.from(
      exemptionsByCode.entries(),
    )
      .filter(([code]) => !matchedChargeCodes.has(code))
      .map(
        ([, tax]): TaxChargedDto => ({
          tax_code: tax.tax_code,
          is_tax_exempted:
            tax.is_tax_exempted === 'Y' ? ('Y' as const) : ('N' as const),
          tax_exemption_type:
            tax.is_tax_exempted === 'Y' ? tax.tax_exemption_type : null,
          tax_exemption_reference:
            tax.is_tax_exempted === 'Y' ? tax.tax_exemption_reference : null,
          tax_rate: tax.tax_rate,
          tax_amount:
            tax.is_tax_exempted === 'Y'
              ? 0
              : roundMoney(premiumExcludingTaxEquivalent * tax.tax_rate),
        }),
      );
    context.risk.taxes_charged = [...authoritativeTaxes, ...preservedTaxes];
    context.risk.premium_including_tax = roundMoney(
      premiumExcludingTaxEquivalent +
        context.risk.taxes_charged.reduce(
          (sum, charge) => sum + charge.tax_amount,
          0,
        ),
    );
  }

  private recalculateAuthoritativeTotals(payload: CreateQuotationDto): void {
    const entries = this.resolveEntries(payload);
    const totalPremiumExcludingTax = roundMoney(
      entries.reduce(
        (sum, entry) =>
          sum +
          entry.risks_covered.reduce(
            (riskSum, risk) => riskSum + risk.premium_excluding_tax_equivalent,
            0,
          ) +
          entry.cover_note_addons.reduce(
            (addonSum, addon) =>
              addonSum + (addon.premium_excluding_tax_equivalent || 0),
            0,
          ),
        0,
      ),
    );
    const totalPremiumIncludingTax = roundMoney(
      entries.reduce(
        (sum, entry) =>
          sum +
          entry.risks_covered.reduce(
            (riskSum, risk) => riskSum + risk.premium_including_tax,
            0,
          ) +
          entry.cover_note_addons.reduce(
            (addonSum, addon) => addonSum + (addon.premium_including_tax || 0),
            0,
          ),
        0,
      ),
    );

    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      if (payload.cover_note_dtl.fleet_hdr) {
        payload.cover_note_dtl.fleet_hdr.total_premium_excluding_tax =
          totalPremiumExcludingTax;
        payload.cover_note_dtl.fleet_hdr.total_premium_including_tax =
          totalPremiumIncludingTax;
      }
      return;
    }

    payload.cover_note_dtl.total_premium_excluding_tax =
      totalPremiumExcludingTax;
    payload.cover_note_dtl.total_premium_including_tax =
      totalPremiumIncludingTax;
  }

  private async resolveExchangeRateSnapshot(
    companyId: string,
    payload: CreateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'>,
  ) {
    const header = this.resolveHeader(payload);
    return this.exchangeRateGovernanceService.resolveSnapshot(
      companyId,
      {
        quotation_currency_code: header.currency_code,
        exchange_rate: header.exchange_rate,
        effective_date: header.cover_note_start_date,
      },
      user,
    );
  }

  private readPricingExchangeRateSnapshot(quote: PricingQuote): {
    quotation_currency_code: string;
    exchange_rate: number;
    exchange_rate_date: string;
  } | null {
    const candidate =
      quote.result_payload['exchange_rate_snapshot'] ??
      quote.context_payload?.['exchange_rate_snapshot'];

    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const snapshot = candidate as Record<string, unknown>;
    const quotationCurrencyCode =
      typeof snapshot.quotation_currency_code === 'string'
        ? snapshot.quotation_currency_code
        : null;
    const exchangeRate = this.toStoredNumber(snapshot.exchange_rate);
    const exchangeRateDate =
      typeof snapshot.exchange_rate_date === 'string'
        ? snapshot.exchange_rate_date.slice(0, 10)
        : null;

    if (!quotationCurrencyCode || exchangeRate === null || !exchangeRateDate) {
      return null;
    }

    return {
      quotation_currency_code: quotationCurrencyCode,
      exchange_rate: exchangeRate,
      exchange_rate_date: exchangeRateDate,
    };
  }

  private createPricingAuthorityRiskIndex(
    riskByCode: Map<string, InsuranceRisk>,
  ): Map<string, PricingAuthorityRiskContext> {
    return new Map(
      Array.from(riskByCode.entries()).map(([riskCode, risk]) => [
        riskCode,
        { riskId: risk.id },
      ]),
    );
  }

  private createPersistedPricingAuthorityRiskIndex(
    quotation: Quotation,
  ): Map<string, PricingAuthorityRiskContext> {
    const riskIndex = new Map<string, PricingAuthorityRiskContext>();

    for (const entry of quotation.cover_note?.entries ?? []) {
      for (const risk of entry.risks ?? []) {
        riskIndex.set(this.normalizeUppercase(risk.risk_code), {
          riskId: risk.insurance_risk_id ?? null,
        });
      }
    }

    return riskIndex;
  }

  private buildApprovedPremiumOverrideIndex(
    quotation: Quotation,
  ): Map<string, ApprovedPremiumOverrideSnapshot> {
    const approvedOverrides = new Map<
      string,
      ApprovedPremiumOverrideSnapshot
    >();

    for (const entry of quotation.cover_note?.entries ?? []) {
      for (const risk of entry.risks ?? []) {
        const approvedOverride = this.latestApprovedPremiumOverride(
          risk.premium_overrides,
        );
        if (!approvedOverride) {
          continue;
        }

        const snapshot = {
          pricing_quote_id: risk.pricing_quote_id ?? null,
          risk_code: this.normalizeUppercase(risk.risk_code),
          proposed_premium: roundMoney(
            Number(approvedOverride.proposed_premium),
          ),
        };

        if (snapshot.pricing_quote_id) {
          approvedOverrides.set(snapshot.pricing_quote_id, snapshot);
        }
        approvedOverrides.set(snapshot.risk_code, snapshot);
      }
    }

    return approvedOverrides;
  }

  private async findPricingQuoteAssignments(
    companyId: string,
    pricingQuoteIds: string[],
    quotationId: string | null,
  ): Promise<Array<{ pricing_quote_id: string; quotation_id: string }>> {
    if (pricingQuoteIds.length === 0) {
      return [];
    }

    return this.dataSource.query(
      `
        SELECT
          qer.pricing_quote_id,
          q.id AS quotation_id
        FROM quotation_entry_risks AS qer
        INNER JOIN quotation_cover_note_entries AS qce
          ON qce.id = qer.entry_id
        INNER JOIN quotation_cover_notes AS qcn
          ON qcn.id = qce.cover_note_id
        INNER JOIN quotations AS q
          ON q.id = qcn.quotation_id
        WHERE q.company_id = $1
          AND q.deleted_at IS NULL
          AND qer.pricing_quote_id = ANY($2::varchar[])
          AND ($3::uuid IS NULL OR q.id <> $3::uuid)
      `,
      [companyId, pricingQuoteIds, quotationId],
    );
  }

  private isRateBookEffectiveForDate(
    rateBook: PricingRateBook,
    coverStartDate: string,
  ): boolean {
    if (coverStartDate < rateBook.effective_from) {
      return false;
    }

    if (rateBook.effective_to && coverStartDate > rateBook.effective_to) {
      return false;
    }

    return true;
  }

  private extractDateOnly(
    value: string | Date | null | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  private toStoredNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readPricingAdjustmentControl(
    source: Record<string, unknown> | null | undefined,
    key: 'discount_control' | 'loading_control',
  ): PricingAdjustmentControl {
    const value = source?.[key];
    if (!value || typeof value !== 'object') {
      return {
        max_rate: null,
        max_amount: null,
        approval_threshold_rate: null,
        approval_threshold_amount: null,
        effective_from: null,
        effective_to: null,
      };
    }

    const control = value as Record<string, unknown>;
    return {
      max_rate: this.toStoredNumber(control.max_rate),
      max_amount: this.toStoredNumber(control.max_amount),
      approval_threshold_rate: this.toStoredNumber(
        control.approval_threshold_rate,
      ),
      approval_threshold_amount: this.toStoredNumber(
        control.approval_threshold_amount,
      ),
      effective_from:
        typeof control.effective_from === 'string'
          ? control.effective_from.slice(0, 10)
          : null,
      effective_to:
        typeof control.effective_to === 'string'
          ? control.effective_to.slice(0, 10)
          : null,
    };
  }

  private assertDiscountControlCompliance(
    pricingQuoteId: string,
    risk: RiskCoveredDto,
    coverStartDate: string | null,
    control: PricingAdjustmentControl,
  ) {
    const totalDiscountAmount = roundMoney(
      (risk.discounts_offered ?? []).reduce(
        (sum, discount) => sum + discount.discount_amount,
        0,
      ),
    );
    const totalDiscountRate =
      risk.premium_before_discount > 0
        ? totalDiscountAmount / risk.premium_before_discount
        : 0;

    if (
      control.effective_from &&
      coverStartDate &&
      coverStartDate < control.effective_from
    ) {
      throw new BadRequestException(
        `Pricing quote ${pricingQuoteId} discount controls are not yet effective for the quotation start date`,
      );
    }

    if (
      control.effective_to &&
      coverStartDate &&
      coverStartDate > control.effective_to
    ) {
      throw new BadRequestException(
        `Pricing quote ${pricingQuoteId} discount controls expired before the quotation start date`,
      );
    }

    if (
      control.max_rate !== null &&
      totalDiscountRate - control.max_rate > RATE_TOLERANCE
    ) {
      throw new BadRequestException(
        `Risk ${risk.risk_code} requested discount rate exceeds the maximum authorized discount rate for pricing quote ${pricingQuoteId}`,
      );
    }

    if (
      control.max_amount !== null &&
      totalDiscountAmount - control.max_amount > MONEY_TOLERANCE
    ) {
      throw new BadRequestException(
        `Risk ${risk.risk_code} requested discount amount exceeds the maximum authorized discount amount for pricing quote ${pricingQuoteId}`,
      );
    }
  }

  private applyDiscountControlSnapshot(
    risk: RiskCoveredDto,
    control: PricingAdjustmentControl,
  ) {
    const totalDiscountAmount = roundMoney(
      (risk.discounts_offered ?? []).reduce(
        (sum, discount) => sum + discount.discount_amount,
        0,
      ),
    );
    const totalDiscountRate =
      risk.premium_before_discount > 0
        ? totalDiscountAmount / risk.premium_before_discount
        : 0;
    const approvalRequired = this.isApprovalRequired(
      totalDiscountRate,
      totalDiscountAmount,
      control,
    );

    risk.discounts_offered.forEach((discount) => {
      const hasRequest =
        discount.discount_rate > 0 || discount.discount_amount > 0;
      discount.max_permitted_rate = control.max_rate;
      discount.max_permitted_amount = control.max_amount;
      discount.approval_required = hasRequest ? approvalRequired : false;
      if (!hasRequest) {
        discount.approval_status = 'NOT_REQUIRED';
        return;
      }

      discount.approval_status = discount.approval_required
        ? (discount.approval_status ?? 'PENDING')
        : 'NOT_REQUIRED';
    });
  }

  private isApprovalRequired(
    requestedRate: number,
    requestedAmount: number,
    control: PricingAdjustmentControl,
  ) {
    return (
      (control.approval_threshold_rate !== null &&
        requestedRate - control.approval_threshold_rate > RATE_TOLERANCE) ||
      (control.approval_threshold_amount !== null &&
        requestedAmount - control.approval_threshold_amount > MONEY_TOLERANCE)
    );
  }

  private moneyEqual(first: number, second: number): boolean {
    return moneyEqual(roundMoney(first), roundMoney(second), MONEY_TOLERANCE);
  }

  private ratesEqual(first: number, second: number): boolean {
    return numbersEqual(first, second, RATE_TOLERANCE);
  }

  private requiresPricingAuthorityValidation(
    action: QuotationStatusTransitionAction,
  ): boolean {
    return [
      QuotationStatusTransitionAction.SUBMIT_FOR_APPROVAL,
      QuotationStatusTransitionAction.APPROVE,
      QuotationStatusTransitionAction.MARK_PAYMENT_REQUESTED,
      QuotationStatusTransitionAction.MARK_PAYMENT_PROCESSING,
      QuotationStatusTransitionAction.MARK_PARTIALLY_PAID,
      QuotationStatusTransitionAction.MARK_PAYMENT_PAID,
    ].includes(action);
  }

  private canViewPricingBreakdown(
    user?: Pick<AuthenticatedUser, 'permissions'> | null,
  ): boolean {
    return this.hasPermission(user, PRICING_VIEW_BREAKDOWN_PERMISSION);
  }

  private canViewPricingAudit(
    user?: Pick<AuthenticatedUser, 'permissions'>,
  ): boolean {
    return (
      user?.permissions?.some((permission) =>
        PRICING_AUDIT_VIEW_PERMISSIONS.includes(
          permission as (typeof PRICING_AUDIT_VIEW_PERMISSIONS)[number],
        ),
      ) ?? false
    );
  }

  private hasPermission(
    user: Pick<AuthenticatedUser, 'permissions'> | null | undefined,
    permission: string,
  ): boolean {
    return user?.permissions?.includes(permission) ?? false;
  }

  private assertDiscountPermissions(
    payload: CreateQuotationDto,
    user: Pick<AuthenticatedUser, 'permissions'>,
    currentQuotation?: Quotation | null,
  ): void {
    const existingDiscounts =
      this.indexPersistedDiscountSnapshots(currentQuotation);
    const canRequestDiscount =
      this.hasPermission(user, PRICING_REQUEST_DISCOUNT_PERMISSION) ||
      this.hasPermission(user, PRICING_APPROVE_DISCOUNT_PERMISSION);
    const canApproveDiscount = this.hasPermission(
      user,
      PRICING_APPROVE_DISCOUNT_PERMISSION,
    );

    for (const risk of this.resolveEntries(payload).flatMap(
      (entry) => entry.risks_covered,
    )) {
      const riskKey = this.discountRiskKey(
        risk.pricing_quote_id,
        risk.risk_code,
      );

      for (const [index, discount] of (
        risk.discounts_offered ?? []
      ).entries()) {
        const snapshotKey = `${riskKey}:${index + 1}`;
        const previous = existingDiscounts.get(snapshotKey);
        const normalizedStatus = this.normalizeAdjustmentApprovalStatus(
          discount.approval_status,
        );
        const hasRequest = this.discountHasRequest(discount);
        const hadRequest = this.persistedDiscountHasRequest(previous);
        const requestChanged =
          hasRequest !== hadRequest ||
          this.discountRequestDetailsChanged(previous, discount);
        const decisionChanged = this.discountDecisionChanged(
          previous,
          discount,
          normalizedStatus,
        );

        if (
          requestChanged &&
          (hasRequest || hadRequest) &&
          !canRequestDiscount
        ) {
          throw new ForbiddenException(
            'You do not have permission to request quotation discounts',
          );
        }

        if (decisionChanged && !canApproveDiscount) {
          throw new ForbiddenException(
            'You do not have permission to approve quotation discounts',
          );
        }
      }
    }
  }

  private indexPersistedDiscountSnapshots(quotation?: Quotation | null): Map<
    string,
    {
      discount_rate: number;
      discount_amount: number;
      request_reason_code: string | null;
      request_comment: string | null;
      effective_from: string | null;
      effective_to: string | null;
      approval_status: string | null;
      approved_rate: number | null;
      approved_amount: number | null;
      approved_by: string | null;
      approval_date: string | null;
      rejection_reason: string | null;
    }
  > {
    const index = new Map<
      string,
      {
        discount_rate: number;
        discount_amount: number;
        request_reason_code: string | null;
        request_comment: string | null;
        effective_from: string | null;
        effective_to: string | null;
        approval_status: string | null;
        approved_rate: number | null;
        approved_amount: number | null;
        approved_by: string | null;
        approval_date: string | null;
        rejection_reason: string | null;
      }
    >();

    for (const entry of quotation?.cover_note?.entries ?? []) {
      for (const risk of entry.risks ?? []) {
        const riskKey = this.discountRiskKey(
          risk.pricing_quote_id,
          risk.risk_code,
        );

        for (const discount of risk.discounts ?? []) {
          index.set(`${riskKey}:${discount.sequence_no ?? 1}`, {
            discount_rate: Number(discount.discount_rate ?? 0),
            discount_amount: Number(discount.discount_amount ?? 0),
            request_reason_code: discount.request_reason_code?.trim() ?? null,
            request_comment: discount.request_comment?.trim() ?? null,
            effective_from: this.extractDateOnly(discount.effective_from),
            effective_to: this.extractDateOnly(discount.effective_to),
            approval_status:
              this.normalizeAdjustmentApprovalStatus(
                discount.approval_status,
              ) ?? null,
            approved_rate: this.toStoredNumber(discount.approved_rate),
            approved_amount: this.toStoredNumber(discount.approved_amount),
            approved_by: discount.approved_by?.trim() ?? null,
            approval_date: this.extractDateOnly(discount.approval_date),
            rejection_reason: discount.rejection_reason?.trim() ?? null,
          });
        }
      }
    }

    return index;
  }

  private discountRiskKey(
    pricingQuoteId: string | null | undefined,
    riskCode: string | null | undefined,
  ): string {
    return pricingQuoteId?.trim() || this.normalizeUppercase(riskCode ?? '');
  }

  private discountHasRequest(
    discount: RiskCoveredDto['discounts_offered'][number],
  ): boolean {
    return (
      Number(discount.discount_rate ?? 0) > RATE_TOLERANCE ||
      Number(discount.discount_amount ?? 0) > MONEY_TOLERANCE
    );
  }

  private persistedDiscountHasRequest(
    discount:
      | {
          discount_rate: number;
          discount_amount: number;
        }
      | undefined,
  ): boolean {
    return (
      Number(discount?.discount_rate ?? 0) > RATE_TOLERANCE ||
      Number(discount?.discount_amount ?? 0) > MONEY_TOLERANCE
    );
  }

  private discountRequestDetailsChanged(
    previous:
      | {
          discount_rate: number;
          discount_amount: number;
          request_reason_code: string | null;
          request_comment: string | null;
          effective_from: string | null;
          effective_to: string | null;
        }
      | undefined,
    discount: RiskCoveredDto['discounts_offered'][number],
  ): boolean {
    if (!previous) {
      return true;
    }

    return (
      !this.ratesEqual(
        previous.discount_rate,
        Number(discount.discount_rate ?? 0),
      ) ||
      !this.moneyEqual(
        previous.discount_amount,
        Number(discount.discount_amount ?? 0),
      ) ||
      previous.request_reason_code !==
        (discount.request_reason_code?.trim() ?? null) ||
      previous.request_comment !== (discount.request_comment?.trim() ?? null) ||
      previous.effective_from !==
        this.extractDateOnly(discount.effective_from) ||
      previous.effective_to !== this.extractDateOnly(discount.effective_to)
    );
  }

  private discountDecisionChanged(
    previous:
      | {
          approval_status: string | null;
          approved_rate: number | null;
          approved_amount: number | null;
          approved_by: string | null;
          approval_date: string | null;
          rejection_reason: string | null;
        }
      | undefined,
    discount: RiskCoveredDto['discounts_offered'][number],
    normalizedStatus: string | null,
  ): boolean {
    const nextApprovedRate = this.toStoredNumber(discount.approved_rate);
    const nextApprovedAmount = this.toStoredNumber(discount.approved_amount);
    const nextApprovedBy = discount.approved_by?.trim() ?? null;
    const nextApprovalDate = this.extractDateOnly(discount.approval_date);
    const nextRejectionReason = discount.rejection_reason?.trim() ?? null;
    const hasDecision =
      normalizedStatus === 'APPROVED' ||
      normalizedStatus === 'REJECTED' ||
      nextApprovedRate !== null ||
      nextApprovedAmount !== null ||
      nextApprovedBy !== null ||
      nextApprovalDate !== null ||
      nextRejectionReason !== null;

    if (!hasDecision) {
      return false;
    }

    if (!previous) {
      return true;
    }

    return (
      previous.approval_status !== normalizedStatus ||
      !this.nullableRateEqual(previous.approved_rate, nextApprovedRate) ||
      !this.nullableMoneyEqual(previous.approved_amount, nextApprovedAmount) ||
      previous.approved_by !== nextApprovedBy ||
      previous.approval_date !== nextApprovalDate ||
      previous.rejection_reason !== nextRejectionReason
    );
  }

  private normalizeAdjustmentApprovalStatus(
    value: string | null | undefined,
  ): string | null {
    const normalized = value?.trim().toUpperCase();
    return normalized ? normalized : null;
  }

  private nullableMoneyEqual(
    first: number | null | undefined,
    second: number | null | undefined,
  ): boolean {
    if (first == null && second == null) {
      return true;
    }

    if (first == null || second == null) {
      return false;
    }

    return this.moneyEqual(first, second);
  }

  private nullableRateEqual(
    first: number | null | undefined,
    second: number | null | undefined,
  ): boolean {
    if (first == null && second == null) {
      return true;
    }

    if (first == null || second == null) {
      return false;
    }

    return this.ratesEqual(first, second);
  }

  private async evaluateQuotationPricingIntegration(
    companyId: string,
    quotation: Quotation,
  ): Promise<QuotationPricingIntegrationSummary> {
    const payload = this.payloadMapper.toAuthoritativePayload(quotation);
    const header = this.resolveHeader(payload);
    const risks = this.resolveEntries(payload).flatMap(
      (entry) => entry.risks_covered,
    );
    const pricingQuoteIds = [
      ...new Set(
        risks
          .map((risk) => risk.pricing_quote_id?.trim())
          .filter((value): value is string => !!value),
      ),
    ];
    const pricingQuotes =
      pricingQuoteIds.length > 0
        ? await this.dataSource.getRepository(PricingQuote).find({
            where: {
              company_id: companyId,
              pricing_quote_id: In(pricingQuoteIds),
            },
          })
        : [];
    const quotesById = new Map(
      pricingQuotes.map((quote) => [quote.pricing_quote_id, quote]),
    );

    const staleReasons: string[] = [];
    if (pricingQuoteIds.length === 0) {
      staleReasons.push(
        'One or more risks do not have a current pricing quote. Recalculate before continuing.',
      );
    }

    const missingQuoteIds = pricingQuoteIds.filter((id) => !quotesById.has(id));
    if (missingQuoteIds.length > 0) {
      staleReasons.push(
        `Pricing quote ${missingQuoteIds[0]} is no longer available for this quotation.`,
      );
    }

    const now = new Date();
    const expiredQuotes = pricingQuotes.filter(
      (quote) => quote.expires_at.getTime() <= now.getTime(),
    );
    if (expiredQuotes.length > 0) {
      staleReasons.push(
        `Pricing quote ${expiredQuotes[0].pricing_quote_id} expired on ${expiredQuotes[0].expires_at.toISOString()}.`,
      );
    }

    if (
      pricingQuoteIds.length > 0 &&
      missingQuoteIds.length === 0 &&
      expiredQuotes.length === 0
    ) {
      try {
        await this.assertAuthoritativePricing(
          companyId,
          this.cloneQuotationPayload(payload),
          {
            productId: quotation.product_id,
            riskByCode:
              this.createPersistedPricingAuthorityRiskIndex(quotation),
            quotationId: quotation.id,
            approvedOverridePremiums:
              this.buildApprovedPremiumOverrideIndex(quotation),
          },
        );
      } catch (error) {
        staleReasons.push(this.readErrorMessage(error));
      }
    }

    const status: QuotationPricingStatus =
      pricingQuoteIds.length === 0 || missingQuoteIds.length > 0
        ? 'MISSING'
        : expiredQuotes.length > 0
          ? 'EXPIRED'
          : staleReasons.length > 0
            ? 'STALE'
            : 'CURRENT';

    const calculatedAtValues = pricingQuotes.map((quote) =>
      quote.calculated_at.getTime(),
    );
    const expiresAtValues = pricingQuotes.map((quote) =>
      quote.expires_at.getTime(),
    );
    const lastCalculatedAt =
      calculatedAtValues.length > 0
        ? new Date(Math.max(...calculatedAtValues)).toISOString()
        : null;
    const pricingExpiresAt =
      expiresAtValues.length > 0
        ? new Date(Math.min(...expiresAtValues)).toISOString()
        : null;
    const rateBookVersion = this.resolveQuotationRateBookVersion(pricingQuotes);

    return {
      pricing_status: status,
      is_stale: status !== 'CURRENT',
      current_pricing_quote_id:
        pricingQuoteIds.length === 1 ? pricingQuoteIds[0] : null,
      pricing_quote_ids: pricingQuoteIds,
      last_calculated_at: lastCalculatedAt,
      pricing_expires_at: pricingExpiresAt,
      rate_book_version: rateBookVersion,
      base_premium: roundMoney(
        risks.reduce((sum, risk) => sum + risk.premium_before_discount, 0),
      ),
      total_discounts: roundMoney(
        risks.reduce(
          (sum, risk) =>
            sum +
            risk.discounts_offered.reduce(
              (riskDiscountSum, discount) =>
                riskDiscountSum + Number(discount.discount_amount ?? 0),
              0,
            ),
          0,
        ),
      ),
      total_loadings: 0,
      total_taxes: roundMoney(
        risks.reduce(
          (sum, risk) =>
            sum +
            risk.taxes_charged.reduce(
              (riskTaxSum, tax) => riskTaxSum + Number(tax.tax_amount ?? 0),
              0,
            ),
          0,
        ),
      ),
      final_payable_premium: roundMoney(header.total_premium_including_tax),
      override_status: this.resolveQuotationOverrideStatus(quotation),
      approval_status: quotation.approval_status,
      stale_reasons: staleReasons,
    };
  }

  private resolveQuotationRateBookVersion(
    pricingQuotes: PricingQuote[],
  ): string | null {
    const versions = [
      ...new Set(
        pricingQuotes
          .map((quote) => quote.rate_book_version?.trim())
          .filter((value): value is string => !!value),
      ),
    ];

    if (versions.length === 0) {
      return null;
    }

    return versions.length === 1 ? versions[0] : versions.join(', ');
  }

  private resolveQuotationOverrideStatus(quotation: Quotation): string {
    const statuses = [
      ...new Set(
        (quotation.cover_note?.entries ?? []).flatMap((entry) =>
          (entry.risks ?? []).flatMap((risk) =>
            (risk.premium_overrides ?? []).map(
              (override) => override.approval_status,
            ),
          ),
        ),
      ),
    ];

    if (statuses.length === 0) {
      return 'NOT_REQUIRED';
    }

    return statuses.length === 1 ? statuses[0] : 'MIXED';
  }

  private collectQuotationPricingQuoteIds(quotation: Quotation): string[] {
    return [
      ...new Set(
        (quotation.cover_note?.entries ?? []).flatMap((entry) =>
          (entry.risks ?? [])
            .map((risk) => risk.pricing_quote_id?.trim())
            .filter((value): value is string => !!value),
        ),
      ),
    ];
  }

  private cloneQuotationPayload(
    payload: CreateQuotationDto,
  ): CreateQuotationDto {
    return JSON.parse(JSON.stringify(payload)) as CreateQuotationDto;
  }

  private readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Pricing information is no longer current. Recalculate before continuing.';
  }

  private async logPricingValidationSuccess(
    companyId: string,
    previousPayload: CreateQuotationDto,
    payload: CreateQuotationDto,
    auditContext: PricingValidationAuditContext,
  ) {
    const previousRisks = this.indexPayloadRisks(previousPayload);

    for (const risk of this.resolveEntries(payload).flatMap(
      (entry) => entry.risks_covered,
    )) {
      const previousRisk = this.resolveIndexedRiskSnapshot(previousRisks, risk);
      if (!previousRisk) {
        continue;
      }

      const taxChanged =
        !this.moneyEqual(
          previousRisk.premium_including_tax,
          risk.premium_including_tax,
        ) ||
        !this.moneyEqual(
          previousRisk.premium_excluding_tax_equivalent,
          risk.premium_excluding_tax_equivalent,
        ) ||
        JSON.stringify(previousRisk.taxes_charged ?? []) !==
          JSON.stringify(risk.taxes_charged ?? []);

      if (!taxChanged) {
        continue;
      }

      await this.auditService.log({
        userId: auditContext.userId ?? undefined,
        companyId,
        action: 'quotation.tax_recalculation',
        resource: 'quotation',
        resourceId: auditContext.quotationId ?? undefined,
        metadata: {
          quotationId: auditContext.quotationId ?? null,
          quotationNo: auditContext.quotationNo ?? null,
          riskId: null,
          riskCode: risk.risk_code,
          pricingQuoteId: risk.pricing_quote_id?.trim() ?? null,
          old_value: {
            premium_excluding_tax_equivalent:
              previousRisk.premium_excluding_tax_equivalent,
            premium_including_tax: previousRisk.premium_including_tax,
            taxes_charged: previousRisk.taxes_charged ?? [],
          },
          new_value: {
            premium_excluding_tax_equivalent:
              risk.premium_excluding_tax_equivalent,
            premium_including_tax: risk.premium_including_tax,
            taxes_charged: risk.taxes_charged ?? [],
          },
          reason: auditContext.reason,
          correlation_id:
            auditContext.quotationId ??
            risk.pricing_quote_id?.trim() ??
            risk.risk_code,
        },
      });
    }
  }

  private async logPricingValidationFailure(
    companyId: string,
    previousPayload: CreateQuotationDto,
    payload: CreateQuotationDto,
    auditContext: PricingValidationAuditContext,
    error: unknown,
  ) {
    const reason = this.readErrorMessage(error);
    const pricingQuoteIds = Array.from(
      new Set([
        ...this.collectPayloadPricingQuoteIds(previousPayload),
        ...this.collectPayloadPricingQuoteIds(payload),
      ]),
    );
    const firstRisk = this.resolveEntries(payload).flatMap(
      (entry) => entry.risks_covered,
    )[0];

    if (reason.toLowerCase().includes('expired on')) {
      await this.auditService.log({
        userId: auditContext.userId ?? undefined,
        companyId,
        action: 'quotation.pricing_expired',
        resource: 'quotation',
        resourceId: auditContext.quotationId ?? undefined,
        status: 'failure',
        metadata: {
          quotationId: auditContext.quotationId ?? null,
          quotationNo: auditContext.quotationNo ?? null,
          riskId: null,
          riskCode: firstRisk?.risk_code ?? null,
          pricingQuoteIds,
          old_value: {
            pricing_quote_ids: pricingQuoteIds,
          },
          new_value: null,
          reason,
          correlation_id:
            auditContext.quotationId ?? pricingQuoteIds[0] ?? null,
        },
      });
    }

    await this.auditService.log({
      userId: auditContext.userId ?? undefined,
      companyId,
      action: 'quotation.pricing_invalidation',
      resource: 'quotation',
      resourceId: auditContext.quotationId ?? undefined,
      status: 'failure',
      metadata: {
        quotationId: auditContext.quotationId ?? null,
        quotationNo: auditContext.quotationNo ?? null,
        riskId: null,
        riskCode: firstRisk?.risk_code ?? null,
        pricingQuoteIds,
        old_value: {
          pricing_quote_ids: pricingQuoteIds,
        },
        new_value: null,
        reason,
        correlation_id: auditContext.quotationId ?? pricingQuoteIds[0] ?? null,
      },
    });

    await this.auditService.log({
      userId: auditContext.userId ?? undefined,
      companyId,
      action: 'quotation.pricing_recalculation.required',
      resource: 'quotation',
      resourceId: auditContext.quotationId ?? undefined,
      status: 'failure',
      metadata: {
        quotationId: auditContext.quotationId ?? null,
        quotationNo: auditContext.quotationNo ?? null,
        riskId: null,
        riskCode: firstRisk?.risk_code ?? null,
        pricingQuoteIds,
        old_value: null,
        new_value: {
          recalculation_required: true,
        },
        reason,
        correlation_id: auditContext.quotationId ?? pricingQuoteIds[0] ?? null,
      },
    });
  }

  private async logDiscountAuditEntries(
    companyId: string,
    quotationId: string,
    quotationNo: string,
    payload: CreateQuotationDto,
    userId: string,
  ) {
    for (const risk of this.resolveEntries(payload).flatMap(
      (entry) => entry.risks_covered,
    )) {
      for (const [index, discount] of (
        risk.discounts_offered ?? []
      ).entries()) {
        const hasDiscount =
          Number(discount.discount_rate ?? 0) > 0 ||
          Number(discount.discount_amount ?? 0) > 0;
        if (!hasDiscount) {
          continue;
        }

        const correlationId = `${quotationId}:${risk.pricing_quote_id?.trim() ?? risk.risk_code}:discount:${index + 1}`;
        const requestReason =
          discount.request_comment?.trim() ||
          discount.request_reason_code?.trim() ||
          'Quotation discount requested';

        await this.auditService.log({
          userId,
          companyId,
          action: 'quotation.discount.requested',
          resource: 'quotation',
          resourceId: quotationId,
          metadata: {
            quotationId,
            quotationNo,
            riskId: null,
            riskCode: risk.risk_code,
            pricingQuoteId: risk.pricing_quote_id?.trim() ?? null,
            old_value: null,
            new_value: {
              discount_type: discount.discount_type,
              discount_rate: discount.discount_rate,
              discount_amount: discount.discount_amount,
              approval_required: discount.approval_required ?? false,
              approval_status: discount.approval_status ?? null,
              max_permitted_rate: discount.max_permitted_rate ?? null,
              max_permitted_amount: discount.max_permitted_amount ?? null,
            },
            reason: requestReason,
            correlation_id: correlationId,
          },
        });

        if (discount.approval_status === 'APPROVED') {
          await this.auditService.log({
            userId,
            companyId,
            action: 'quotation.discount.approved',
            resource: 'quotation',
            resourceId: quotationId,
            metadata: {
              quotationId,
              quotationNo,
              riskId: null,
              riskCode: risk.risk_code,
              pricingQuoteId: risk.pricing_quote_id?.trim() ?? null,
              old_value: {
                discount_rate: discount.discount_rate,
                discount_amount: discount.discount_amount,
              },
              new_value: {
                approved_rate: discount.approved_rate ?? discount.discount_rate,
                approved_amount:
                  discount.approved_amount ?? discount.discount_amount,
                approval_status: discount.approval_status,
              },
              reason: requestReason,
              correlation_id: correlationId,
            },
          });
        }
      }
    }
  }

  private collectPayloadPricingQuoteIds(payload: CreateQuotationDto): string[] {
    return [
      ...new Set(
        this.resolveEntries(payload)
          .flatMap((entry) =>
            entry.risks_covered.map((risk) => risk.pricing_quote_id?.trim()),
          )
          .filter((value): value is string => !!value),
      ),
    ];
  }

  private indexPayloadRisks(payload: CreateQuotationDto) {
    const index = new Map<string, RiskCoveredDto>();

    for (const risk of this.resolveEntries(payload).flatMap(
      (entry) => entry.risks_covered,
    )) {
      const pricingQuoteId = risk.pricing_quote_id?.trim();
      if (pricingQuoteId) {
        index.set(`quote:${pricingQuoteId}`, risk);
      }
      index.set(`risk:${this.normalizeUppercase(risk.risk_code)}`, risk);
    }

    return index;
  }

  private resolveIndexedRiskSnapshot(
    index: Map<string, RiskCoveredDto>,
    risk: RiskCoveredDto,
  ): RiskCoveredDto | undefined {
    const pricingQuoteId = risk.pricing_quote_id?.trim();
    if (pricingQuoteId && index.has(`quote:${pricingQuoteId}`)) {
      return index.get(`quote:${pricingQuoteId}`);
    }

    return index.get(`risk:${this.normalizeUppercase(risk.risk_code)}`);
  }

  private assertPremiumOverrideWorkflowAllowed(quotation: Quotation): void {
    if (
      quotation.submitted_at ||
      quotation.tira_status !== TiraStatus.NOT_SUBMITTED
    ) {
      throw new ConflictException(
        'Premium overrides are only available before TIRAMIS submission begins',
      );
    }

    if (TERMINAL_QUOTATION_STATUSES.includes(quotation.status)) {
      throw new ConflictException(
        `Premium overrides are not available when the quotation is ${quotation.status}`,
      );
    }
  }

  private assertNoPremiumOverrideHistory(quotation: Quotation): void {
    const hasPremiumOverrideHistory = (
      quotation.cover_note?.entries ?? []
    ).some((entry) =>
      (entry.risks ?? []).some(
        (risk) => (risk.premium_overrides?.length ?? 0) > 0,
      ),
    );

    if (hasPremiumOverrideHistory) {
      throw new ConflictException(
        'This quotation cannot be replaced because it contains premium override history',
      );
    }
  }

  private findQuotationRiskOrFail(
    quotation: Quotation,
    riskId: string,
  ): QuotationEntryRisk {
    for (const entry of quotation.cover_note?.entries ?? []) {
      const risk = entry.risks?.find((item) => item.id === riskId);
      if (risk) {
        return risk;
      }
    }

    throw new NotFoundException('Quotation risk not found');
  }

  private findPremiumOverrideOrFail(
    risk: QuotationEntryRisk,
    premiumOverrideId: string,
  ): QuotationRiskPremiumOverride {
    const premiumOverride = risk.premium_overrides?.find(
      (item) => item.id === premiumOverrideId,
    );

    if (!premiumOverride) {
      throw new NotFoundException('Premium override not found');
    }

    return premiumOverride;
  }

  private assertNoPendingPremiumOverride(risk: QuotationEntryRisk): void {
    const hasPendingPremiumOverride = (risk.premium_overrides ?? []).some(
      (premiumOverride) =>
        premiumOverride.approval_status ===
        QuotationPremiumOverrideStatus.PENDING,
    );

    if (hasPendingPremiumOverride) {
      throw new ConflictException(
        'This risk already has a pending premium override request',
      );
    }
  }

  private assertPremiumOverrideProposal(
    risk: QuotationEntryRisk,
    originalCalculatedPremium: number,
    proposedPremium: number,
  ): void {
    if (this.moneyEqual(originalCalculatedPremium, proposedPremium)) {
      throw new BadRequestException(
        `Risk ${risk.risk_code} already matches the proposed premium`,
      );
    }

    const totalDiscountAmount = roundMoney(
      (risk.discounts ?? []).reduce((sum, discount) => {
        if (Number(discount.discount_rate) > 0) {
          return (
            sum + roundMoney(proposedPremium * Number(discount.discount_rate))
          );
        }
        return sum + Number(discount.discount_amount);
      }, 0),
    );

    if (proposedPremium - totalDiscountAmount < -MONEY_TOLERANCE) {
      throw new BadRequestException(
        'The proposed premium is lower than the configured discount deductions for this risk',
      );
    }
  }

  private async resolveOriginalCalculatedPremium(
    companyId: string,
    risk: QuotationEntryRisk,
  ): Promise<number> {
    const pricingQuoteId = risk.pricing_quote_id?.trim();
    if (!pricingQuoteId) {
      throw new BadRequestException(
        `Risk ${risk.risk_code} does not have a pricing quote to override`,
      );
    }

    const pricingQuote = await this.dataSource
      .getRepository(PricingQuote)
      .findOne({
        where: {
          company_id: companyId,
          pricing_quote_id: pricingQuoteId,
        },
      });

    if (!pricingQuote) {
      throw new BadRequestException(
        `Pricing quote ${pricingQuoteId} was not found for the current company`,
      );
    }

    return roundMoney(Number(pricingQuote.final_premium));
  }

  private latestApprovedPremiumOverride(
    overrides: QuotationRiskPremiumOverride[] | undefined,
  ): QuotationRiskPremiumOverride | null {
    return (
      [...(overrides ?? [])]
        .filter(
          (premiumOverride) =>
            premiumOverride.approval_status ===
            QuotationPremiumOverrideStatus.APPROVED,
        )
        .sort(
          (left, right) =>
            (right.approved_at?.getTime() ?? 0) -
            (left.approved_at?.getTime() ?? 0),
        )[0] ?? null
    );
  }

  private async applyApprovedPremiumOverride(
    manager: EntityManager,
    quotation: Quotation,
    risk: QuotationEntryRisk,
    proposedPremium: string,
  ): Promise<void> {
    const premiumBeforeDiscount = roundMoney(Number(proposedPremium));
    const recalculatedDiscounts = (risk.discounts ?? []).map((discount) => ({
      id: discount.id,
      discount_amount:
        Number(discount.discount_rate) > 0
          ? roundMoney(premiumBeforeDiscount * Number(discount.discount_rate))
          : roundMoney(Number(discount.discount_amount)),
    }));
    const totalDiscountAmount = roundMoney(
      recalculatedDiscounts.reduce(
        (sum, discount) => sum + discount.discount_amount,
        0,
      ),
    );
    const premiumAfterDiscount = roundMoney(
      Math.max(0, premiumBeforeDiscount - totalDiscountAmount),
    );
    const recalculatedTaxes = (risk.taxes ?? []).map((tax) => ({
      id: tax.id,
      tax_amount:
        tax.is_tax_exempted === 'Y'
          ? 0
          : roundMoney(premiumAfterDiscount * Number(tax.tax_rate)),
    }));
    const totalTaxAmount = roundMoney(
      recalculatedTaxes.reduce((sum, tax) => sum + tax.tax_amount, 0),
    );

    await manager.getRepository(QuotationEntryRisk).update(
      { id: risk.id },
      {
        premium_before_discount: this.numeric(premiumBeforeDiscount, 2),
        premium_after_discount: this.numeric(premiumAfterDiscount, 2),
        premium_excluding_tax_equivalent: this.numeric(premiumAfterDiscount, 2),
        premium_including_tax: this.numeric(
          premiumAfterDiscount + totalTaxAmount,
          2,
        ),
      },
    );

    for (const discount of recalculatedDiscounts) {
      await manager.getRepository(QuotationRiskDiscount).update(
        { id: discount.id },
        {
          discount_amount: this.numeric(discount.discount_amount, 2),
        },
      );
      const currentDiscount = risk.discounts?.find(
        (item) => item.id === discount.id,
      );
      if (currentDiscount) {
        currentDiscount.discount_amount = this.numeric(
          discount.discount_amount,
          2,
        );
      }
    }

    for (const tax of recalculatedTaxes) {
      await manager.getRepository(QuotationRiskTax).update(
        { id: tax.id },
        {
          tax_amount: this.numeric(tax.tax_amount, 2),
        },
      );
      const currentTax = risk.taxes?.find((item) => item.id === tax.id);
      if (currentTax) {
        currentTax.tax_amount = this.numeric(tax.tax_amount, 2);
      }
    }

    risk.premium_before_discount = this.numeric(premiumBeforeDiscount, 2);
    risk.premium_after_discount = this.numeric(premiumAfterDiscount, 2);
    risk.premium_excluding_tax_equivalent = this.numeric(
      premiumAfterDiscount,
      2,
    );
    risk.premium_including_tax = this.numeric(
      premiumAfterDiscount + totalTaxAmount,
      2,
    );
    await this.refreshCoverNotePremiumTotals(manager, quotation);
  }

  private async refreshCoverNotePremiumTotals(
    manager: EntityManager,
    quotation: Quotation,
  ): Promise<void> {
    const entries = quotation.cover_note?.entries ?? [];
    const totalPremiumExcludingTax = roundMoney(
      entries.reduce(
        (sum, entry) =>
          sum +
          (entry.risks ?? []).reduce(
            (riskSum, riskItem) =>
              riskSum + Number(riskItem.premium_excluding_tax_equivalent),
            0,
          ) +
          (entry.addons ?? []).reduce(
            (addonSum, addon) => addonSum + Number(addon.premium_excluding_tax),
            0,
          ),
        0,
      ),
    );
    const totalPremiumIncludingTax = roundMoney(
      entries.reduce(
        (sum, entry) =>
          sum +
          (entry.risks ?? []).reduce(
            (riskSum, riskItem) =>
              riskSum + Number(riskItem.premium_including_tax),
            0,
          ) +
          (entry.addons ?? []).reduce(
            (addonSum, addon) => addonSum + Number(addon.premium_including_tax),
            0,
          ),
        0,
      ),
    );

    await manager.getRepository(QuotationCoverNote).update(
      { id: quotation.cover_note.id },
      {
        total_premium_excluding_tax: this.numeric(totalPremiumExcludingTax, 2),
        total_premium_including_tax: this.numeric(totalPremiumIncludingTax, 2),
      },
    );
    quotation.cover_note.total_premium_excluding_tax = this.numeric(
      totalPremiumExcludingTax,
      2,
    );
    quotation.cover_note.total_premium_including_tax = this.numeric(
      totalPremiumIncludingTax,
      2,
    );
  }

  private async resolveExistingCustomerId(
    companyId: string,
    holder: PolicyHolderDto,
  ): Promise<string | null> {
    const identityNumber = holder.policy_holder_id_number.trim().toUpperCase();

    const customer = await this.dataSource
      .getRepository(Customer)
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.deleted_at IS NULL')
      .andWhere('customer.id_type = :idType', {
        idType: holder.policy_holder_id_type,
      })
      .andWhere('UPPER(TRIM(customer.id_number)) = :identityNumber', {
        identityNumber,
      })
      .getOne();

    return customer?.id ?? null;
  }

  private async resolveOrCreateCustomerId(
    manager: EntityManager,
    companyId: string,
    payload: CreateQuotationDto,
    existingCustomerId: string | null,
    userId: string,
  ): Promise<string | null> {
    if (existingCustomerId) {
      return existingCustomerId;
    }

    const holder =
      payload.cover_note_dtl.policy_holders?.[0] ??
      payload.cover_note_dtl.fleet_hdr?.policy_holders?.[0] ??
      null;

    if (!holder) {
      return null;
    }

    const customerType =
      holder.policy_holder_type === 1
        ? CustomerType.INDIVIDUAL
        : CustomerType.CORPORATE;
    const customerRepository = manager.getRepository(Customer);

    // The policyholder may already exist as a customer (e.g. re-entered on a
    // new quotation instead of being selected via customer_id) — id_number
    // and phone are each unique per company, so blindly creating would hit
    // that constraint. Reusing the match here is what the unique index
    // already enforces; this just does it without a 500/409 round-trip.
    const normalizedIdNumber = holder.policy_holder_id_number
      .trim()
      .toUpperCase();
    const normalizedPhone = holder.policy_holder_phone_number.trim();

    const existingByIdNumber = await customerRepository.findOne({
      where: { company_id: companyId, id_number: normalizedIdNumber },
    });
    if (existingByIdNumber) {
      return existingByIdNumber.id;
    }

    const existingByPhone = await customerRepository.findOne({
      where: { company_id: companyId, phone: normalizedPhone },
    });
    if (existingByPhone) {
      return existingByPhone.id;
    }

    const customerNo = await this.generateCustomerNo(manager, companyId);
    const nameParts = holder.policy_holder_name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const customer = customerRepository.create({
      company_id: companyId,
      customer_no: customerNo,
      customer_type: customerType,
      first_name:
        customerType === CustomerType.INDIVIDUAL
          ? (nameParts[0] ?? holder.policy_holder_name.trim())
          : null,
      middle_name:
        customerType === CustomerType.INDIVIDUAL && nameParts.length > 2
          ? nameParts.slice(1, -1).join(' ')
          : null,
      last_name:
        customerType === CustomerType.INDIVIDUAL
          ? nameParts.length > 1
            ? nameParts[nameParts.length - 1]
            : holder.policy_holder_name.trim()
          : null,
      gender:
        customerType === CustomerType.INDIVIDUAL
          ? (holder.gender as CustomerGender | null)
          : null,
      date_of_birth: holder.policy_holder_birth_date ?? null,
      nationality: null,
      company_name:
        customerType === CustomerType.CORPORATE
          ? holder.policy_holder_name.trim()
          : null,
      registration_no: null,
      incorporation_certificate_no: null,
      tin:
        holder.policy_holder_id_type === 6
          ? holder.policy_holder_id_number.trim()
          : null,
      vrn: null,
      policy_holder_type:
        holder.policy_holder_type === 1
          ? CustomerPolicyHolderType.INDIVIDUAL
          : CustomerPolicyHolderType.CORPORATE,
      id_type: holder.policy_holder_id_type,
      id_number: holder.policy_holder_id_number.trim().toUpperCase(),
      nida_no: null,
      voter_no: null,
      passport_no: null,
      driving_license_no: null,
      zanid_no: null,
      phone: holder.policy_holder_phone_number.trim(),
      alternate_phone: null,
      fax: holder.policy_holder_fax?.trim() ?? null,
      email: holder.email_address?.trim().toLowerCase() ?? null,
      country: null,
      country_code: holder.country_code.trim().toUpperCase(),
      region: holder.region.trim(),
      district: holder.district.trim(),
      ward: null,
      street: holder.street?.trim() ?? null,
      postal_address: holder.postal_address?.trim() ?? null,
      latitude: null,
      longitude: null,
      contact_name: null,
      contact_role: null,
      contact_phone: null,
      contact_email: null,
      kyc_status: CustomerKycStatus.PENDING,
      document_type: null,
      document_no: null,
      document_file_name: null,
      document_file_url: null,
      document_mime_type: null,
      document_verified: false,
      document_verified_by: null,
      document_verified_at: null,
      status: CustomerStatus.ACTIVE,
      metadata: {
        source: 'quotation',
        quotation_flow: payload.internal_quotation.quotation_flow,
      },
      created_by: userId,
      updated_by: userId,
    });

    const savedCustomer = await customerRepository.save(customer);
    return savedCustomer.id;
  }

  private mergeLifecycleState(quotation: Quotation, paymentMode: number) {
    const requiresPayment = paymentMode !== DIRECT_PAYMENT_MODE;
    const requiresApproval = quotation.requires_approval;

    return {
      requires_approval: requiresApproval,
      requires_payment: requiresPayment,
      approval_status: requiresApproval
        ? quotation.approval_status
        : ApprovalStatus.NOT_REQUIRED,
      payment_status: requiresPayment
        ? quotation.requires_payment
          ? quotation.payment_status
          : PaymentStatus.NOT_INITIATED
        : PaymentStatus.NOT_REQUIRED,
      tira_status: quotation.tira_status,
      status: quotation.status,
    };
  }

  private async resolveCreationContext(
    companyId: string,
    payload: CreateQuotationDto,
    userId: string,
  ): Promise<CreateQuotationDto> {
    const assignment = await this.branchUserRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.branch', 'branch')
      .innerJoin('assignment.company_user', 'companyUser')
      .where('companyUser.user_id = :userId', { userId })
      .andWhere('companyUser.company_id = :companyId', { companyId })
      .andWhere('companyUser.status = :membershipStatus', {
        membershipStatus: 'active',
      })
      .andWhere('assignment.is_active_branch = true')
      .getOne();

    const branch = assignment?.branch;
    if (
      !assignment ||
      !branch ||
      branch.company_id !== companyId ||
      branch.status !== 'active' ||
      branch.deleted_at
    ) {
      throw new BadRequestException(
        'You do not have a valid active branch. Please select an active branch before creating a quotation.',
      );
    }

    if (!branch.code?.trim()) {
      throw new BadRequestException(
        'The active branch does not have a valid branch code. Please update the branch configuration before creating a quotation.',
      );
    }

    const defaultSalePoints = await this.salePointRepository.find({
      where: {
        companyId,
        branchId: branch.id,
        isDefault: true,
        isActive: true,
      },
    });
    if (defaultSalePoints.length !== 1) {
      throw new BadRequestException(
        'The active branch does not have a valid default sales point. Please configure it before creating a quotation.',
      );
    }

    const salePoint = defaultSalePoints[0];
    if (
      salePoint.branchId !== branch.id ||
      salePoint.companyId !== companyId ||
      !salePoint.isActive ||
      !salePoint.salePointCode?.trim()
    ) {
      throw new BadRequestException(
        'The active branch does not have a valid default sales point. Please configure it before creating a quotation.',
      );
    }

    return {
      ...payload,
      internal_quotation: {
        ...payload.internal_quotation,
        branch_id: branch.id,
      },
      cover_note_dtl: {
        ...payload.cover_note_dtl,
        sale_point_code: salePoint.salePointCode.trim().toUpperCase(),
        fleet_hdr: payload.cover_note_dtl.fleet_hdr
          ? {
              ...payload.cover_note_dtl.fleet_hdr,
              sale_point_code: salePoint.salePointCode.trim().toUpperCase(),
            }
          : undefined,
      },
    };
  }

  private resolveExistingQuotationContext(
    payload: CreateQuotationDto,
    existing: Quotation,
  ): CreateQuotationDto {
    const salePointCode = existing.cover_note?.sale_point_code;
    if (!existing.branch_id || !salePointCode?.trim()) {
      throw new BadRequestException(
        'The quotation branch or sales point code is not configured. Please update the branch configuration before saving this quotation.',
      );
    }

    return {
      ...payload,
      internal_quotation: {
        ...payload.internal_quotation,
        branch_id: existing.branch_id,
      },
      cover_note_dtl: {
        ...payload.cover_note_dtl,
        sale_point_code: salePointCode,
        fleet_hdr: payload.cover_note_dtl.fleet_hdr
          ? {
              ...payload.cover_note_dtl.fleet_hdr,
              sale_point_code: salePointCode,
            }
          : undefined,
      },
    };
  }

  private async persistRoot(
    manager: EntityManager,
    companyId: string,
    quotationNumber: string,
    payload: CreateQuotationDto,
    userId: string,
    customerId: string | null,
    current: Quotation | null,
  ): Promise<Quotation> {
    const internal = payload.internal_quotation;
    const repository = manager.getRepository(Quotation);
    const quotation = current ?? repository.create();
    const header = this.resolveHeader(payload);
    const lifecycleState = current
      ? this.mergeLifecycleState(current, header.payment_mode)
      : this.quotationLifecycleService.initializeForCreation({
          paymentMode: header.payment_mode,
        });

    Object.assign(quotation, {
      company_id: companyId,
      insurer_company_id: internal.insurer_company_id,
      intermediary_company_id: internal.intermediary_company_id ?? null,
      branch_id: internal.branch_id ?? null,
      department_id: internal.department_id ?? null,
      created_by: current?.created_by ?? userId,
      updated_by: userId,
      customer_id: customerId,
      category_id: internal.category_id,
      product_id: internal.product_id,
      sub_class_id: internal.sub_class_id ?? null,
      quotation_no: quotationNumber,
      quotation_type: internal.quotation_type,
      quotation_flow: internal.quotation_flow,
      is_fleet: internal.is_fleet,
      channel_type: internal.channel_type,
      ...lifecycleState,
      rejection_reason: null,
      submitted_by: current?.submitted_by ?? null,
      submitted_at: current?.submitted_at ?? null,
      approval_submitted_by: current?.approval_submitted_by ?? null,
      approval_submitted_at: current?.approval_submitted_at ?? null,
      approval_decided_by: current?.approval_decided_by ?? null,
      approval_decided_at: current?.approval_decided_at ?? null,
      approval_comments: current?.approval_comments ?? null,
      approval_reason: current?.approval_reason ?? null,
      payment_request_reference: current?.payment_request_reference ?? null,
      payment_requested_at: current?.payment_requested_at ?? null,
      payment_completed_at: current?.payment_completed_at ?? null,
      payment_failure_reason: current?.payment_failure_reason ?? null,
      tira_request_id: current?.tira_request_id ?? null,
      tira_response_id: current?.tira_response_id ?? null,
      tira_response_code: current?.tira_response_code ?? null,
      tira_response_description: current?.tira_response_description ?? null,
      tira_error_details: current?.tira_error_details ?? null,
    });

    return repository.save(quotation);
  }

  private async persistAggregate(
    manager: EntityManager,
    quotation: Quotation,
    payload: CreateQuotationDto,
    riskByCode: Map<string, InsuranceRisk>,
    customerId: string | null,
    userId: string,
    exchangeRateSnapshot: ExchangeRateSnapshot | null,
  ): Promise<void> {
    const header = this.resolveHeader(payload);
    const fleetHeader = payload.cover_note_dtl.fleet_hdr;
    const coverNoteRepository = manager.getRepository(QuotationCoverNote);
    const persistedExchangeRateSnapshot = exchangeRateSnapshot
      ? (JSON.parse(JSON.stringify(exchangeRateSnapshot)) as Record<
          string,
          unknown
        >)
      : null;

    const coverNote = await coverNoteRepository.save(
      coverNoteRepository.create({
        quotation_id: quotation.id,
        cover_note_type: payload.cover_note_hdr.cover_note_type,
        sale_point_code: header.sale_point_code.trim().toUpperCase(),
        cover_note_start_date: parseTiramisDateTime(
          header.cover_note_start_date,
        ),
        cover_note_end_date: parseTiramisDateTime(header.cover_note_end_date),
        payment_mode: header.payment_mode,
        currency_code: header.currency_code.trim().toUpperCase(),
        exchange_rate: this.numeric(header.exchange_rate, 6),
        exchange_rate_snapshot: persistedExchangeRateSnapshot,
        total_premium_excluding_tax: this.numeric(
          header.total_premium_excluding_tax,
          2,
        ),
        total_premium_including_tax: this.numeric(
          header.total_premium_including_tax,
          2,
        ),
        commission_paid: this.numeric(header.commision_paid, 2),
        commission_rate: this.numeric(header.commision_rate, 6),
        officer_name: header.officer_name.trim(),
        officer_title: header.officer_title.trim(),
        product_code: header.product_code.trim().toUpperCase(),
        fleet_id: fleetHeader?.fleet_id?.trim().toUpperCase() ?? null,
        fleet_type: fleetHeader?.fleet_type ?? null,
        fleet_size: fleetHeader?.fleet_size ?? null,
        comprehensive_insured: fleetHeader?.comprehensive_insured ?? null,
      }),
    );

    await this.persistPolicyHolders(
      manager,
      quotation.id,
      header.policy_holders,
      customerId,
    );

    const entries = this.resolveEntries(payload);

    for (let index = 0; index < entries.length; index += 1) {
      const input = entries[index];
      const entryRepository = manager.getRepository(QuotationCoverNoteEntry);

      const entry = await entryRepository.save(
        entryRepository.create({
          cover_note_id: coverNote.id,
          entry_type: quotation.is_fleet
            ? QuotationEntryType.FLEET_ITEM
            : QuotationEntryType.STANDARD,
          entry_number: index + 1,
          fleet_entry: quotation.is_fleet ? input.fleet_entry : null,
          cover_note_number: input.cover_note_number.trim().toUpperCase(),
          prev_cover_note_reference_number:
            input.prev_cover_note_reference_number?.trim().toUpperCase() ??
            null,
          cover_note_desc: input.cover_note_desc.trim(),
          operative_clause: input.operative_clause.trim(),
          endorsement_type: input.endorsement_type ?? null,
          endorsement_reason: input.endorsement_reason?.trim() ?? null,
          endorsement_premium_earned:
            input.endorsement_premium_earned === null ||
            input.endorsement_premium_earned === undefined
              ? null
              : this.numeric(input.endorsement_premium_earned, 2),
        }),
      );

      await this.persistEntryChildren(
        manager,
        entry,
        input,
        riskByCode,
        customerId,
        quotation,
        userId,
        header.currency_code,
      );
    }
  }

  private async persistPolicyHolders(
    manager: EntityManager,
    quotationId: string,
    holders: PolicyHolderDto[],
    customerId: string | null,
  ): Promise<void> {
    const repository = manager.getRepository(QuotationPolicyHolder);
    const entities = holders.map((holder, index) =>
      repository.create({
        quotation_id: quotationId,
        customer_id: index === 0 ? customerId : null,
        sequence_no: index + 1,
        policy_holder_name: holder.policy_holder_name.trim(),
        policy_holder_birth_date: holder.policy_holder_birth_date,
        policy_holder_type: holder.policy_holder_type,
        policy_holder_id_number: holder.policy_holder_id_number
          .trim()
          .toUpperCase(),
        policy_holder_id_type: holder.policy_holder_id_type,
        gender: holder.gender ?? null,
        country_code: holder.country_code.trim().toUpperCase(),
        region: holder.region.trim(),
        district: holder.district.trim(),
        street: holder.street?.trim() ?? null,
        policy_holder_phone_number: holder.policy_holder_phone_number.trim(),
        policy_holder_fax: holder.policy_holder_fax?.trim() ?? null,
        postal_address: holder.postal_address?.trim() ?? null,
        email_address: holder.email_address?.trim().toLowerCase() ?? null,
      }),
    );

    if (entities.length > 0) {
      await repository.save(entities);
    }
  }

  private async persistEntryChildren(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
    riskByCode: Map<string, InsuranceRisk>,
    customerId: string | null,
    quotation: Quotation,
    userId: string,
    currencyCode: string,
  ): Promise<void> {
    await this.persistEntryRisks(manager, entry, input, riskByCode, userId);
    await this.persistSubjectMatters(manager, entry, input);
    await this.persistAddons(manager, entry, input);

    if (input.motor_dtl) {
      const motorRepository = manager.getRepository(QuotationMotorDetail);

      await motorRepository.save(
        motorRepository.create({
          entry_id: entry.id,
          ...this.mapMotorForPersistence(input.motor_dtl),
        }),
      );

      if (customerId) {
        await this.persistMotorVehicle(
          manager,
          quotation,
          customerId,
          input.motor_dtl,
          userId,
          currencyCode,
        );
      }
    }
  }

  private async persistMotorVehicle(
    manager: EntityManager,
    quotation: Quotation,
    customerId: string,
    motor: MotorDetailDto,
    userId: string,
    currencyCode: string,
  ): Promise<void> {
    const repository = manager.getRepository(MotorVehicle);
    const registrationNumber = this.normalizeUppercase(
      motor.registration_number,
    );
    const chassisNumber = this.normalizeUppercase(motor.chassis_number);
    const engineNumber = this.normalizeUppercase(motor.engine_number);

    const existingVehicle = await repository
      .createQueryBuilder('vehicle')
      .where('vehicle.company_id = :companyId', {
        companyId: quotation.company_id,
      })
      .andWhere('vehicle.customer_id = :customerId', { customerId })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'UPPER(TRIM(vehicle.registration_no)) = :registrationNumber',
            {
              registrationNumber,
            },
          );
          qb.orWhere('UPPER(TRIM(vehicle.chassis_no)) = :chassisNumber', {
            chassisNumber,
          });
          qb.orWhere('UPPER(TRIM(vehicle.engine_no)) = :engineNumber', {
            engineNumber,
          });
        }),
      )
      .getOne();

    const vehicle = existingVehicle ?? repository.create();

    Object.assign(vehicle, {
      company_id: quotation.company_id,
      customer_id: customerId,
      registration_no: registrationNumber,
      chassis_no: chassisNumber,
      engine_no: engineNumber,
      make: motor.make.trim(),
      model: motor.model.trim(),
      body_type: motor.body_type.trim(),
      color: motor.color.trim(),
      manufacture_year: motor.year_of_manufacture,
      usage_type: motor.fuel_used.trim(),
      seating_capacity: motor.sitting_capacity,
      cubic_capacity: Number.isFinite(Number(motor.engine_capacity))
        ? Number(motor.engine_capacity)
        : null,
      fuel_type: motor.fuel_used.trim(),
      model_no: motor.model_number?.trim() ?? null,
      number_of_axles: motor.number_of_axles,
      axle_distance: this.numeric(motor.axle_distance, 2),
      tare_weight: this.numeric(motor.tare_weight, 2),
      gross_weight: this.numeric(motor.gross_weight, 2),
      motor_category: motor.motor_category,
      motor_type: motor.motor_type,
      motor_usage: motor.motor_usage,
      owner_name: motor.owner_name.trim(),
      owner_category: motor.owner_category,
      owner_address: motor.owner_address.trim(),
      vehicle_value: '0',
      currency: currencyCode.trim().toUpperCase(),
      status: 'ACTIVE',
      metadata: {
        source: 'quotation',
        quotation_id: quotation.id,
        quotation_no: quotation.quotation_no,
        quotation_flow: quotation.quotation_flow,
      },
      created_by: existingVehicle?.created_by ?? userId,
      updated_by: userId,
    });

    await repository.save(vehicle);
  }

  private async generateCustomerNo(
    manager: EntityManager,
    companyId: string,
  ): Promise<string> {
    const year = this.getEastAfricaYear();
    const prefix = `CUST-${year}-`;
    const lockKey = `${companyId}:${prefix}:${year}`;

    await manager.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [lockKey],
    );

    const lastCustomer = await manager
      .getRepository(Customer)
      .createQueryBuilder('customer')
      .where('customer.company_id = :companyId', { companyId })
      .andWhere('customer.customer_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('customer.customer_no', 'DESC')
      .limit(1)
      .getOne();

    const next = lastCustomer?.customer_no
      ? Number(lastCustomer.customer_no.substring(prefix.length)) + 1
      : 1;

    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  private async persistEntryRisks(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
    riskByCode: Map<string, InsuranceRisk>,
    userId: string,
  ): Promise<void> {
    const riskRepository = manager.getRepository(QuotationEntryRisk);
    const discountRepository = manager.getRepository(QuotationRiskDiscount);
    const taxRepository = manager.getRepository(QuotationRiskTax);

    for (
      let riskIndex = 0;
      riskIndex < input.risks_covered.length;
      riskIndex += 1
    ) {
      const inputRisk = input.risks_covered[riskIndex];
      const normalizedRiskCode = this.normalizeUppercase(inputRisk.risk_code);
      const configuredRisk = riskByCode.get(normalizedRiskCode);

      const risk = await riskRepository.save(
        riskRepository.create({
          entry_id: entry.id,
          insurance_risk_id: configuredRisk?.id ?? null,
          sequence_no: riskIndex + 1,
          risk_code: normalizedRiskCode,
          pricing_quote_id: inputRisk.pricing_quote_id?.trim() ?? null,
          sum_insured: this.numeric(inputRisk.sum_insured, 2),
          sum_insured_equivalent: this.numeric(
            inputRisk.sum_insured_equivalent,
            2,
          ),
          premium_rate: this.numeric(inputRisk.premium_rate, 6),
          premium_before_discount: this.numeric(
            inputRisk.premium_before_discount,
            2,
          ),
          premium_after_discount: this.numeric(
            inputRisk.premium_after_discount,
            2,
          ),
          premium_excluding_tax_equivalent: this.numeric(
            inputRisk.premium_excluding_tax_equivalent,
            2,
          ),
          premium_including_tax: this.numeric(
            inputRisk.premium_including_tax,
            2,
          ),
        }),
      );

      const discounts = inputRisk.discounts_offered.map((discount, index) =>
        discountRepository.create({
          risk_id: risk.id,
          sequence_no: index + 1,
          discount_type: discount.discount_type,
          discount_rate: this.numeric(discount.discount_rate, 6),
          discount_amount: this.numeric(discount.discount_amount, 2),
          request_reason_code: discount.request_reason_code?.trim() ?? null,
          request_comment: discount.request_comment?.trim() ?? null,
          effective_from: this.extractDateOnly(discount.effective_from) ?? null,
          effective_to: this.extractDateOnly(discount.effective_to) ?? null,
          requested_by:
            discount.requested_by?.trim() ||
            (Number(discount.discount_amount) > 0 ? userId : null),
          requested_at: discount.requested_at
            ? new Date(discount.requested_at)
            : Number(discount.discount_amount) > 0
              ? new Date()
              : null,
          max_permitted_rate:
            discount.max_permitted_rate != null
              ? this.numeric(discount.max_permitted_rate, 6)
              : null,
          max_permitted_amount:
            discount.max_permitted_amount != null
              ? this.numeric(discount.max_permitted_amount, 2)
              : null,
          approval_required: discount.approval_required ?? false,
          approval_status: discount.approval_required
            ? discount.approval_status?.trim() || 'PENDING'
            : 'NOT_REQUIRED',
          approved_rate:
            discount.approved_rate != null
              ? this.numeric(discount.approved_rate, 6)
              : null,
          approved_amount:
            discount.approved_amount != null
              ? this.numeric(discount.approved_amount, 2)
              : null,
          approved_by: discount.approved_by?.trim() ?? null,
          approval_date: discount.approval_date
            ? new Date(discount.approval_date)
            : null,
          rejection_reason: discount.rejection_reason?.trim() ?? null,
        }),
      );

      if (discounts.length > 0) {
        await discountRepository.save(discounts);
      }

      const taxes = inputRisk.taxes_charged.map((tax, index) =>
        taxRepository.create({
          risk_id: risk.id,
          sequence_no: index + 1,
          tax_code: tax.tax_code.trim().toUpperCase(),
          is_tax_exempted: tax.is_tax_exempted,
          tax_exemption_type: tax.tax_exemption_type?.trim() ?? null,
          tax_exemption_reference: tax.tax_exemption_reference?.trim() ?? null,
          tax_rate: this.numeric(tax.tax_rate, 6),
          tax_amount: this.numeric(tax.tax_amount, 2),
        }),
      );

      if (taxes.length > 0) {
        await taxRepository.save(taxes);
      }
    }
  }

  private async persistSubjectMatters(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
  ): Promise<void> {
    const repository = manager.getRepository(QuotationSubjectMatter);
    const subjects = input.subject_matters_covered.map((subject, index) =>
      repository.create({
        entry_id: entry.id,
        sequence_no: index + 1,
        subject_matter_reference: subject.subject_matter_reference
          .trim()
          .toUpperCase(),
        subject_matter_desc: subject.subject_matter_desc.trim(),
      }),
    );

    if (subjects.length > 0) {
      await repository.save(subjects);
    }
  }

  private async persistAddons(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
  ): Promise<void> {
    const addonRepository = manager.getRepository(QuotationEntryAddon);
    const taxRepository = manager.getRepository(QuotationEntryAddonTax);

    for (
      let addonIndex = 0;
      addonIndex < input.cover_note_addons.length;
      addonIndex += 1
    ) {
      const inputAddon = input.cover_note_addons[addonIndex];

      const addon = await addonRepository.save(
        addonRepository.create({
          entry_id: entry.id,
          sequence_no: addonIndex + 1,
          addon_reference: inputAddon.addon_reference.trim().toUpperCase(),
          addon_desc: inputAddon.addon_desc.trim(),
          addon_amount: this.numeric(inputAddon.addon_amount, 2),
          addon_premium_rate: this.numeric(inputAddon.addon_premium_rate, 6),
          premium_excluding_tax: this.numeric(
            inputAddon.premium_excluding_tax,
            2,
          ),
          premium_excluding_tax_equivalent: this.numeric(
            inputAddon.premium_excluding_tax_equivalent,
            2,
          ),
          premium_including_tax: this.numeric(
            inputAddon.premium_including_tax,
            2,
          ),
        }),
      );

      const taxes = inputAddon.taxes_charged.map((tax, index) =>
        taxRepository.create({
          addon_id: addon.id,
          sequence_no: index + 1,
          tax_code: tax.tax_code.trim().toUpperCase(),
          is_tax_exempted: tax.is_tax_exempted,
          tax_exemption_type: tax.tax_exemption_type?.trim() ?? null,
          tax_exemption_reference: tax.tax_exemption_reference?.trim() ?? null,
          tax_rate: this.numeric(tax.tax_rate, 6),
          tax_amount: this.numeric(tax.tax_amount, 2),
        }),
      );

      if (taxes.length > 0) {
        await taxRepository.save(taxes);
      }
    }
  }

  private mapMotorForPersistence(motor: MotorDetailDto) {
    return {
      motor_category: motor.motor_category,
      motor_type: motor.motor_type,
      registration_number: motor.registration_number.trim().toUpperCase(),
      chassis_number: motor.chassis_number.trim().toUpperCase(),
      make: motor.make.trim(),
      model: motor.model.trim(),
      model_number: motor.model_number?.trim() ?? null,
      body_type: motor.body_type.trim(),
      color: motor.color.trim(),
      engine_number: motor.engine_number.trim().toUpperCase(),
      engine_capacity: motor.engine_capacity.trim(),
      fuel_used: motor.fuel_used.trim(),
      number_of_axles: motor.number_of_axles,
      axle_distance: this.numeric(motor.axle_distance, 2),
      sitting_capacity: motor.sitting_capacity,
      year_of_manufacture: motor.year_of_manufacture,
      tare_weight: this.numeric(motor.tare_weight, 2),
      gross_weight: this.numeric(motor.gross_weight, 2),
      motor_usage: motor.motor_usage,
      owner_name: motor.owner_name.trim(),
      owner_category: motor.owner_category,
      owner_address: motor.owner_address.trim(),
    };
  }

  private resolveHeader(payload: CreateQuotationDto): ResolvedHeader {
    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      const fleetHeader = payload.cover_note_dtl.fleet_hdr!;

      return {
        sale_point_code: fleetHeader.sale_point_code,
        cover_note_start_date: fleetHeader.cover_note_start_date,
        cover_note_end_date: fleetHeader.cover_note_end_date,
        payment_mode: fleetHeader.payment_mode,
        currency_code: fleetHeader.currency_code,
        exchange_rate: fleetHeader.exchange_rate,
        total_premium_excluding_tax: fleetHeader.total_premium_excluding_tax,
        total_premium_including_tax: fleetHeader.total_premium_including_tax,
        commision_paid: fleetHeader.commision_paid,
        commision_rate: fleetHeader.commision_rate,
        officer_name: fleetHeader.officer_name,
        officer_title: fleetHeader.officer_title,
        product_code: fleetHeader.product_code,
        policy_holders: fleetHeader.policy_holders,
        fleet_id: fleetHeader.fleet_id,
        fleet_type: fleetHeader.fleet_type,
        fleet_size: fleetHeader.fleet_size,
        comprehensive_insured: fleetHeader.comprehensive_insured,
      };
    }

    const detail = payload.cover_note_dtl;

    return {
      sale_point_code: detail.sale_point_code!,
      cover_note_start_date: detail.cover_note_start_date!,
      cover_note_end_date: detail.cover_note_end_date!,
      payment_mode: detail.payment_mode!,
      currency_code: detail.currency_code!,
      exchange_rate: detail.exchange_rate!,
      total_premium_excluding_tax: detail.total_premium_excluding_tax!,
      total_premium_including_tax: detail.total_premium_including_tax!,
      commision_paid: detail.commision_paid!,
      commision_rate: detail.commision_rate!,
      officer_name: detail.officer_name!,
      officer_title: detail.officer_title!,
      product_code: detail.product_code!,
      policy_holders: detail.policy_holders!,
    };
  }

  private resolveEntries(payload: CreateQuotationDto): ResolvedEntry[] {
    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      return (payload.cover_note_dtl.fleet_dtls ?? []).map((entry) => ({
        fleet_entry: entry.fleet_entry,
        cover_note_number: entry.cover_note_number ?? '',
        prev_cover_note_reference_number:
          entry.prev_cover_note_reference_number ?? null,
        cover_note_desc: entry.cover_note_desc,
        operative_clause: entry.operative_clause,
        endorsement_type: entry.endorsement_type ?? null,
        endorsement_reason: entry.endorsement_reason ?? null,
        endorsement_premium_earned: entry.endorsement_premium_earned ?? null,
        risks_covered: entry.risks_covered,
        subject_matters_covered: entry.subject_matters_covered,
        cover_note_addons: entry.cover_note_addons,
        motor_dtl: entry.motor_dtl,
      }));
    }

    const detail = payload.cover_note_dtl;

    return [
      {
        fleet_entry: 1,
        cover_note_number: detail.cover_note_number!,
        prev_cover_note_reference_number:
          detail.prev_cover_note_reference_number ?? null,
        cover_note_desc: detail.cover_note_desc!,
        operative_clause: detail.operative_clause!,
        endorsement_type: detail.endorsement_type ?? null,
        endorsement_reason: detail.endorsement_reason ?? null,
        endorsement_premium_earned: detail.endorsement_premium_earned ?? null,
        risks_covered: detail.risks_covered ?? [],
        subject_matters_covered: detail.subject_matters_covered ?? [],
        cover_note_addons: detail.cover_note_addons ?? [],
        motor_dtl: detail.motor_dtl,
      },
    ];
  }

  private async preparePayloadWithGeneratedIdentifiers(
    companyId: string,
    payload: CreateQuotationDto | UpdateQuotationDto,
    currentQuotation?: Quotation | null,
  ): Promise<CreateQuotationDto | UpdateQuotationDto> {
    const prepared = JSON.parse(JSON.stringify(payload)) as
      | CreateQuotationDto
      | UpdateQuotationDto;

    const flow = prepared.internal_quotation.quotation_flow;
    const existingEntries = currentQuotation?.cover_note?.entries ?? [];

    if (flow === QuotationFlow.MOTOR_FLEET) {
      const fleetDetails = prepared.cover_note_dtl.fleet_dtls ?? [];
      const existingNumbers = new Map<number, string>();

      for (const entry of existingEntries) {
        const key = Number(entry.fleet_entry ?? entry.entry_number);
        if (Number.isFinite(key) && entry.cover_note_number) {
          existingNumbers.set(key, entry.cover_note_number);
        }
      }

      const missingCount = fleetDetails.filter((item, index) => {
        const key = Number(item.fleet_entry ?? index + 1);
        return !existingNumbers.has(key);
      }).length;

      const generatedNumbers =
        await this.identifierGeneratorService.generateFleetCoverNoteNumbers(
          companyId,
          missingCount,
        );

      let generatedIndex = 0;
      fleetDetails.forEach((item, index) => {
        const key = Number(item.fleet_entry ?? index + 1);
        const existingNumber = existingNumbers.get(key);
        item.cover_note_number =
          existingNumber ||
          generatedNumbers[generatedIndex++] ||
          item.cover_note_number ||
          '';
      });
    } else {
      const existingNumber = existingEntries[0]?.cover_note_number ?? null;
      prepared.cover_note_dtl.cover_note_number =
        existingNumber ||
        (await this.identifierGeneratorService.generateCoverNoteNumber(
          companyId,
        ));
    }

    return prepared;
  }

  private collectRiskCodes(payload: CreateQuotationDto): string[] {
    return this.resolveEntries(payload).flatMap((entry) =>
      entry.risks_covered.map((risk) =>
        this.normalizeUppercase(risk.risk_code),
      ),
    );
  }

  private async lockQuotationForUpdate(
    manager: EntityManager,
    companyId: string,
    id: string,
  ): Promise<Quotation> {
    const quotation = await manager
      .getRepository(Quotation)
      .createQueryBuilder('quotation')
      .setLock('pessimistic_write')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL')
      .getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  private async applyQuotationStatusUpdate(
    manager: EntityManager,
    quotation: Quotation,
    params: {
      nextStatus: QuotationStatus;
      reason: string;
      changedBy: string | null;
      submittedBy?: string | null;
      submittedAt?: Date | null;
    },
  ) {
    const updates: Partial<Quotation> = {
      status: params.nextStatus,
      updated_by: params.changedBy,
      rejection_reason:
        params.nextStatus === QuotationStatus.REJECTED ? params.reason : null,
    };

    if (params.submittedBy !== undefined) {
      updates.submitted_by = params.submittedBy;
    }

    if (params.submittedAt !== undefined) {
      updates.submitted_at = params.submittedAt;
    }

    await manager.getRepository(Quotation).update(
      {
        id: quotation.id,
        company_id: quotation.company_id,
      },
      updates as any,
    );

    if (quotation.status !== params.nextStatus) {
      await this.recordQuotationStatusHistory(manager, {
        quotationId: quotation.id,
        previousStatus: quotation.status,
        nextStatus: params.nextStatus,
        reason: params.reason,
        changedBy: params.changedBy,
      });
    }
  }

  private async recordQuotationStatusHistory(
    manager: EntityManager,
    params: {
      quotationId: string;
      previousStatus: QuotationStatus;
      nextStatus: QuotationStatus;
      reason: string | null;
      changedBy: string | null;
    },
  ) {
    await manager.getRepository(QuotationStatusHistory).save({
      quotation_id: params.quotationId,
      old_status: params.previousStatus,
      new_status: params.nextStatus,
      reason: params.reason,
      changed_by: params.changedBy,
    });
  }

  private defaultTransitionReason(
    action: QuotationStatusTransitionAction,
    nextStatus: QuotationStatus,
  ) {
    switch (action) {
      case QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS:
        return 'Quotation requirements evaluated';
      case QuotationStatusTransitionAction.SUBMIT_FOR_APPROVAL:
        return 'Quotation submitted for approval';
      case QuotationStatusTransitionAction.APPROVE:
        return 'Quotation approved';
      case QuotationStatusTransitionAction.REQUEST_CHANGES:
        return 'Changes requested';
      case QuotationStatusTransitionAction.REJECT_APPROVAL:
        return 'Quotation rejected during approval';
      case QuotationStatusTransitionAction.MARK_PAYMENT_REQUESTED:
        return 'Payment requested';
      case QuotationStatusTransitionAction.MARK_PAYMENT_PROCESSING:
        return 'Payment processing';
      case QuotationStatusTransitionAction.MARK_PARTIALLY_PAID:
        return 'Quotation partially paid';
      case QuotationStatusTransitionAction.MARK_PAYMENT_PAID:
        return 'Quotation paid in full';
      case QuotationStatusTransitionAction.MARK_PAYMENT_FAILED:
        return 'Payment failed';
      case QuotationStatusTransitionAction.MARK_PAYMENT_EXPIRED:
        return 'Payment request expired';
      case QuotationStatusTransitionAction.MARK_PAYMENT_REFUNDED:
        return 'Payment refunded';
      case QuotationStatusTransitionAction.CANCEL:
        return 'Quotation cancelled';
      case QuotationStatusTransitionAction.EXPIRE:
        return 'Quotation expired';
      case QuotationStatusTransitionAction.CONVERT:
        return `Quotation transitioned to ${nextStatus}`;
      default:
        return `Quotation transitioned to ${nextStatus}`;
    }
  }

  private assertQuotationEditable(quotation: Quotation): void {
    if (quotation.submitted_at) {
      throw new ConflictException(
        'A submitted quotation cannot be replaced. Create an endorsement or a new quotation.',
      );
    }

    if (!EDITABLE_QUOTATION_STATUSES.includes(quotation.status)) {
      throw new ConflictException(
        `Quotation in ${quotation.status} status cannot be replaced`,
      );
    }
  }

  private async assertPaymentReady(quotation: Quotation): Promise<void> {
    const paymentMode = quotation.cover_note?.payment_mode;

    if (paymentMode === DIRECT_PAYMENT_MODE) {
      return;
    }

    const invoices: Array<{
      id: string;
      status: string;
      total_amount: string;
      paid_amount: string;
      balance_amount: string;
    }> = await this.dataSource.query(
      `
        SELECT
          id,
          status,
          total_amount,
          paid_amount,
          balance_amount
        FROM invoices
        WHERE quotation_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `,
      [quotation.id],
    );

    const settled = invoices.some((invoice) => {
      const status = String(invoice.status).toUpperCase();
      const totalAmount = Number(invoice.total_amount ?? 0);
      const paidAmount = Number(invoice.paid_amount ?? 0);
      const balanceAmount = Number(invoice.balance_amount ?? 0);

      if (['PAID', 'SETTLED'].includes(status)) {
        return true;
      }

      return totalAmount > 0 && balanceAmount <= 0 && paidAmount >= totalAmount;
    });

    if (!settled) {
      throw new ConflictException(
        'Quotation payment is not settled. Only direct payment mode can be submitted without a settled invoice.',
      );
    }
  }

  private async findLatestInvoice(companyId: string, quotationId: string) {
    return this.dataSource
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .where('invoice.company_id = :companyId', { companyId })
      .andWhere('invoice.quotation_id = :quotationId', { quotationId })
      .andWhere('invoice.deleted_at IS NULL')
      .orderBy('invoice.created_at', 'DESC')
      .getOne();
  }

  private async findLatestReceipt(companyId: string, quotationId: string) {
    const invoice = await this.findLatestInvoice(companyId, quotationId);

    if (!invoice) {
      return null;
    }

    return this.dataSource
      .getRepository(Receipt)
      .createQueryBuilder('receipt')
      .where('receipt.company_id = :companyId', { companyId })
      .andWhere('receipt.invoice_id = :invoiceId', { invoiceId: invoice.id })
      .andWhere('receipt.deleted_at IS NULL')
      .orderBy('receipt.created_at', 'DESC')
      .getOne();
  }

  private async findLatestPaymentTransaction(
    companyId: string,
    quotationId: string,
  ) {
    const invoice = await this.findLatestInvoice(companyId, quotationId);

    if (!invoice) {
      return null;
    }

    return this.dataSource
      .getRepository(PaymentTransaction)
      .createQueryBuilder('paymentTransaction')
      .where('paymentTransaction.company_id = :companyId', { companyId })
      .andWhere('paymentTransaction.invoice_id = :invoiceId', {
        invoiceId: invoice.id,
      })
      .andWhere('paymentTransaction.deleted_at IS NULL')
      .orderBy('paymentTransaction.created_at', 'DESC')
      .getOne();
  }

  private async findLatestPortalSubmission(
    companyId: string,
    quotationId: string,
  ) {
    return this.dataSource
      .getRepository(PortalTiraSubmission)
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.events', 'event')
      .where('submission.company_id = :companyId', { companyId })
      .andWhere('submission.quotation_id = :quotationId', { quotationId })
      .andWhere('submission.deleted_at IS NULL')
      .orderBy('submission.created_at', 'DESC')
      .addOrderBy('event.created_at', 'ASC')
      .getOne();
  }

  private async findLatestTiramisTracking(
    companyId: string,
    quotation: Quotation,
  ) {
    const trackingRepository = this.dataSource.getRepository(
      TiramisSubmissionTrackingEntity,
    );

    const entries = quotation.cover_note?.entries ?? [];
    const businessReferences = Array.from(
      new Set(
        [
          quotation.id,
          quotation.quotation_no,
          quotation.cover_note?.fleet_id,
          ...entries.map((entry) => entry.cover_note_number),
        ].filter((value): value is string => Boolean(value && value.trim())),
      ),
    );

    const trackings = await trackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.source_company_id = :companyId', { companyId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_module = :module', {
            module: 'quotations',
          }).orWhere('tracking.source_module ILIKE :fleetModule', {
            fleetModule: '%quotation%',
          });
        }),
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_record_id IN (:...references)', {
            references: businessReferences,
          }).orWhere('tracking.business_reference IN (:...references)', {
            references: businessReferences,
          });
        }),
      )
      .orderBy('tracking.created_at', 'DESC')
      .getMany();

    return trackings[0] ?? null;
  }

  private async findTiramisTrackingByEntry(
    companyId: string,
    quotation: Quotation,
  ) {
    const trackingRepository = this.dataSource.getRepository(
      TiramisSubmissionTrackingEntity,
    );
    const entries = quotation.cover_note?.entries ?? [];
    const references = Array.from(
      new Set(
        entries
          .map((entry) => entry.cover_note_number)
          .filter((value): value is string => Boolean(value && value.trim())),
      ),
    );

    if (references.length === 0) {
      return new Map<string, TiramisSubmissionTrackingEntity | null>();
    }

    const trackings = await trackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.source_company_id = :companyId', { companyId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_record_id IN (:...references)', {
            references,
          }).orWhere('tracking.business_reference IN (:...references)', {
            references,
          });
        }),
      )
      .orderBy('tracking.created_at', 'DESC')
      .getMany();

    const byReference = new Map<
      string,
      TiramisSubmissionTrackingEntity | null
    >();
    for (const tracking of trackings) {
      const key = tracking.sourceRecordId || tracking.businessReference || '';
      if (key && !byReference.has(key)) {
        byReference.set(key, tracking);
      }
    }

    for (const reference of references) {
      if (!byReference.has(reference)) {
        byReference.set(reference, null);
      }
    }

    return byReference;
  }

  private toTiramisRequestType(flow: QuotationFlow): TiramisRequestType {
    switch (flow) {
      case QuotationFlow.NON_MOTOR:
        return TiramisRequestType.NON_MOTOR;
      case QuotationFlow.MOTOR_SINGLE:
        return TiramisRequestType.MOTOR;
      case QuotationFlow.MOTOR_FLEET:
        return TiramisRequestType.MOTOR_FLEET;
      default:
        throw new BadRequestException(
          `Unsupported quotation flow: ${String(flow)}`,
        );
    }
  }

  private numeric(value: NumericValue, scale: number): string {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      throw new BadRequestException(
        'Quotation contains an invalid numeric value',
      );
    }

    return numberValue.toFixed(scale);
  }

  private normalizeUppercase(value: string): string {
    return value.trim().toUpperCase();
  }

  private getEastAfricaYear(): number {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Dar_es_Salaam',
        year: 'numeric',
      }).format(new Date()),
    );
  }

  private rethrowConstraintError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (
        error as QueryFailedError & {
          driverError?: PostgreSqlDriverError;
        }
      ).driverError;

      const code = String(driverError?.code ?? '');
      const constraint = driverError?.constraint ?? '';

      if (code === '23505') {
        if (constraint.includes('cover_note_number')) {
          throw new ConflictException(
            'The supplied cover-note number already exists',
          );
        }

        if (constraint.includes('fleet_id')) {
          throw new ConflictException('The supplied fleet ID already exists');
        }

        if (constraint.includes('quotation_no')) {
          throw new ConflictException(
            'The generated quotation number already exists. Retry the request.',
          );
        }

        if (constraint.includes('motor_vehicles_company_registration_no')) {
          throw new ConflictException(
            'The supplied vehicle registration number already exists',
          );
        }

        if (constraint.includes('cover_note_entry_number')) {
          throw new ConflictException(
            'A fleet entry with this entry number already exists on this cover note',
          );
        }

        // Inline customer creation (resolveOrCreateCustomerId) can collide on
        // any of the customer's "identity" fields, which are each unique per
        // company — surface which one so the user knows to search for the
        // existing customer instead of re-entering it as new.
        const customerFieldMessages: Array<[string, string]> = [
          ['customers_company_phone', 'phone number'],
          ['customers_company_email', 'email address'],
          ['customers_company_id_number', 'ID number'],
          ['customers_company_nida_no', 'NIDA number'],
          ['customers_company_voter_no', 'voter number'],
          ['customers_company_passport_no', 'passport number'],
          ['customers_company_driving_license_no', 'driving license number'],
          ['customers_company_zanid_no', 'ZanID number'],
          ['customers_company_tin', 'TIN'],
          ['customers_company_registration_no', 'registration number'],
        ];
        const matchedCustomerField = customerFieldMessages.find(([needle]) =>
          constraint.includes(needle),
        );
        if (matchedCustomerField) {
          throw new ConflictException(
            `A customer with this ${matchedCustomerField[1]} already exists`,
          );
        }

        // Duplicate sequence_no within a risk/entry/addon's line items —
        // typically a payload-building bug (e.g. two discount rows sharing
        // the same sequence number) rather than a real data conflict.
        if (constraint.includes('_sequence')) {
          throw new ConflictException(
            'Duplicate line-item sequence detected while saving the quotation. Refresh the quotation and try again.',
          );
        }

        throw new ConflictException('A unique quotation value already exists');
      }

      if (code === '23503') {
        throw new BadRequestException(
          'Quotation contains an invalid relationship reference',
        );
      }

      if (code === '23514') {
        throw new BadRequestException({
          message: 'Quotation violates a database validation constraint',
          constraint: constraint || undefined,
          detail: driverError?.detail || undefined,
        });
      }

      if (code === '22P02') {
        throw new BadRequestException(
          'Quotation contains an invalid identifier or enum value',
        );
      }

      if (code === '22003') {
        throw new BadRequestException(
          'Quotation contains a numeric value outside the supported range',
        );
      }
    }

    throw error;
  }
}
