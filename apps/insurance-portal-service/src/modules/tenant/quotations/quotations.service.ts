import { TiramisPlatformAccessService } from '../../shared/organization/tiramis-platform-access.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
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
import {
  PricingResultSnapshot,
  PricingRateBookSnapshot,
  ProductDefinitionSnapshot,
  ProductReviewStatus,
  ProductVersionStatus,
  QuotationCommand,
  QuotationWorkflowView,
  QuotationApprovalStatus,
  QuotationPaymentStatus,
  QuotationStage,
  QuotationSubmissionStatus,
  type QuotationBlockingReason,
  InvoiceStatus,
  ServiceInsuredDataContext,
  ServiceFinanceContext,
  ServicePricingContext,
  ServiceProductContext,
  ServiceQuotationGateContext,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
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
import { CustomerVersion } from '../customers/entities/customer-version.entity';
import { InsuredAsset } from '../customers/entities/insured-asset.entity';
import { Department } from '../departments/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceBusinessLine } from '../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceProductVersion } from '../insurance-products/entities/insurance-product-version.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductDefinitionService } from '../insurance-products/product-definition.service';
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
  SubmitQuotationDto,
  TaxChargedDto,
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
import { QuotationRiskAsset } from './entities/structured/quotation-risk-asset.entity';
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
import { normalizeQuotationCoverPeriod } from './utils/quotation-cover-period.util';
import {
  QuotationAccessSnapshot,
  QuotationsRepository,
} from './repositories/quotations.repository';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { InsuranceChannelPermissionService } from './authorization/insurance-channel-permission';
import { normalizeMotorTextValue } from './utils/motor-text.util';
import { resolveQuotationCoverNoteType } from './utils/cover-note-type.util';
import { motorUsageTypeLabel } from './utils/motor-usage-type.util';
import { parseTiramisDateTime } from './utils/tiramis-date.util';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { MotorVehicleVersion } from '../motor/entities/motor-vehicle-version.entity';
import { SubjectMatter } from '../non-motor/entities/subject-matter.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { PaymentTransaction } from '../billing-commission/entities/payment-transaction.entity';
import { CommissionTransaction } from '../billing-commission/entities/commission-transaction.entity';
import { QuotationInvoiceService } from '../billing-commission/services/quotation-invoice.service';
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
import { Tax } from '../taxes/entities/tax.entity';
import { TaxesService } from '../taxes/taxes.service';
import {
  EDITABLE_QUOTATION_STATUSES,
  TERMINAL_QUOTATION_STATUSES,
} from './utils/quotation-status-transition.util';
import { QuotationLifecycleService } from './services/quotation-lifecycle.service';
import { NonMotorRiskService } from '../underwrite/non-motor/non-motor-risk.service';
import { canSelfApprove } from '../../shared/authorization/maker-checker';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';

type NumericValue = number | string | null | undefined;

interface ScopeValidationResult {
  product: InsuranceProduct;
  customerId: string | null;
  riskByCode: Map<string, InsuranceRisk>;
  productDefinition: ProductDefinitionSnapshot;
}

interface DraftBranchContext {
  branchId: string;
  salePointCode: string;
  officer: { officer_name: string; officer_title: string };
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

interface ReplaceQuotationOptions {
  reuseExistingIdentifiers?: boolean;
  /** Set by finalize(), which already ran the Non-Motor finalize gates. */
  nonMotorGatesChecked?: boolean;
}

interface QuotationWriteAccessOptions {
  allowBranchFailedCorrection?: boolean;
  scopePermission?: string;
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
  column?: string;
  constraint?: string;
  detail?: string;
  table?: string;
}

const DEFAULT_PAYMENT_MODE = 1;
const QUOTATION_COMPLETE_PERMISSION = 'quotations:complete';
const QUOTATION_SUBMIT_APPROVAL_PERMISSION = 'quotations:submit-approval';
const QUOTATION_APPROVE_PERMISSIONS = [
  'quotations:approve',
  'quotations:approve-high-risk',
] as const;
const QUOTATION_REQUEST_CHANGES_PERMISSION = 'quotations:request-changes';
const QUOTATION_REJECT_PERMISSION = 'quotations:reject';
const QUOTATION_REQUEST_PAYMENT_PERMISSION = 'quotations:request-payment';
const QUOTATION_SUBMIT_TIRAMIS_PERMISSION = 'quotations:submit-tiramis';
const QUOTATION_RETRY_TIRAMIS_PERMISSION = 'quotations:retry-tiramis';
const QUOTATION_CANCEL_PERMISSION = 'quotations:cancel';
const QUOTATION_DELETE_DRAFT_PERMISSION = 'quotations:delete-draft';
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
    private readonly insuranceChannelPermissionService: InsuranceChannelPermissionService,
    private readonly auditService: AuditService,
    private readonly pricingChargeService: PricingChargeService,
    private readonly exchangeRateGovernanceService: ExchangeRateGovernanceService,
    private readonly pricingQuoteService: PricingQuoteService,
    private readonly productDefinitionService: ProductDefinitionService,
    private readonly taxesService: TaxesService,
    private readonly productDefinitionHashService: ProductDefinitionHashService,
    private readonly quotationInvoiceService: QuotationInvoiceService,
    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>,
    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,
    private readonly nonMotorRiskService: NonMotorRiskService,
    private readonly businessReferenceService: BusinessReferenceService,
    @Optional()
    private readonly platformAccess?: TiramisPlatformAccessService,
  ) {}

  /** New business needs the insurer's TIRAMIS access to be active. */
  private async assertInsurerCanTransact(companyId: string) {
    await this.platformAccess?.assertCompanyCanTransact(companyId);
  }

  private resolveUserScope(
    user: AuthenticatedUser,
    permission = 'quotations:read',
  ): TenantDataScope {
    return this.dataAccessScopeService.resolve(user, permission);
  }

  private async assertUserCanReadQuotation(
    user: AuthenticatedUser,
    quotationId: string,
  ): Promise<TenantDataScope> {
    const scope = this.resolveUserScope(user, 'quotations:read');

    await this.quotationsRepository.assertReadable(scope, quotationId);

    return scope;
  }

  private async assertUserCanWriteQuotation(
    user: AuthenticatedUser,
    quotationId: string,
    options: QuotationWriteAccessOptions = {},
  ): Promise<TenantDataScope> {
    const scope = this.resolveUserScope(
      user,
      options.scopePermission ?? 'quotations:update',
    );

    // Users in the same branch may continue each other's quotations; the
    // scope limits writes to the user's assigned branches.
    await this.quotationsRepository.assertWritable(scope, quotationId);

    return scope;
  }

  private isTiraFailureSnapshot(
    quotation: Pick<QuotationAccessSnapshot, 'submitted_at' | 'tira_status'>,
  ): boolean {
    return (
      !!quotation.submitted_at &&
      [TiraStatus.FAILED, TiraStatus.REJECTED].includes(
        quotation.tira_status as TiraStatus,
      )
    );
  }

  private isTiraFailureQuotation(quotation: Quotation): boolean {
    return this.isTiraFailureSnapshot({
      submitted_at: quotation.submitted_at,
      tira_status: quotation.tira_status,
    });
  }

  async create(
    companyId: string,
    payload: CreateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'> &
      Partial<AuthenticatedUser>,
  ) {
    await this.assertInsurerCanTransact(companyId);
    const authorizedPayload =
      await this.insuranceChannelPermissionService.authorizeQuotationPayload(
        companyId,
        payload,
        user,
        'quotation.create',
      );
    const contextPayload = await this.resolveCreationContext(
      companyId,
      authorizedPayload,
      user.id,
    );
    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      contextPayload,
    );

    await this.applyDefaultTaxesToQuotationPayload(
      companyId,
      preparedPayload,
      user,
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
          preparedPayload,
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
          scope.productDefinition,
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
    user: AuthenticatedUser | string,
  ) {
    await this.assertInsurerCanTransact(companyId);
    try {
      const channelUser =
        typeof user === 'string'
          ? { id: user, permissions: [] as string[] }
          : user;
      const authorizedDto =
        await this.insuranceChannelPermissionService.authorizeDraftPayload(
          companyId,
          dto,
          channelUser,
          'quotation.draft.create',
        );
      const quotationId = await this.dataSource.transaction((manager) =>
        this.createDraftInTransaction(
          manager,
          companyId,
          authorizedDto,
          channelUser.id,
        ),
      );
      return this.findOneForEdit(companyId, quotationId);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async createDraftInTransaction(
    manager: EntityManager,
    companyId: string,
    dto: SaveQuotationDraftDto,
    userId: string,
    draftBranchContext?: DraftBranchContext,
  ): Promise<string> {
    const draftPayload = await this.withDefaultTaxesForDraftPayload(
      companyId,
      dto.draft_payload,
    );
    const quotationNo =
      await this.identifierGeneratorService.generateQuotationNumber(
        companyId,
        manager,
      );
    const { branchId, salePointCode, officer } =
      draftBranchContext ??
      (dto.branch_id
        ? await this.resolveExplicitDraftBranchContext(
            companyId,
            dto.branch_id,
            userId,
          )
        : null) ??
      (await this.resolveDraftBranchContext(companyId, userId));
    const { productCode, definition } =
      await this.resolveDraftProductDefinition(
        manager,
        dto.insurer_company_id ?? companyId,
        dto.product_id,
        dto.sub_class_id,
        draftPayload,
      );
    const lifecycleState = this.quotationLifecycleService.initializeForCreation(
      {
        paymentMode: DEFAULT_PAYMENT_MODE,
        existingApprovalRequired: false,
      },
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
        ...lifecycleState,
        current_wizard_step: dto.current_wizard_step ?? null,
        draft_payload: this.cloneDraftPayload(draftPayload),
        product_version_id: definition.productVersionId,
        product_definition_hash: definition.definitionHash,
        product_definition_snapshot: definition,
      }),
    );

    await this.upsertDraftPlaceholderAggregate(
      manager,
      quotation,
      { ...dto, draft_payload: draftPayload },
      salePointCode,
      productCode,
      officer,
    );
    await this.recordQuotationStatusHistory(manager, {
      quotationId: quotation.id,
      previousStatus: null,
      nextStatus: quotation.status,
      reason: 'Quotation draft created',
      changedBy: userId,
    });

    return quotation.id;
  }

  async finalizeGeneratedDraftInTransaction(
    manager: EntityManager,
    companyId: string,
    id: string,
    payload: UpdateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'> &
      Partial<AuthenticatedUser>,
    options: ReplaceQuotationOptions = {},
  ) {
    const existing = await this.findAggregateInTransaction(
      manager,
      companyId,
      id,
    );
    this.assertDraftWritable(existing);

    const authorizedPayload =
      await this.insuranceChannelPermissionService.authorizeQuotationPayload(
        companyId,
        payload,
        user,
        'quotation.update',
        id,
      );
    const contextPayload = await this.resolveExistingQuotationContext(
      companyId,
      authorizedPayload,
      existing,
      user.id,
    );
    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      contextPayload,
      existing,
      options,
    );

    await this.applyDefaultTaxesToQuotationPayload(
      companyId,
      preparedPayload,
      user,
      existing.id,
      existing.quotation_no,
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
        reason:
          'Generated policy transaction quotation payload validation succeeded before finalization',
      },
    );
    this.assertDiscountPermissions(preparedPayload, user, existing);

    const lockedQuotation = await this.lockQuotationForUpdate(
      manager,
      companyId,
      id,
    );
    this.assertDraftWritable(lockedQuotation);

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
      scope.productDefinition,
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

    await manager.getRepository(Quotation).update(
      { id, company_id: companyId },
      {
        current_wizard_step: null,
        draft_payload: null,
      },
    );

    Object.assign(quotation, {
      current_wizard_step: null,
      draft_payload: null,
    });

    await this.quotationLifecycleService.evaluateRequirementsInTransaction(
      manager,
      quotation,
      {
        changedBy: user.id,
        changedByType: 'USER',
        source: 'SYSTEM',
        channel: quotation.channel_type,
        reason: 'Policy transaction quotation finalized from policy snapshot',
      },
    );

    return quotation;
  }

  async createCustomerPortalDraft(
    companyId: string,
    dto: SaveQuotationDraftDto,
    user: AuthenticatedUser,
  ) {
    await this.assertInsurerCanTransact(companyId);
    const draftBranchContext =
      await this.resolveCompanyDefaultDraftBranchContext(companyId);

    try {
      const authorizedDto =
        await this.insuranceChannelPermissionService.authorizeDraftPayload(
          companyId,
          dto,
          user,
          'quotation.draft.create',
        );
      const quotationId = await this.dataSource.transaction((manager) =>
        this.createDraftInTransaction(
          manager,
          companyId,
          authorizedDto,
          user.id,
          draftBranchContext,
        ),
      );
      return this.findOneForEdit(companyId, quotationId);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async submitCustomerPortalQuotation(
    companyId: string,
    id: string,
    payload: UpdateQuotationDto,
    user: AuthenticatedUser,
  ) {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    const portalQuotationUser = this.buildCustomerPortalQuotationUser(
      companyId,
      user,
      quotation.branch_id,
    );

    await this.finalize(companyId, id, payload, portalQuotationUser, {
      reuseExistingIdentifiers: false,
    });

    return this.submit(
      companyId,
      id,
      { return_existing: true },
      portalQuotationUser,
    );
  }

  async replace(
    companyId: string,
    id: string,
    payload: UpdateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'> &
      Partial<AuthenticatedUser>,
    options: ReplaceQuotationOptions = {},
  ) {
    const existing = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    await this.assertUserCanWriteQuotation(user as AuthenticatedUser, id, {
      allowBranchFailedCorrection: this.isTiraFailureQuotation(existing),
    });
    this.assertQuotationEditable(existing);
    this.assertNoPremiumOverrideHistory(existing);
    // Replacing a non-draft quotation re-evaluates (completes) it again.
    if (
      !options.nonMotorGatesChecked &&
      existing.status !== QuotationStatus.DRAFT
    ) {
      await this.assertNonMotorFinalizeGates(companyId, existing, payload);
    }
    const correctionBeforeState =
      this.buildFailedCorrectionAuditState(existing);
    const authorizedPayload =
      await this.insuranceChannelPermissionService.authorizeQuotationPayload(
        companyId,
        payload,
        user,
        'quotation.update',
        id,
      );

    const contextPayload = await this.resolveExistingQuotationContext(
      companyId,
      authorizedPayload,
      existing,
      user.id,
    );
    const preparedPayload = await this.preparePayloadWithGeneratedIdentifiers(
      companyId,
      contextPayload,
      existing,
      {
        reuseExistingIdentifiers: options.reuseExistingIdentifiers ?? true,
      },
    );

    await this.applyDefaultTaxesToQuotationPayload(
      companyId,
      preparedPayload,
      user,
      existing.id,
      existing.quotation_no,
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
          authorizedPayload.expected_updated_at &&
          lockedQuotation.updated_at.toISOString() !==
            authorizedPayload.expected_updated_at
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
          scope.productDefinition,
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
      await this.logFailedTiraCorrectionAudit({
        companyId,
        user: user as AuthenticatedUser,
        before: correctionBeforeState,
        after: {
          quotationId: quotation.id,
          quotationNo: quotation.quotation_no,
          branchId: correctionBeforeState.branchId,
          quotationStatus: quotation.status,
          tiraStatus: quotation.tira_status,
          authoritativePayload: preparedPayload,
        },
      });
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
    const authorizedDto =
      await this.insuranceChannelPermissionService.authorizeDraftPayload(
        companyId,
        dto,
        user,
        'quotation.draft.update',
        id,
      );

    if (
      authorizedDto.expected_updated_at &&
      existing.updated_at.toISOString() !== authorizedDto.expected_updated_at
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

        const draftContext = await this.resolveDraftBranchContext(
          companyId,
          userId,
        );
        const salePointCode =
          quotation.cover_note?.sale_point_code?.trim() ||
          draftContext.salePointCode;
        const draftPayload = await this.withDefaultTaxesForDraftPayload(
          companyId,
          authorizedDto.draft_payload,
        );
        const { productCode, definition } =
          await this.resolveDraftProductDefinition(
            manager,
            authorizedDto.insurer_company_id ?? quotation.company_id,
            authorizedDto.product_id,
            authorizedDto.sub_class_id,
            draftPayload,
          );
        const lifecycleState =
          this.quotationLifecycleService.initializeForCreation({
            paymentMode: DEFAULT_PAYMENT_MODE,
            existingApprovalRequired: false,
          });

        Object.assign(quotation, {
          insurer_company_id:
            authorizedDto.insurer_company_id ?? quotation.company_id,
          intermediary_company_id:
            authorizedDto.intermediary_company_id ?? null,
          department_id: authorizedDto.department_id ?? null,
          customer_id: authorizedDto.customer_id ?? null,
          category_id: authorizedDto.category_id,
          product_id: authorizedDto.product_id,
          sub_class_id: authorizedDto.sub_class_id ?? null,
          quotation_type: authorizedDto.quotation_type,
          quotation_flow: authorizedDto.quotation_flow,
          is_fleet: authorizedDto.is_fleet,
          channel_type: authorizedDto.channel_type,
          updated_by: userId,
          ...lifecycleState,
          current_wizard_step: authorizedDto.current_wizard_step ?? null,
          draft_payload: this.cloneDraftPayload(draftPayload),
          product_version_id: definition.productVersionId,
          product_definition_hash: definition.definitionHash,
          product_definition_snapshot: definition,
        });
        await manager.getRepository(Quotation).save(quotation);

        await this.upsertDraftPlaceholderAggregate(
          manager,
          quotation,
          { ...authorizedDto, draft_payload: draftPayload },
          salePointCode,
          productCode,
          draftContext.officer,
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
    user: Pick<AuthenticatedUser, 'id' | 'permissions'> &
      Partial<AuthenticatedUser>,
    options: ReplaceQuotationOptions = {},
  ) {
    this.assertWorkflowPermission(user, QUOTATION_COMPLETE_PERMISSION);
    const existing = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    await this.assertUserCanWriteQuotation(user as AuthenticatedUser, id, {
      allowBranchFailedCorrection: this.isTiraFailureQuotation(existing),
    });
    this.assertDraftWritable(existing);
    await this.assertNonMotorFinalizeGates(companyId, existing, payload);

    const quotation = await this.replace(companyId, id, payload, user, {
      ...options,
      nonMotorGatesChecked: true,
    });

    const replacedAggregate = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    await this.assertPricingSnapshotsCurrent(companyId, replacedAggregate);

    await this.quotationLifecycleService.evaluateRequirements(companyId, id, {
      changedBy: user.id,
      changedByType: 'USER',
      source: 'USER',
      channel: replacedAggregate.channel_type,
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

  /**
   * Non-Motor completion gates: the risk details must satisfy the product
   * risk schema and the mandatory quotation documents must be attached.
   * Enforced here so every completion path (legacy, Underwrite and portal
   * routes) runs them.
   */
  private async assertNonMotorFinalizeGates(
    companyId: string,
    existing: Pick<Quotation, 'id' | 'quotation_flow'>,
    payload: UpdateQuotationDto,
  ): Promise<void> {
    const internal = payload.internal_quotation;

    if (
      existing.quotation_flow !== QuotationFlow.NON_MOTOR &&
      internal?.quotation_flow !== QuotationFlow.NON_MOTOR
    ) {
      return;
    }

    await this.nonMotorRiskService.assertCompleteForFinalize(
      companyId,
      existing.id,
      internal.product_id,
      internal.sub_class_id,
    );
    await this.nonMotorRiskService.assertDocumentsCompleteForFinalize(
      companyId,
      existing.id,
      internal.product_id,
      internal.sub_class_id,
    );
  }

  async submitForApprovalAction(
    companyId: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    this.assertWorkflowPermission(user, QUOTATION_SUBMIT_APPROVAL_PERMISSION);
    await this.assertUserCanWriteQuotation(user, id, {
      scopePermission: QUOTATION_SUBMIT_APPROVAL_PERMISSION,
    });

    await this.quotationLifecycleService.submitForApproval(companyId, id, {
      changedBy: user.id,
      changedByType: 'USER',
      source: 'USER',
      reason: 'Quotation submitted for approval',
    });

    return this.findOneForUser(user, id);
  }

  async requestPayment(companyId: string, id: string, user: AuthenticatedUser) {
    this.assertWorkflowPermission(user, QUOTATION_REQUEST_PAYMENT_PERMISSION);
    await this.assertUserCanWriteQuotation(user, id, {
      scopePermission: QUOTATION_REQUEST_PAYMENT_PERMISSION,
    });

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    this.assertPaymentRequestAllowed(quotation);

    const invoice = await this.createOrReuseQuotationPaymentInvoice(
      companyId,
      quotation,
      user.id,
      'Quotation payment invoice generated from workflow',
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
    this.assertWorkflowPermission(user, QUOTATION_RETRY_TIRAMIS_PERMISSION);
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    await this.assertUserCanWriteQuotation(user, id, {
      allowBranchFailedCorrection: this.isTiraFailureQuotation(quotation),
      scopePermission: QUOTATION_RETRY_TIRAMIS_PERMISSION,
    });

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
    this.assertWorkflowPermission(user, QUOTATION_CANCEL_PERMISSION);
    await this.assertUserCanWriteQuotation(user, id, {
      scopePermission: QUOTATION_CANCEL_PERMISSION,
    });

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

  async getWorkflowView(
    companyId: string,
    id: string,
    user?: Pick<AuthenticatedUser, 'permissions'> | null,
  ): Promise<QuotationWorkflowView> {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    return this.buildWorkflowView(quotation, companyId, user);
  }

  async getWorkflowViewForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<QuotationWorkflowView> {
    const scope = this.resolveUserScope(user);
    const quotation = await this.quotationsRepository.findOneAggregateForScope(
      scope,
      id,
    );

    return this.buildWorkflowView(quotation, quotation.company_id, user);
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
    await this.assertUserCanWriteQuotation(user, quotationId, {
      scopePermission: 'pricing.request_override',
    });

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
    await this.assertUserCanWriteQuotation(user, quotationId, {
      scopePermission: 'pricing.approve_override',
    });

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
    await this.assertUserCanWriteQuotation(user, quotationId, {
      scopePermission: 'pricing.approve_override',
    });

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

  async remove(companyId: string, id: string, actorId?: string): Promise<void> {
    return this.removeDraft(companyId, id, actorId);
  }

  async removeDraft(
    companyId: string,
    id: string,
    actorId?: string,
  ): Promise<void> {
    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );
    await this.assertDraftDeletionAllowed(companyId, quotation);

    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(Quotation).softDelete({
        id,
        company_id: companyId,
      });

      if (!result.affected) {
        throw new NotFoundException('Quotation not found');
      }

      await this.auditService.logCritical(
        {
          userId: actorId,
          actorType: actorId ? 'user' : 'service',
          actorService: actorId ? undefined : 'intermediary-portal',
          companyId,
          action: 'quotation.draft.deleted',
          eventCategory: 'quotation',
          resource: 'quotation',
          resourceId: id,
          reason: 'Untouched quotation draft soft-deleted',
          beforeState: {
            status: quotation.status,
            approval_status: quotation.approval_status,
            payment_status: quotation.payment_status,
            tira_status: quotation.tira_status,
          },
          afterState: { deleted: true },
        },
        manager,
      );
    });
  }

  async removeDraftForUser(user: AuthenticatedUser, id: string): Promise<void> {
    this.assertWorkflowPermission(user, QUOTATION_DELETE_DRAFT_PERMISSION);
    await this.assertUserCanWriteQuotation(user, id, {
      scopePermission: QUOTATION_DELETE_DRAFT_PERMISSION,
    });

    const quotation = await this.quotationsRepository.findOneAggregate(
      user.companyId!,
      id,
    );

    await this.assertDraftDeletionAllowed(user.companyId!, quotation);

    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(Quotation).softDelete({
        id,
        company_id: user.companyId!,
      });

      if (!result.affected) {
        throw new NotFoundException('Quotation not found');
      }

      await this.auditService.logCritical(
        {
          userId: user.id,
          companyId: user.companyId,
          companyMembershipId: user.companyMembershipId,
          branchId: user.activeBranchId,
          action: 'quotation.draft.deleted',
          eventCategory: 'quotation',
          resource: 'quotation',
          resourceId: id,
          reason: 'Untouched quotation draft soft-deleted',
          beforeState: {
            status: quotation.status,
            approval_status: quotation.approval_status,
            payment_status: quotation.payment_status,
            tira_status: quotation.tira_status,
          },
          afterState: { deleted: true },
        },
        manager,
      );
    });
  }

  async submit(
    companyId: string,
    id: string,
    dto: SubmitQuotationDto | undefined,
    user: AuthenticatedUser,
  ) {
    const submitOptions = dto ?? {};

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    const shouldRetryTiraFailure =
      this.isTiraFailureQuotation(quotation) &&
      quotation.tira_status === TiraStatus.FAILED;

    if (shouldRetryTiraFailure && !submitOptions.return_existing) {
      submitOptions.force_resubmit = true;
    }

    this.assertWorkflowPermission(
      user,
      submitOptions.force_resubmit
        ? QUOTATION_RETRY_TIRAMIS_PERMISSION
        : QUOTATION_SUBMIT_TIRAMIS_PERMISSION,
    );

    await this.assertUserCanWriteQuotation(user, id, {
      allowBranchFailedCorrection:
        !!submitOptions.force_resubmit &&
        this.isTiraFailureQuotation(quotation),
    });

    // A quotation generated automatically for an endorsement/cancellation/
    // renewal (`PolicyTransactionQuotationFactoryService`) must never be
    // submitted through this ordinary new-business/quotation TIRAMIS path —
    // that submission would carry `source_module: 'quotations'`, which the
    // policy-transaction-only guards in `IssuanceService.applyNotification`
    // and `TiramisIntegrationService.updateLinkedQuotation` do not cover,
    // risking a spurious duplicate submission or an accidental new-policy
    // issuance for what is actually a change to an existing policy. The
    // real submission for these transactions goes through
    // `PolicyTransactionTiramisSubmissionService` instead.
    if (quotation.source_policy_transaction_id) {
      throw new ConflictException(
        'This quotation was generated automatically for a policy endorsement/cancellation/renewal and cannot be submitted directly. Submit the endorsement/cancellation transaction instead.',
      );
    }

    const isRetryableTiraFailure =
      !!submitOptions.force_resubmit &&
      quotation.status === QuotationStatus.FAILED &&
      quotation.tira_status === TiraStatus.FAILED;

    if (
      TERMINAL_QUOTATION_STATUSES.includes(quotation.status) &&
      !isRetryableTiraFailure
    ) {
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

    const isBranchFailedResubmission =
      !!submitOptions.force_resubmit &&
      this.isTiraFailureQuotation(quotation) &&
      quotation.created_by !== user.id;

    const productContext = quotation.product_definition_snapshot
      ? this.buildServiceProductContext(
          quotation.product_definition_snapshot,
          tiramisPayload,
        )
      : undefined;

    const riskWithPricingSnapshot = (quotation.cover_note?.entries ?? [])
      .flatMap((entry) => entry.risks ?? [])
      .find((risk) => !!risk.pricing_snapshot);
    const pricingContext = riskWithPricingSnapshot?.pricing_snapshot
      ? await this.buildServicePricingContext(
          companyId,
          riskWithPricingSnapshot.pricing_snapshot as unknown as PricingResultSnapshot,
          riskWithPricingSnapshot.pricing_quote_id,
        )
      : undefined;
    const insuredDataContext = await this.buildServiceInsuredDataContext(
      quotation,
      tiramisPayload,
    );
    const quotationGateContext = this.buildServiceQuotationGateContext(
      quotation,
      tiramisPayload,
      submitOptions,
    );
    const financeContext = await this.buildServiceFinanceContext(
      companyId,
      quotation,
    );

    await this.quotationLifecycleService.recordWorkflowFinalization({
      companyId,
      quotationId: quotation.id,
      finalizationSnapshot: tiramisPayload,
      finalizationHash: quotationGateContext.finalizationHash,
      workflowGateHash: quotationGateContext.workflowGateHash,
      completedAt: quotationGateContext.completedAt
        ? new Date(quotationGateContext.completedAt)
        : null,
      changedBy: user.id,
    });

    let result: Record<string, unknown>;

    try {
      result = await this.tiramisBusinessSubmitService.submitAnyBusinessRecord({
        requestType,
        sourceModule: 'quotations',
        sourceRecordId: quotation.id,
        productContext,
        pricingContext,
        insuredDataContext,
        quotationId: quotation.id,
        quotationGateContext,
        financeContext,
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

      if (isBranchFailedResubmission) {
        await this.auditService.logCritical({
          userId: user.id,
          companyId,
          companyMembershipId: user.companyMembershipId ?? null,
          branchId: quotation.branch_id,
          action: 'quotation.failed_tira.resubmitted',
          eventCategory: 'quotation',
          resource: 'quotation',
          resourceId: quotation.id,
          metadata: {
            quotationNo: quotation.quotation_no,
            originalCreatorId: quotation.created_by,
            resubmittedBy: user.id,
            tiraRequestId: quotation.tira_request_id,
            tiraResponseId: quotation.tira_response_id,
            result,
          },
        });
      }
    }

    return {
      quotation_id: quotation.id,
      quotation_no: quotation.quotation_no,
      request_type: requestType,
      submitted_at: submittedAt.toISOString(),
      submission: result,
    };
  }

  /**
   * Explicitly moves a quotation onto the latest effective product
   * definition. Never happens automatically — the caller must confirm
   * the new wording/add-ons/documents are still acceptable.
   */
  async rebaseProductVersion(
    companyId: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    await this.assertUserCanWriteQuotation(user, id);

    const quotation = await this.quotationsRepository.findOneAggregate(
      companyId,
      id,
    );

    if (TERMINAL_QUOTATION_STATUSES.includes(quotation.status)) {
      throw new ConflictException(
        `Quotation in ${quotation.status} status cannot be rebased`,
      );
    }

    const latestDefinition =
      await this.productDefinitionService.resolvePublishedDefinition(
        quotation.insurer_company_id,
        quotation.product_id,
        quotation.sub_class_id,
      );

    const selectedAddonCodes = await this.dataSource
      .getRepository(QuotationEntryAddon)
      .createQueryBuilder('addon')
      .innerJoin('addon.entry', 'entry')
      .innerJoin('entry.cover_note', 'coverNote')
      .where('coverNote.quotation_id = :id', { id })
      .getMany()
      .then((addons) =>
        addons.map((addon) => addon.addon_reference.trim().toUpperCase()),
      );

    this.validateSelectedAddons(
      latestDefinition,
      selectedAddonCodes.map((code) => ({ addon_reference: code })),
    );

    const beforeVersionId = quotation.product_version_id;

    await this.dataSource.getRepository(Quotation).update(quotation.id, {
      product_version_id: latestDefinition.productVersionId,
      product_definition_hash: latestDefinition.definitionHash,
      product_definition_snapshot: latestDefinition,
      updated_by: user.id,
    });

    await this.auditService.logCritical({
      userId: user.id,
      companyId,
      action: 'quotation.product_version.rebased',
      eventCategory: 'product_catalogue',
      resource: 'quotation',
      resourceId: quotation.id,
      beforeState: { productVersionId: beforeVersionId },
      afterState: { productVersionId: latestDefinition.productVersionId },
    });

    // Any pricing snapshots computed against the previous product version
    // are no longer valid — clear them so premiums must be recalculated
    // against the rebased version.
    const rebasedRiskIds = await this.dataSource
      .getRepository(QuotationEntryRisk)
      .createQueryBuilder('risk')
      .innerJoin('risk.entry', 'entry')
      .innerJoin('entry.cover_note', 'coverNote')
      .where('coverNote.quotation_id = :id', { id })
      .select('risk.id')
      .getMany()
      .then((risks) => risks.map((risk) => risk.id));

    if (rebasedRiskIds.length > 0) {
      await this.dataSource.getRepository(QuotationEntryRisk).update(
        { id: In(rebasedRiskIds) },
        {
          pricing_quote_id: null,
          pricing_result_hash: null,
          pricing_snapshot: null,
        },
      );
    }

    return {
      ...(await this.findOne(companyId, id)),
      pricing_recalculation_required: true,
    };
  }

  async transitionStatus(
    companyId: string,
    id: string,
    dto: TransitionQuotationStatusDto,
    user: AuthenticatedUser,
  ) {
    this.assertTransitionPermission(user, dto.action);
    const actionPermission: Partial<
      Record<QuotationStatusTransitionAction, string>
    > = {
      [QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS]:
        'quotations:update',
      [QuotationStatusTransitionAction.SUBMIT_FOR_APPROVAL]:
        QUOTATION_SUBMIT_APPROVAL_PERMISSION,
      [QuotationStatusTransitionAction.APPROVE]: this.hasPermission(
        user,
        'quotations:approve-high-risk',
      )
        ? 'quotations:approve-high-risk'
        : 'quotations:approve',
      [QuotationStatusTransitionAction.REQUEST_CHANGES]:
        QUOTATION_REQUEST_CHANGES_PERMISSION,
      [QuotationStatusTransitionAction.REJECT_APPROVAL]:
        QUOTATION_REJECT_PERMISSION,
      [QuotationStatusTransitionAction.MARK_PAYMENT_REQUESTED]:
        QUOTATION_REQUEST_PAYMENT_PERMISSION,
      [QuotationStatusTransitionAction.CANCEL]: QUOTATION_CANCEL_PERMISSION,
    };
    await this.assertUserCanWriteQuotation(user, id, {
      scopePermission: actionPermission[dto.action] ?? 'quotations:update',
    });

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
      isMakerCheckerExempt: canSelfApprove(user),
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

  private async resolveDraftBranchContext(
    companyId: string,
    userId: string,
  ): Promise<DraftBranchContext> {
    const assignment = await this.branchUserRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.branch', 'branch')
      .innerJoinAndSelect('assignment.company_user', 'companyUser')
      .innerJoinAndSelect('companyUser.user', 'user')
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
      officer: this.resolveOfficerDetails(
        assignment.company_user?.user ?? null,
      ),
    };
  }

  private async resolveExplicitDraftBranchContext(
    companyId: string,
    branchId: string,
    userId: string,
  ): Promise<DraftBranchContext> {
    const branch = await this.dataSource.getRepository(Branch).findOne({
      where: {
        id: branchId,
        company_id: companyId,
        status: 'active',
      },
    });

    if (!branch || branch.deleted_at) {
      throw new BadRequestException(
        'The selected quotation branch is not active.',
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
        'The selected quotation branch does not have a valid default sales point. Please configure it before saving a quotation draft.',
      );
    }

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
    });

    return {
      branchId: branch.id,
      salePointCode: defaultSalePoints[0].salePointCode.trim().toUpperCase(),
      officer: this.resolveOfficerDetails(user),
    };
  }

  private async resolveCompanyDefaultDraftBranchContext(
    companyId: string,
  ): Promise<DraftBranchContext> {
    const branchRepository = this.dataSource.getRepository(Branch);
    const branch = await branchRepository.findOne({
      where: {
        company_id: companyId,
        is_head_office: true,
        status: 'active',
      },
      order: { created_at: 'ASC' },
    });

    if (!branch || branch.deleted_at) {
      throw new BadRequestException(
        'The insurer does not have an active HQ branch configured for customer portal quotations.',
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
        'The insurer HQ branch does not have a valid default sales point configured for customer portal quotations.',
      );
    }

    return {
      branchId: branch.id,
      salePointCode: defaultSalePoints[0].salePointCode.trim().toUpperCase(),
      officer: {
        officer_name: 'Customer Portal',
        officer_title: 'Customer Self Service',
      },
    };
  }

  private buildCustomerPortalQuotationUser(
    companyId: string,
    user: AuthenticatedUser,
    branchId: string | null,
  ): AuthenticatedUser {
    return {
      ...user,
      scope: 'company',
      userType: 'CUSTOMER',
      companyId,
      companyType: CompanyType.INSURANCE_COMPANY,
      companyMembershipId:
        user.companyMembershipId ?? `customer-portal:${user.id}:${companyId}`,
      activeBranchId: branchId,
      assignedBranchIds: branchId ? [branchId] : [],
      permissions: Array.from(
        new Set([
          ...(user.permissions ?? []),
          QUOTATION_COMPLETE_PERMISSION,
          QUOTATION_SUBMIT_TIRAMIS_PERMISSION,
        ]),
      ),
    };
  }

  private async resolveDraftProductDefinition(
    manager: EntityManager,
    insurerCompanyId: string,
    productId: string,
    subClassId?: string | null,
    draftPayload?: Record<string, unknown> | null,
  ): Promise<{ productCode: string; definition: ProductDefinitionSnapshot }> {
    const product = await manager.getRepository(InsuranceProduct).findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Selected product was not found');
    }

    const definition =
      await this.productDefinitionService.resolvePublishedDefinition(
        insurerCompanyId,
        productId,
        subClassId ?? null,
        this.resolveDraftEffectiveDate(draftPayload),
      );

    return { productCode: definition.tiramisProductCode, definition };
  }

  /**
   * Resolves the product definition against the draft's planned cover
   * start date rather than "today" — a draft written today for cover
   * starting next month must see whichever version is effective on that
   * future start date, not whichever happens to be effective right now.
   */
  private resolveDraftEffectiveDate(
    draftPayload?: Record<string, unknown> | null,
  ): Date {
    if (!draftPayload) return new Date();

    const today = new Date().toISOString().slice(0, 10);
    const validFrom = this.draftDateTime(
      draftPayload,
      'valid_from',
      today,
      false,
    );
    const parsed = new Date(validFrom);

    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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
    officer: { officer_name: string; officer_title: string },
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
          DEFAULT_PAYMENT_MODE,
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
        officer_name: officer.officer_name,
        officer_title: officer.officer_title,
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

    if (this.isCashPaymentMode(quotation)) {
      throw new ConflictException(
        'Cash payment is settled directly when submitting the quotation.',
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

  private async assertDraftDeletionAllowed(
    companyId: string,
    quotation: Quotation,
  ): Promise<void> {
    if (
      quotation.status !== QuotationStatus.DRAFT ||
      quotation.approval_submitted_at ||
      quotation.approval_decided_at ||
      quotation.payment_requested_at ||
      quotation.payment_completed_at ||
      quotation.source_policy_transaction_id ||
      ![ApprovalStatus.NOT_REQUIRED, ApprovalStatus.NOT_SUBMITTED].includes(
        quotation.approval_status,
      ) ||
      ![PaymentStatus.NOT_REQUIRED, PaymentStatus.NOT_INITIATED].includes(
        quotation.payment_status,
      )
    ) {
      throw new ConflictException(
        'Only an untouched draft with no approval, payment, or transaction history can be deleted.',
      );
    }

    if (quotation.submitted_at) {
      throw new ConflictException('A submitted quotation cannot be deleted');
    }

    if (quotation.tira_status !== TiraStatus.NOT_SUBMITTED) {
      throw new ConflictException(
        'Only quotations that were never submitted to TIRA can be deleted',
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
        'Quotations with TIRA or financial history cannot be deleted',
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

    const productDefinition =
      await this.productDefinitionService.resolvePublishedDefinition(
        internal.insurer_company_id,
        product.id,
        internal.sub_class_id ?? null,
        this.resolveQuotationEffectiveDate(header.cover_note_start_date),
      );

    if (
      internal.quotation_flow === QuotationFlow.MOTOR_FLEET &&
      !productDefinition.supportsFleet
    ) {
      throw new BadRequestException(
        'The selected product version does not support fleet quotations',
      );
    }

    if (
      this.normalizeUppercase(productDefinition.tiramisProductCode) !==
      this.normalizeUppercase(header.product_code)
    ) {
      throw new BadRequestException(
        `cover note product_code must be ${productDefinition.tiramisProductCode}`,
      );
    }

    const primaryPolicyHolder = header.policy_holders[0];
    const customerId = primaryPolicyHolder
      ? await this.resolveExistingCustomerId(companyId, primaryPolicyHolder)
      : null;

    return {
      product,
      customerId,
      riskByCode,
      productDefinition,
    };
  }

  private async assertProductSnapshotIntegrity(
    companyId: string,
    quotation: Quotation,
  ): Promise<void> {
    const storedDefinition = quotation.product_definition_snapshot;

    if (
      !storedDefinition ||
      !quotation.product_version_id ||
      !quotation.product_definition_hash
    ) {
      throw new BadRequestException({
        code: 'QUOTATION_PRODUCT_SNAPSHOT_MISSING',
        message: 'The quotation does not contain a product-definition snapshot',
      });
    }

    const productVersion = await this.dataSource
      .getRepository(InsuranceProductVersion)
      .findOne({
        where: {
          id: quotation.product_version_id,
          company_id: companyId,
        },
      });

    if (!productVersion) {
      throw new ConflictException({
        code: 'QUOTATION_PRODUCT_VERSION_NOT_FOUND',
        message: 'The referenced product version is no longer available',
      });
    }

    if (
      productVersion.definition_hash === quotation.product_definition_hash &&
      storedDefinition.definitionHash === quotation.product_definition_hash
    ) {
      if (
        productVersion.status !== ProductVersionStatus.PUBLISHED ||
        productVersion.review_status !== ProductReviewStatus.APPROVED
      ) {
        throw new ConflictException({
          code: 'QUOTATION_PRODUCT_VERSION_NOT_APPROVED',
          message: 'The referenced product version is no longer approved',
        });
      }

      return;
    }

    const currentHash = this.productDefinitionHashService.hashDefinition({
      ...storedDefinition,
      definitionHash: '',
      publishedAt: null,
    });

    if (currentHash !== quotation.product_definition_hash) {
      throw new ConflictException({
        code: 'QUOTATION_PRODUCT_SNAPSHOT_TAMPERED',
        message: 'The quotation product snapshot failed integrity validation',
      });
    }

    if (
      storedDefinition.versionStatus !== ProductVersionStatus.PUBLISHED ||
      storedDefinition.reviewStatus !== ProductReviewStatus.APPROVED
    ) {
      throw new ConflictException({
        code: 'QUOTATION_PRODUCT_VERSION_NOT_APPROVED',
        message: 'The referenced product version is no longer approved',
      });
    }
  }

  private resolveQuotationEffectiveDate(
    coverNoteStartDate: string | null | undefined,
  ): Date {
    if (!coverNoteStartDate) return new Date();
    const parsed = new Date(coverNoteStartDate);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private resolveCoverText(options: {
    supplied?: string | null;
    approvedDefault: string;
    overrideAllowed: boolean;
    fieldName: string;
  }): string {
    const supplied = options.supplied?.trim();

    if (
      supplied &&
      !options.overrideAllowed &&
      supplied !== options.approvedDefault
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_COVER_TEXT_OVERRIDE_NOT_ALLOWED',
        message: `The selected product does not allow ${options.fieldName} to be overridden`,
      });
    }

    return options.overrideAllowed && supplied
      ? supplied
      : options.approvedDefault;
  }

  private validateSelectedAddons(
    definition: ProductDefinitionSnapshot,
    requestedAddons: Array<{ addon_reference: string; quantity?: number }>,
  ): void {
    const allowed = new Map(
      definition.addons.map((addon) => [addon.code, addon]),
    );

    for (const requested of requestedAddons) {
      const code = requested.addon_reference.trim().toUpperCase();
      const definitionAddon = allowed.get(code);

      if (!definitionAddon) {
        throw new BadRequestException(
          `Add-on ${code} is not permitted by this product version`,
        );
      }

      if (
        definitionAddon.maximumQuantity &&
        (requested.quantity ?? 1) > definitionAddon.maximumQuantity
      ) {
        throw new BadRequestException(
          `Add-on ${code} exceeds its maximum quantity`,
        );
      }
    }
  }

  /**
   * Hashes are signed against the wording actually being submitted, not
   * the product's static default text. When allows_cover_text_override
   * is true, a quotation's resolved wording can legitimately differ from
   * the product default (per entry), so the outbound TIRAMIS payload's
   * own fields are the only reliable source of truth for what TIRAMIS
   * must later re-verify.
   */
  private buildServiceProductContext(
    definition: ProductDefinitionSnapshot,
    outboundPayload: Record<string, unknown>,
  ): ServiceProductContext {
    const outboundCoverNoteDesc =
      typeof outboundPayload.coverNoteDesc === 'string'
        ? outboundPayload.coverNoteDesc
        : definition.coverNoteDescription;
    const outboundOperativeClause =
      typeof outboundPayload.operativeClause === 'string'
        ? outboundPayload.operativeClause
        : definition.operativeClause;

    return {
      productId: definition.productId,
      productVersionId: definition.productVersionId,
      versionNumber: definition.versionNumber,
      productCode: definition.productCode,
      tiramisProductCode: definition.tiramisProductCode,
      definitionHash: definition.definitionHash,
      // A renewal/endorsement submits its own type, not the product default.
      coverNoteType:
        typeof outboundPayload.coverNoteType === 'number'
          ? outboundPayload.coverNoteType
          : definition.coverNoteType,
      coverNoteDescriptionHash: this.productDefinitionHashService.hashText(
        outboundCoverNoteDesc,
      ),
      operativeClauseHash: this.productDefinitionHashService.hashText(
        outboundOperativeClause,
      ),
      policyOperativeClauseHash: this.productDefinitionHashService.hashText(
        definition.policyOperativeClause,
      ),
      specialConditionsHash: this.productDefinitionHashService.hashText(
        definition.specialConditions,
      ),
      exclusionsHash: this.productDefinitionHashService.hashText(
        definition.exclusions,
      ),
      allowsCoverTextOverride: definition.allowsCoverTextOverride,
    };
  }

  /**
   * Mirrors buildServiceProductContext, but signs the authoritative pricing
   * result actually attached to the risk being submitted, so TIRAMIS can
   * independently re-verify the premium it is being asked to bind against.
   */
  private async buildServicePricingContext(
    companyId: string,
    snapshot: PricingResultSnapshot,
    pricingQuoteId?: string | null,
  ): Promise<ServicePricingContext> {
    const pricingQuote = pricingQuoteId
      ? await this.dataSource.getRepository(PricingQuote).findOne({
          where: {
            company_id: companyId,
            pricing_quote_id: pricingQuoteId,
          },
        })
      : null;
    const persistedRateBookSnapshot =
      pricingQuote?.rate_book_snapshot as PricingRateBookSnapshot | null;
    const rateBookSnapshot = snapshot.rateBook ?? persistedRateBookSnapshot;
    const rateBookId =
      rateBookSnapshot?.rateBookId ?? pricingQuote?.rate_book_id ?? '';
    const rateBook = rateBookId
      ? await this.dataSource.getRepository(PricingRateBook).findOne({
          where: {
            company_id: companyId,
            id: rateBookId,
          },
        })
      : null;
    const matchedRule = rateBookSnapshot?.matchedRule;
    const resolvedPricingQuoteId =
      snapshot.pricingQuoteId ?? pricingQuote?.pricing_quote_id ?? '';
    const rateBookDefinitionHash =
      rateBookSnapshot?.definitionHash?.trim() ||
      pricingQuote?.rate_book_definition_hash?.trim() ||
      rateBook?.definition_hash?.trim() ||
      '';
    const matchedRuleId =
      matchedRule?.ruleId?.trim() || pricingQuote?.matched_rule_id || '';
    const resultHash =
      snapshot.resultHash?.trim() || pricingQuote?.result_hash?.trim() || '';
    const premiumIncludingTax =
      this.readPricingResultPayloadString(pricingQuote, [
        'premium_including_tax',
        'premium_including_charges',
      ]) ?? snapshot.finalPayablePremium;

    // Not every priced risk is backed by a rate book: risks priced from a
    // direct rating rule (e.g. TIRA base rates with no configured rate book,
    // as is the case for every non-motor risk today) legitimately have no
    // rateBookId. Only require the rate-book hash when a rate book was
    // actually matched; otherwise the pricing signature is fully carried by
    // the matched rule and result hash.
    if (
      !resolvedPricingQuoteId ||
      !matchedRuleId ||
      !resultHash ||
      (rateBookId && !rateBookDefinitionHash)
    ) {
      throw new ConflictException({
        code: 'TIRAMIS_PRICING_CONTEXT_INCOMPLETE',
        message:
          'The quotation pricing quote is missing signed TIRAMIS pricing context data. Recalculate premium and try again.',
        details: {
          action: 'RECALCULATE_PREMIUM',
        },
      });
    }

    return {
      pricingQuoteId: resolvedPricingQuoteId,
      productVersionId:
        rateBookSnapshot?.productVersionId?.trim() ||
        pricingQuote?.product_version_id ||
        rateBook?.product_version_id ||
        '',
      productDefinitionHash:
        rateBookSnapshot?.productDefinitionHash?.trim() ||
        pricingQuote?.product_definition_hash?.trim() ||
        rateBook?.product_definition_hash?.trim() ||
        '',
      rateBookId,
      rateBookCode: rateBookSnapshot?.code?.trim() || rateBook?.code || '',
      rateBookVersion:
        rateBookSnapshot?.version?.trim() ||
        pricingQuote?.rate_book_version ||
        rateBook?.version ||
        '',
      rateBookDefinitionHash,
      matchedRuleId,
      matchedRuleVersion:
        matchedRule?.ruleVersion ?? pricingQuote?.matched_rule_version ?? 0,
      riskId: snapshot.riskId,
      riskCode: snapshot.riskCode,
      currencyCode: snapshot.currencyCode,
      basicPremium: snapshot.premiumAfterMaximum,
      addonPremium: snapshot.baseAddonPremium,
      loadingAmount: snapshot.loading.appliedAmount,
      discountAmount: snapshot.discount.appliedAmount,
      premiumExcludingTax: snapshot.premiumExcludingCharges,
      taxAmount: snapshot.totalChargeAmount,
      premiumIncludingTax,
      finalPayablePremium: snapshot.finalPayablePremium,
      calculationVersion: snapshot.calculationVersion,
      inputHash: snapshot.inputHash,
      resultHash: snapshot.resultHash,
    };
  }

  private readPricingResultPayloadString(
    pricingQuote: PricingQuote | null,
    keys: string[],
  ): string | null {
    const payload = pricingQuote?.result_payload ?? {};

    for (const key of keys) {
      const value = payload[key];
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }

    return null;
  }

  private async buildServiceInsuredDataContext(
    quotation: Quotation,
    outboundPayload: Record<string, unknown>,
  ): Promise<ServiceInsuredDataContext> {
    const customer = quotation.customer;

    if (!customer?.id || !customer.customer_no) {
      throw new ConflictException(
        'Quotation is missing an authoritative customer record for TIRAMIS submission.',
      );
    }

    const policyHolderManifest =
      this.buildTiramisPolicyHolderManifest(outboundPayload);

    if (policyHolderManifest.length === 0) {
      throw new BadRequestException(
        'Quotation is missing policy-holder data for TIRAMIS submission.',
      );
    }

    const assetManifest = this.buildTiramisAssetManifest(outboundPayload);

    if (assetManifest.length === 0) {
      throw new BadRequestException(
        'Quotation is missing insured-asset data for TIRAMIS submission.',
      );
    }

    await this.assertVerifiedQuotationRiskAssets(quotation, assetManifest);

    const tiramisPolicyHolderHash =
      this.productDefinitionHashService.hashDefinition(
        policyHolderManifest as unknown as Record<string, unknown>,
      );
    const assetManifestHash = this.productDefinitionHashService.hashDefinition(
      assetManifest as unknown as Record<string, unknown>,
    );

    return {
      customerId: customer.id,
      customerNumber: customer.customer_no,
      customerKycStatus: customer.kyc_status,
      customerKycVersion: Number(customer.kyc_version ?? 0),
      customerSnapshotHash: tiramisPolicyHolderHash,
      tiramisPolicyHolderHash,
      assetManifestHash,
      assetCount: assetManifest.length,
      manifestVersion: '8.1',
    };
  }

  private async assertVerifiedQuotationRiskAssets(
    quotation: Quotation,
    assetManifest: Array<Record<string, string | number | null>>,
  ) {
    const assets = await this.dataSource
      .getRepository(QuotationRiskAsset)
      .find({
        where: { quotation_id: quotation.id },
      });

    if (assets.length < assetManifest.length) {
      throw new ConflictException(
        'Quotation insured assets must be verified before TIRAMIS submission.',
      );
    }

    if (assets.some((asset) => !asset.asset_snapshot_hash?.trim())) {
      throw new ConflictException(
        'Quotation contains insured assets without verified snapshots.',
      );
    }

    return assets;
  }

  private buildServiceQuotationGateContext(
    quotation: Quotation,
    outboundPayload: Record<string, unknown>,
    submitOptions: SubmitQuotationDto,
  ): ServiceQuotationGateContext {
    const workflowRevision = Math.max(
      1,
      quotation.workflow_revision ?? quotation.status_history?.length ?? 0,
    );
    const quotationStage = this.mapQuotationStageForGate(
      quotation,
      submitOptions,
    );
    const approvalStatus = this.mapApprovalStatusForGate(quotation);
    const paymentStatus = this.mapPaymentStatusForGate(quotation);
    const submissionStatus = this.mapSubmissionStatusForGate(
      quotation,
      submitOptions,
    );
    const completedAt = (
      quotation.workflow_completed_at ??
      quotation.submitted_at ??
      quotation.updated_at ??
      quotation.created_at ??
      null
    )?.toISOString();
    const finalizationHash =
      quotation.finalization_hash ??
      this.productDefinitionHashService.hashDefinition(outboundPayload);
    const workflowGateHash = this.productDefinitionHashService.hashDefinition({
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_no,
      workflowRevision,
      quotationStage,
      approvalStatus,
      paymentStatus,
      submissionStatus,
      approvalRequired: quotation.requires_approval,
      paymentRequired: quotation.requires_payment,
      finalizationHash,
      completedAt,
    });

    return {
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_no,
      workflowRevision,
      quotationStage,
      approvalStatus,
      paymentStatus,
      submissionStatus,
      paymentRequired: quotation.requires_payment,
      approvalRequired: quotation.requires_approval,
      finalizationHash,
      workflowGateHash,
      completedAt,
    };
  }

  private async buildServiceFinanceContext(
    companyId: string,
    quotation: Quotation,
  ): Promise<ServiceFinanceContext | undefined> {
    const invoice = await this.findLatestInvoice(companyId, quotation.id);
    const latestReceipt = invoice?.id
      ? await this.dataSource
          .getRepository(Receipt)
          .createQueryBuilder('receipt')
          .where('receipt.company_id = :companyId', { companyId })
          .andWhere('receipt.invoice_id = :invoiceId', {
            invoiceId: invoice.id,
          })
          .andWhere('receipt.deleted_at IS NULL')
          .orderBy('receipt.created_at', 'DESC')
          .getOne()
      : null;

    const commissionAccrual = await this.dataSource
      .getRepository(CommissionTransaction)
      .createQueryBuilder('commission')
      .where('commission.company_id = :companyId', { companyId })
      .andWhere('commission.quotation_id = :quotationId', {
        quotationId: quotation.id,
      })
      .andWhere('commission.deleted_at IS NULL')
      .orderBy('commission.created_at', 'DESC')
      .getOne();

    const requiredAmount = this.numeric(
      invoice?.total_amount ??
        quotation.cover_note?.total_premium_including_tax ??
        0,
      4,
    );
    const allocatedAmount = this.numeric(invoice?.paid_amount ?? 0, 4);
    const balanceAmount = this.numeric(
      invoice?.balance_amount ??
        quotation.cover_note?.total_premium_including_tax ??
        0,
      4,
    );
    const currencyCode =
      invoice?.currency ??
      quotation.cover_note?.currency_code?.trim().toUpperCase() ??
      'TZS';

    return {
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoice_no ?? null,
      invoiceStatus: invoice?.status ?? null,
      requiredAmount,
      allocatedAmount,
      balanceAmount,
      currencyCode,
      latestReceiptId: latestReceipt?.id ?? null,
      latestReceiptNumber: latestReceipt?.receipt_no ?? null,
      paymentGateHash: this.productDefinitionHashService.hashDefinition({
        invoiceId: invoice?.id ?? null,
        invoiceStatus: invoice?.status ?? null,
        requiredAmount,
        allocatedAmount,
        balanceAmount,
        paymentStatus: quotation.payment_status_v2,
        workflowRevision: quotation.workflow_revision,
      }),
      commissionRate: commissionAccrual?.commission_rate ?? null,
      commissionAmount: commissionAccrual?.commission_amount ?? null,
      commissionAccrualId: commissionAccrual?.id ?? null,
    };
  }

  private mapQuotationStageForGate(
    quotation: Quotation,
    submitOptions: SubmitQuotationDto,
  ): QuotationStage {
    if (quotation.status === QuotationStatus.CANCELLED) {
      return QuotationStage.CANCELLED;
    }

    if (quotation.status === QuotationStatus.EXPIRED) {
      return QuotationStage.EXPIRED;
    }

    if (
      quotation.status === QuotationStatus.SUBMITTING_TO_TIRA ||
      quotation.status === QuotationStatus.TIRA_PROCESSING ||
      quotation.tira_status === TiraStatus.SUBMITTING ||
      quotation.tira_status === TiraStatus.PROCESSING
    ) {
      return QuotationStage.SUBMISSION_PROCESSING;
    }

    if (
      quotation.status === QuotationStatus.SUBMITTED_TO_TIRA ||
      quotation.tira_status === TiraStatus.SUBMITTED ||
      this.isAcceptedTiraStatus(quotation.tira_status)
    ) {
      return QuotationStage.SUBMITTED;
    }

    if (
      quotation.status === QuotationStatus.READY_FOR_SUBMISSION ||
      (submitOptions.force_resubmit === true &&
        quotation.status === QuotationStatus.FAILED &&
        quotation.tira_status === TiraStatus.FAILED)
    ) {
      return QuotationStage.COMPLETED;
    }

    return QuotationStage.DRAFT;
  }

  private isAcceptedTiraStatus(status: TiraStatus): boolean {
    return [
      TiraStatus.SUCCESS,
      TiraStatus.ENDORSED,
      TiraStatus.CANCELLED,
    ].includes(status);
  }

  private mapApprovalStatusForGate(
    quotation: Quotation,
  ): QuotationApprovalStatus {
    switch (quotation.approval_status) {
      case ApprovalStatus.NOT_REQUIRED:
        return QuotationApprovalStatus.NOT_REQUIRED;
      case ApprovalStatus.PENDING:
        return QuotationApprovalStatus.PENDING;
      case ApprovalStatus.APPROVED:
        return QuotationApprovalStatus.APPROVED;
      case ApprovalStatus.CHANGES_REQUESTED:
        return QuotationApprovalStatus.CHANGES_REQUESTED;
      case ApprovalStatus.REJECTED:
        return QuotationApprovalStatus.REJECTED;
      case ApprovalStatus.CANCELLED:
        return QuotationApprovalStatus.CANCELLED;
      case ApprovalStatus.NOT_SUBMITTED:
      default:
        return QuotationApprovalStatus.NOT_EVALUATED;
    }
  }

  private mapPaymentStatusForGate(
    quotation: Quotation,
  ): QuotationPaymentStatus {
    switch (quotation.payment_status) {
      case PaymentStatus.NOT_REQUIRED:
        return QuotationPaymentStatus.NOT_REQUIRED;
      case PaymentStatus.REQUESTED:
        return QuotationPaymentStatus.REQUESTED;
      case PaymentStatus.PROCESSING:
        return QuotationPaymentStatus.PROCESSING;
      case PaymentStatus.PARTIALLY_PAID:
        return QuotationPaymentStatus.PARTIAL;
      case PaymentStatus.PAID:
        return QuotationPaymentStatus.PAID;
      case PaymentStatus.FAILED:
      case PaymentStatus.EXPIRED:
        return QuotationPaymentStatus.FAILED;
      case PaymentStatus.REFUNDED:
        return QuotationPaymentStatus.REFUNDED;
      case PaymentStatus.CANCELLED:
        return QuotationPaymentStatus.CANCELLED;
      case PaymentStatus.NOT_INITIATED:
      default:
        return QuotationPaymentStatus.NOT_REQUESTED;
    }
  }

  private mapSubmissionStatusForGate(
    quotation: Quotation,
    submitOptions: SubmitQuotationDto,
  ): QuotationSubmissionStatus {
    switch (quotation.tira_status) {
      case TiraStatus.SUBMITTING:
        return QuotationSubmissionStatus.PROCESSING;
      case TiraStatus.SUBMITTED:
        return QuotationSubmissionStatus.ACKNOWLEDGED;
      case TiraStatus.PROCESSING:
        return QuotationSubmissionStatus.PROCESSING;
      case TiraStatus.SUCCESS:
      case TiraStatus.ENDORSED:
      case TiraStatus.CANCELLED:
        return QuotationSubmissionStatus.ACCEPTED;
      case TiraStatus.REJECTED:
        return QuotationSubmissionStatus.REJECTED;
      case TiraStatus.FAILED:
        return submitOptions.force_resubmit
          ? QuotationSubmissionStatus.RETRYABLE
          : QuotationSubmissionStatus.FAILED;
      case TiraStatus.NOT_SUBMITTED:
      default:
        return quotation.status === QuotationStatus.READY_FOR_SUBMISSION
          ? QuotationSubmissionStatus.READY
          : QuotationSubmissionStatus.NOT_READY;
    }
  }

  private buildTiramisPolicyHolderManifest(
    outboundPayload: Record<string, unknown>,
  ): Array<Record<string, string | number | null>> {
    const policyHolders = Array.isArray(outboundPayload.policyHolders)
      ? outboundPayload.policyHolders
      : [];

    return policyHolders
      .map((holder) => {
        const record = holder as Record<string, unknown>;

        return {
          policyHolderName: String(record.policyHolderName ?? '').trim(),
          policyHolderBirthDate: record.policyHolderBirthDate
            ? this.formatTiramisDate(record.policyHolderBirthDate)
            : null,
          policyHolderType: Number(record.policyHolderType),
          policyHolderIdNumber: String(record.policyHolderIdNumber ?? '')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase(),
          policyHolderIdType: Number(record.policyHolderIdType),
          phoneNumber: String(record.phoneNumber ?? '').replace(/[\s()-]/g, ''),
          email:
            (record.email ?? record.emailAddress ?? null)
              ?.toString()
              .trim()
              .toLowerCase() ?? null,
        };
      })
      .sort((left, right) =>
        String(left.policyHolderIdNumber).localeCompare(
          String(right.policyHolderIdNumber),
        ),
      );
  }

  private buildTiramisAssetManifest(
    outboundPayload: Record<string, unknown>,
  ): Array<Record<string, string | number | null>> {
    const fleet = outboundPayload.fleet as
      | {
          items?: unknown[];
        }
      | undefined;

    if (Array.isArray(fleet?.items)) {
      return fleet.items
        .map((item) =>
          this.mapTiramisMotorManifestItem(
            ((item as Record<string, unknown>).motorDetail ?? {}) as Record<
              string,
              unknown
            >,
          ),
        )
        .sort((left, right) =>
          String(
            left.registrationNumber ?? left.chassisNumber ?? '',
          ).localeCompare(
            String(right.registrationNumber ?? right.chassisNumber ?? ''),
          ),
        );
    }

    if (outboundPayload.motorDetail) {
      return [
        this.mapTiramisMotorManifestItem(
          outboundPayload.motorDetail as Record<string, unknown>,
        ),
      ];
    }

    const subjectMatters = Array.isArray(outboundPayload.subjectMatters)
      ? outboundPayload.subjectMatters
      : [];

    return subjectMatters
      .map((subject) => {
        const record = subject as Record<string, unknown>;

        return {
          reference: String(record.subjectMatterReference ?? '')
            .trim()
            .toUpperCase(),
          description: String(record.subjectMatterDesc ?? '').trim(),
        };
      })
      .sort((left, right) =>
        String(left.reference).localeCompare(String(right.reference)),
      );
  }

  private mapTiramisMotorManifestItem(
    motor: Record<string, unknown>,
  ): Record<string, string | number | null> {
    return {
      registrationNumber: this.normalizeTiramisMotorField(
        motor.registrationNumber,
      ),
      chassisNumber: this.normalizeTiramisMotorField(motor.chassisNumber),
      engineNumber: this.normalizeTiramisMotorField(motor.engineNumber),
      make: motor.make?.toString().trim() ?? null,
      model: motor.model?.toString().trim() ?? null,
      yearOfManufacture: motor.yearOfManufacture
        ? Number(motor.yearOfManufacture)
        : null,
      ownerName: motor.ownerName?.toString().trim() ?? null,
    };
  }

  private normalizeTiramisMotorField(value: unknown): string | null {
    const normalized = String(value ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();

    return normalized || null;
  }

  private formatTiramisDate(value: unknown): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }

    return new Date(value as string | number | Date).toISOString().slice(0, 10);
  }

  private async assertPricingSnapshotsCurrent(
    companyId: string,
    quotation: Quotation,
  ): Promise<void> {
    const pricingQuoteIds = [
      ...new Set(
        (quotation.cover_note?.entries ?? [])
          .flatMap((entry) => entry.risks ?? [])
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
    const pricingQuoteById = new Map(
      pricingQuotes.map((quote) => [quote.pricing_quote_id, quote]),
    );

    for (const entry of quotation.cover_note?.entries ?? []) {
      for (const risk of entry.risks ?? []) {
        const snapshot =
          risk.pricing_snapshot as unknown as PricingResultSnapshot | null;
        const pricingQuoteId = risk.pricing_quote_id?.trim();
        if (!snapshot?.inputHash || !pricingQuoteId) {
          continue;
        }

        const pricingQuote = pricingQuoteById.get(pricingQuoteId);
        if (
          !pricingQuote ||
          pricingQuote.expires_at.getTime() < Date.now() ||
          pricingQuote.input_signature !== snapshot.inputHash
        ) {
          throw new ConflictException({
            code: 'QUOTATION_PRICING_STALE',
            message: 'Quotation information changed after premium calculation.',
            details: { action: 'RECALCULATE_PREMIUM' },
          });
        }

        if (
          quotation.product_version_id &&
          pricingQuote.product_version_id &&
          pricingQuote.product_version_id !== quotation.product_version_id
        ) {
          throw new ConflictException({
            code: 'QUOTATION_PRICING_STALE',
            message: 'Quotation information changed after premium calculation.',
            details: { action: 'RECALCULATE_PREMIUM' },
          });
        }
      }
    }
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
      await this.ensureCashInvoiceSettledForSubmission(
        companyId,
        quotation,
        submitOptions,
        userId,
      );

      this.assertTiraSubmissionReadiness(quotation, submitOptions);

      if (quotation.requires_payment) {
        await this.assertPaymentReady(quotation);
      }

      await this.assertProductSnapshotIntegrity(companyId, quotation);

      const tiramisContext = await this.resolveStoredTiramisContext(
        companyId,
        quotation,
      );
      await this.correctPersistedQuotationCoverPeriod(quotation);
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
      quotation.payment_status === PaymentStatus.PAID ||
      this.isCashPaymentMode(quotation);
    if (!paymentSatisfied) {
      throw new ConflictException(
        `Quotation payment is not complete. Current payment status is ${quotation.payment_status}.`,
      );
    }

    const readyForInitialSubmission =
      (quotation.status === QuotationStatus.READY_FOR_SUBMISSION ||
        (this.isCashPaymentMode(quotation) &&
          approvalSatisfied &&
          quotation.status === QuotationStatus.PENDING_REQUIREMENTS)) &&
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
    const coverStartDate =
      this.extractDateOnly(header.cover_note_start_date) ?? undefined;
    const coverEndDate =
      this.extractDateOnly(header.cover_note_end_date) ?? undefined;

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
            cover_start_date: coverStartDate,
            cover_end_date: coverEndDate,
            quotation_type: payload.internal_quotation.quotation_type,
            currency_code: header.currency_code,
            exchange_rate: header.exchange_rate,
            discount: this.buildPricingDiscountRequest(risk),
            tax_codes: this.selectedTaxCodes(risk),
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
              payload.cover_note_dtl.fleet_hdr?.policy_holders?.[0] ?? null,
              entry.motor_dtl,
              risk.sum_insured,
              includeSumInsured,
            ),
            effective_date: effectiveDate,
            cover_start_date: coverStartDate,
            cover_end_date: coverEndDate,
            quotation_type: payload.internal_quotation.quotation_type,
            currency_code: header.currency_code,
            exchange_rate: header.exchange_rate,
            discount: this.buildPricingDiscountRequest(risk),
            tax_codes: this.selectedTaxCodes(risk),
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

  private selectedTaxCodes(risk: RiskCoveredDto): string[] {
    return [
      ...new Set(
        (risk.taxes_charged ?? [])
          .filter((tax) => tax.is_tax_exempted !== 'Y')
          .map((tax) => tax.tax_code.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
  }

  private buildPricingDiscountRequest(
    risk: RiskCoveredDto,
  ): { rate?: number; fixed_amount?: number } | undefined {
    const discounts = risk.discounts_offered ?? [];
    const rate = roundMoney(
      discounts.reduce(
        (sum, discount) => sum + Math.max(0, discount.discount_rate ?? 0),
        0,
      ),
    );

    if (rate > 0) {
      return { rate };
    }

    const fixedAmount = roundMoney(
      discounts.reduce(
        (sum, discount) => sum + Math.max(0, discount.discount_amount ?? 0),
        0,
      ),
    );

    return fixedAmount > 0 ? { fixed_amount: fixedAmount } : undefined;
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

  private async applyDefaultTaxesToQuotationPayload(
    companyId: string,
    payload: CreateQuotationDto,
    user: Pick<AuthenticatedUser, 'id'>,
    quotationId?: string,
    quotationNo?: string,
  ): Promise<void> {
    const activeTaxes = await this.taxesService.list(companyId, true);
    const defaultTax = activeTaxes.find((tax) => tax.is_default);
    const taxByCode = new Map(
      activeTaxes.map((tax) => [tax.tax_code.trim().toUpperCase(), tax]),
    );

    for (const entry of this.resolveEntries(payload)) {
      for (const risk of entry.risks_covered) {
        risk.taxes_charged = this.applyDefaultTaxRows(
          risk.taxes_charged,
          defaultTax,
          risk.premium_after_discount,
        );
      }

      for (const addon of entry.cover_note_addons) {
        addon.taxes_charged = this.applyDefaultTaxRows(
          addon.taxes_charged,
          defaultTax,
          addon.premium_excluding_tax_equivalent ||
            addon.premium_excluding_tax ||
            addon.addon_amount,
        );
        await this.recalculateAddonTaxes(
          companyId,
          addon,
          taxByCode,
          user,
          quotationId,
          quotationNo,
        );
      }
    }
  }

  private async withDefaultTaxesForDraftPayload(
    companyId: string,
    draftPayload: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const payload = this.cloneDraftPayload(draftPayload);
    const activeTaxes = await this.taxesService.list(companyId, true);
    const defaultTax = activeTaxes.find((tax) => tax.is_default);
    if (!defaultTax) return payload;

    const applyToRisk = (risk: Record<string, unknown>) => {
      const rows = Array.isArray(risk.taxes_charged)
        ? (risk.taxes_charged as Record<string, unknown>[])
        : [];
      risk.taxes_charged = this.applyDefaultTaxRows(
        rows as unknown as TaxChargedDto[],
        defaultTax,
        Number(risk.premium_after_discount ?? 0),
        true,
      );
    };
    const applyToAddon = (addon: Record<string, unknown>) => {
      const rows = Array.isArray(addon.taxes)
        ? (addon.taxes as Record<string, unknown>[])
        : Array.isArray(addon.taxes_charged)
          ? (addon.taxes_charged as Record<string, unknown>[])
          : [];
      const nextRows = this.applyDefaultTaxRows(
        rows as unknown as TaxChargedDto[],
        defaultTax,
        Number(
          addon.premium_excluding_tax_equivalent ??
            addon.premium_excluding_tax ??
            addon.addon_amount ??
            0,
        ),
        true,
      );
      if (Array.isArray(addon.taxes)) {
        addon.taxes = nextRows;
      } else if (Array.isArray(addon.taxes_charged)) {
        addon.taxes_charged = nextRows;
      }
    };

    for (const risk of this.draftArray(payload, 'risks')) {
      applyToRisk(risk);
    }
    for (const addon of this.draftArray(payload, 'addons')) {
      applyToAddon(addon);
    }
    const fleet = this.draftObject(payload, 'fleet');
    for (const item of this.draftArray(fleet, 'items')) {
      for (const risk of this.draftArray(item, 'risks_covered')) {
        applyToRisk(risk);
      }
      for (const addon of this.draftArray(item, 'cover_note_addons')) {
        applyToAddon(addon);
      }
    }

    return payload;
  }

  private applyDefaultTaxRows(
    rows: TaxChargedDto[] | null | undefined,
    defaultTax: Tax | undefined,
    taxableAmount: NumericValue,
    useBooleanExemptionFlag = false,
  ): TaxChargedDto[] {
    const current = Array.isArray(rows) ? rows : [];
    if (
      current.some((tax) => tax.tax_code?.trim()) ||
      current.some((tax) => tax.is_tax_exempted === 'Y' && tax.tax_code?.trim())
    ) {
      return current;
    }
    if (!defaultTax) {
      throw new BadRequestException(
        'No active default tax is configured. Configure a default tax before saving taxable quotation items.',
      );
    }

    const rate = Number(defaultTax.tax_rate);
    const amount = roundMoney(Number(this.numeric(taxableAmount, 4)) * rate);

    return [
      {
        tax_code: defaultTax.tax_code.trim().toUpperCase(),
        is_tax_exempted: (useBooleanExemptionFlag ? false : 'N') as unknown as
          | 'Y'
          | 'N',
        tax_exemption_type: null,
        tax_exemption_reference: null,
        tax_rate: rate,
        tax_amount: amount,
      },
    ];
  }

  private async recalculateAddonTaxes(
    companyId: string,
    addon: CoverNoteAddonDto,
    taxByCode: Map<string, Tax>,
    user: Pick<AuthenticatedUser, 'id'>,
    quotationId?: string,
    quotationNo?: string,
  ): Promise<void> {
    const baseAmount = roundMoney(
      this.firstNumber(
        addon.premium_excluding_tax_equivalent,
        addon.premium_excluding_tax,
        addon.addon_amount,
        0,
      ) ?? 0,
    );
    const seenCodes = new Set<string>();

    addon.taxes_charged = await Promise.all(
      (addon.taxes_charged ?? []).map(async (tax) => {
        const code = tax.tax_code.trim().toUpperCase();
        if (!code) return tax;
        if (seenCodes.has(code)) {
          throw new BadRequestException(
            'Tax ' +
              code +
              ' is selected more than once on add-on ' +
              addon.addon_reference,
          );
        }
        seenCodes.add(code);

        const configuredTax = taxByCode.get(code);
        if (!configuredTax) {
          await this.auditService.log({
            userId: user.id,
            companyId,
            action: 'quotation.tax_selection.rejected',
            resource: 'quotation',
            resourceId: quotationId,
            status: 'failure',
            metadata: {
              quotationNo: quotationNo ?? null,
              addonReference: addon.addon_reference,
              taxCode: code,
              reason: 'Selected add-on tax is not active in the tax catalogue',
            },
          });
          throw new BadRequestException(
            'Tax ' +
              code +
              ' is unavailable. Select an active tax from the tax catalogue.',
          );
        }

        const exempted = tax.is_tax_exempted === 'Y';
        const rate = Number(configuredTax.tax_rate);
        return {
          ...tax,
          tax_code: code,
          tax_rate: rate,
          tax_amount: exempted ? 0 : roundMoney(baseAmount * rate),
          tax_exemption_type: exempted ? tax.tax_exemption_type : null,
          tax_exemption_reference: exempted
            ? tax.tax_exemption_reference
            : null,
        };
      }),
    );

    const totalTax = roundMoney(
      addon.taxes_charged.reduce((sum, tax) => sum + tax.tax_amount, 0),
    );
    addon.premium_excluding_tax = roundMoney(
      this.firstNumber(addon.premium_excluding_tax, baseAmount) ?? baseAmount,
    );
    addon.premium_excluding_tax_equivalent = baseAmount;
    addon.premium_including_tax = roundMoney(baseAmount + totalTax);
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
        tax_codes: (context.risk.taxes_charged ?? []).map(
          (tax) => tax.tax_code,
        ),
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
    const chargesByCode = new Map(
      chargeSummary.charges.map((charge) => [charge.charge_code, charge]),
    );
    const seenCodes = new Set<string>();
    context.risk.taxes_charged = (context.risk.taxes_charged ?? []).map(
      (tax) => {
        const code = tax.tax_code.trim().toUpperCase();
        if (seenCodes.has(code))
          throw new BadRequestException(
            'Tax ' +
              code +
              ' is selected more than once on risk ' +
              context.risk.risk_code,
          );
        seenCodes.add(code);
        const charge = chargesByCode.get(code);
        if (!charge)
          throw new BadRequestException('Tax ' + code + ' is unavailable');
        const exempted = tax.is_tax_exempted === 'Y';
        return {
          ...tax,
          tax_code: code,
          tax_rate: charge.rate ?? 0,
          tax_amount: exempted ? 0 : charge.computed_amount,
          tax_exemption_type: exempted ? tax.tax_exemption_type : null,
          tax_exemption_reference: exempted
            ? tax.tax_exemption_reference
            : null,
        };
      },
    );
    const totalTaxAmount = roundMoney(
      context.risk.taxes_charged.reduce((sum, tax) => sum + tax.tax_amount, 0),
    );
    const signedTaxAmount = this.readPricingQuoteNumber(context.quote, [
      'total_charge_amount',
      'total_tax_amount',
      'tax_amount',
    ]);
    if (
      signedTaxAmount !== null &&
      !this.moneyEqual(signedTaxAmount, totalTaxAmount)
    ) {
      throw new BadRequestException(
        'Selected taxes or tax rates have changed. Recalculate the premium before saving.',
      );
    }
    context.risk.premium_after_discount = premiumExcludingTaxEquivalent;
    context.risk.premium_excluding_tax_equivalent =
      premiumExcludingTaxEquivalent;
    context.risk.premium_including_tax = roundMoney(
      premiumExcludingTaxEquivalent + totalTaxAmount,
    );
  }

  private readPricingQuoteNumber(
    quote: PricingQuote,
    keys: string[],
  ): number | null {
    const payload = quote.result_payload || {};

    for (const key of keys) {
      const value = payload[key];
      const parsed = this.toStoredNumber(value);

      if (parsed !== null) {
        return roundMoney(parsed);
      }
    }

    return null;
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

    if (typeof value === 'string') {
      const isoDateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(value);
      if (isoDateMatch) {
        return isoDateMatch[1];
      }
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

  private assertWorkflowPermission(
    user: Pick<AuthenticatedUser, 'permissions'> | null | undefined,
    permissions: string | readonly string[],
  ): void {
    const requiredPermissions = Array.isArray(permissions)
      ? permissions
      : [permissions];

    if (
      requiredPermissions.some((permission) =>
        this.hasPermission(user, permission),
      )
    ) {
      return;
    }

    throw new ForbiddenException(
      `Missing required permission: ${requiredPermissions.join(' or ')}`,
    );
  }

  private assertTransitionPermission(
    user: Pick<AuthenticatedUser, 'permissions'> | null | undefined,
    action: QuotationStatusTransitionAction,
  ): void {
    const requiredPermissions = this.requiredPermissionsForTransition(action);

    if (requiredPermissions.length === 0) {
      return;
    }

    this.assertWorkflowPermission(user, requiredPermissions);
  }

  private requiredPermissionsForTransition(
    action: QuotationStatusTransitionAction,
  ): readonly string[] {
    switch (action) {
      case QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS:
        return [QUOTATION_COMPLETE_PERMISSION];
      case QuotationStatusTransitionAction.SUBMIT_FOR_APPROVAL:
        return [QUOTATION_SUBMIT_APPROVAL_PERMISSION];
      case QuotationStatusTransitionAction.APPROVE:
        return QUOTATION_APPROVE_PERMISSIONS;
      case QuotationStatusTransitionAction.REQUEST_CHANGES:
        return [QUOTATION_REQUEST_CHANGES_PERMISSION];
      case QuotationStatusTransitionAction.REJECT_APPROVAL:
        return [QUOTATION_REJECT_PERMISSION];
      case QuotationStatusTransitionAction.MARK_PAYMENT_REQUESTED:
        return [QUOTATION_REQUEST_PAYMENT_PERMISSION];
      case QuotationStatusTransitionAction.CANCEL:
        return [QUOTATION_CANCEL_PERMISSION];
      default:
        return [];
    }
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

  private async buildWorkflowView(
    quotation: Quotation,
    companyId: string,
    user?: Pick<AuthenticatedUser, 'permissions'> | null,
  ): Promise<QuotationWorkflowView> {
    const quotationStage =
      quotation.quotation_stage ?? this.mapQuotationStageForGate(quotation, {});
    const approvalStatus =
      quotation.approval_status_v2 ?? this.mapApprovalStatusForGate(quotation);
    const cashPaymentMode = this.isCashPaymentMode(quotation);
    const approvalSatisfiedForWorkflow =
      !quotation.requires_approval ||
      quotation.approval_status === ApprovalStatus.APPROVED;
    const paymentStatus = cashPaymentMode
      ? QuotationPaymentStatus.PAID
      : (quotation.payment_status_v2 ??
        this.mapPaymentStatusForGate(quotation));
    const submissionStatus =
      quotation.submission_status_v2 ??
      (cashPaymentMode &&
      quotation.tira_status === TiraStatus.NOT_SUBMITTED &&
      approvalSatisfiedForWorkflow &&
      [
        QuotationStatus.READY_FOR_SUBMISSION,
        QuotationStatus.PENDING_REQUIREMENTS,
      ].includes(quotation.status)
        ? QuotationSubmissionStatus.READY
        : this.mapSubmissionStatusForGate(quotation, {}));

    const pricingIntegration = this.canViewPricingBreakdown(user)
      ? await this.evaluateQuotationPricingIntegration(companyId, quotation)
      : null;
    const blockingReasons = new Map<string, QuotationBlockingReason>();
    const availableCommands: Partial<Record<QuotationCommand, boolean>> = {};

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.SAVE_DRAFT,
      this.hasPermission(user, 'quotations:update') &&
        this.isDraftWritableForWorkflow(quotation),
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.SAVE_AND_CONTINUE,
      this.hasPermission(user, 'quotations:update') &&
        this.isDraftWritableForWorkflow(quotation),
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.COMPLETE,
      this.hasPermission(user, QUOTATION_COMPLETE_PERMISSION) &&
        this.isDraftWritableForWorkflow(quotation) &&
        !(pricingIntegration?.is_stale ?? false),
      pricingIntegration?.is_stale
        ? {
            code: 'QUOTATION_PRICING_STALE',
            message:
              'Pricing information is no longer current. Recalculate before continuing.',
            field: 'pricing',
          }
        : !this.isDraftWritableForWorkflow(quotation)
          ? {
              code: 'QUOTATION_NOT_DRAFT',
              message: 'Only draft quotations can be completed.',
              field: 'quotation_status',
            }
          : undefined,
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.SUBMIT_APPROVAL,
      this.hasPermission(user, QUOTATION_SUBMIT_APPROVAL_PERMISSION) &&
        quotation.requires_approval &&
        quotation.status !== QuotationStatus.DRAFT &&
        [
          ApprovalStatus.NOT_SUBMITTED,
          ApprovalStatus.CHANGES_REQUESTED,
        ].includes(quotation.approval_status),
      !quotation.requires_approval
        ? {
            code: 'QUOTATION_APPROVAL_NOT_REQUIRED',
            message: 'Approval is not required for this quotation.',
            field: 'approval',
          }
        : quotation.status === QuotationStatus.DRAFT
          ? {
              code: 'QUOTATION_INCOMPLETE',
              message:
                'Complete the quotation before submitting it for approval.',
              field: 'quotation_status',
            }
          : undefined,
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.APPROVE,
      this.canApproveQuotationWorkflow(user) &&
        quotation.approval_status === ApprovalStatus.PENDING,
      quotation.approval_status !== ApprovalStatus.PENDING
        ? {
            code: 'QUOTATION_APPROVAL_NOT_PENDING',
            message: `Approval cannot be completed from ${quotation.approval_status}.`,
            field: 'approval',
          }
        : undefined,
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.REQUEST_CHANGES,
      this.hasPermission(user, QUOTATION_REQUEST_CHANGES_PERMISSION) &&
        quotation.approval_status === ApprovalStatus.PENDING,
      quotation.approval_status !== ApprovalStatus.PENDING
        ? {
            code: 'QUOTATION_APPROVAL_NOT_PENDING',
            message: `Changes cannot be requested from ${quotation.approval_status}.`,
            field: 'approval',
          }
        : undefined,
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.REJECT,
      this.hasPermission(user, QUOTATION_REJECT_PERMISSION) &&
        quotation.approval_status === ApprovalStatus.PENDING,
      quotation.approval_status !== ApprovalStatus.PENDING
        ? {
            code: 'QUOTATION_APPROVAL_NOT_PENDING',
            message: `Approval cannot be rejected from ${quotation.approval_status}.`,
            field: 'approval',
          }
        : undefined,
    );

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.REQUEST_PAYMENT,
      this.hasPermission(user, QUOTATION_REQUEST_PAYMENT_PERMISSION),
      await this.getWorkflowValidationReason(async () =>
        this.assertPaymentRequestAllowed(quotation),
      ),
    );

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.SUBMIT_TIRAMIS,
      this.hasPermission(user, QUOTATION_SUBMIT_TIRAMIS_PERMISSION),
      await this.getWorkflowValidationReason(async () => {
        await this.assertPricingSnapshotsCurrent(companyId, quotation);
        this.assertTiraSubmissionReadiness(quotation, {});
      }),
    );

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.RETRY_TIRAMIS,
      this.hasPermission(user, QUOTATION_RETRY_TIRAMIS_PERMISSION),
      await this.getWorkflowValidationReason(async () => {
        await this.assertPricingSnapshotsCurrent(companyId, quotation);
        this.assertTiraSubmissionReadiness(quotation, {
          force_resubmit: true,
        });
      }),
    );

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.CANCEL,
      this.hasPermission(user, QUOTATION_CANCEL_PERMISSION),
      await this.getWorkflowValidationReason(async () => {
        if (this.isTerminalQuotationStatusForWorkflow(quotation.status)) {
          throw new ConflictException(
            `Quotation cannot be cancelled from ${quotation.status}`,
          );
        }

        if (quotation.tira_status !== TiraStatus.NOT_SUBMITTED) {
          throw new ConflictException(
            'Quotation cannot be cancelled after TIRAMIS submission has started',
          );
        }
      }),
    );

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.DELETE,
      this.hasPermission(user, QUOTATION_DELETE_DRAFT_PERMISSION),
      await this.getWorkflowValidationReason(async () =>
        this.assertDraftDeletionAllowed(companyId, quotation),
      ),
    );

    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.REFRESH_CUSTOMER,
      this.hasPermission(user, 'customers:update') &&
        quotation.status === QuotationStatus.DRAFT,
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.REFRESH_ASSET,
      this.hasPermission(user, 'motor:update') &&
        quotation.status === QuotationStatus.DRAFT,
    );
    this.setWorkflowCommandAvailability(
      availableCommands,
      blockingReasons,
      QuotationCommand.RECALCULATE,
      this.hasPermission(user, 'quotations:update') &&
        (pricingIntegration?.is_stale ?? false),
      !(pricingIntegration?.is_stale ?? false)
        ? {
            code: 'QUOTATION_PRICING_CURRENT',
            message: 'Pricing is already current for this quotation.',
            field: 'pricing',
          }
        : undefined,
    );

    return {
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_no,
      workflowRevision: Number(quotation.workflow_revision ?? 1),
      quotationStage,
      approval: {
        required: quotation.requires_approval,
        status: approvalStatus,
        assignedToUserId: null,
        submittedAt: quotation.approval_submitted_at?.toISOString() ?? null,
        decidedAt: quotation.approval_decided_at?.toISOString() ?? null,
        comments: quotation.approval_comments ?? null,
        reason: quotation.approval_reason ?? null,
      },
      payment: {
        required: cashPaymentMode ? false : quotation.requires_payment,
        status: paymentStatus,
        mode: null,
        reference: quotation.payment_request_reference ?? null,
        requestedAt: quotation.payment_requested_at?.toISOString() ?? null,
        completedAt: quotation.payment_completed_at?.toISOString() ?? null,
        failureReason: quotation.payment_failure_reason ?? null,
      },
      submission: {
        status: submissionStatus,
        requestId: quotation.tira_request_id ?? null,
        responseId: quotation.tira_response_id ?? null,
        submittedAt: quotation.submitted_at?.toISOString() ?? null,
        acknowledgedAt: null,
        acceptedAt: this.isAcceptedTiraStatus(quotation.tira_status)
          ? (quotation.updated_at?.toISOString() ?? null)
          : null,
        failureReason: quotation.tira_response_description ?? null,
      },
      finalizationHash: quotation.finalization_hash ?? null,
      workflowGateHash: quotation.workflow_gate_hash ?? null,
      completedAt: quotation.workflow_completed_at?.toISOString() ?? null,
      blockingReasons: [...blockingReasons.values()],
      availableCommands,
    };
  }

  private setWorkflowCommandAvailability(
    availableCommands: Partial<Record<QuotationCommand, boolean>>,
    blockingReasons: Map<string, QuotationBlockingReason>,
    command: QuotationCommand,
    hasPermission: boolean,
    blockingReason?: QuotationBlockingReason | null,
  ): void {
    const isAvailable = hasPermission && !blockingReason;
    availableCommands[command] = isAvailable;

    if (!isAvailable && blockingReason) {
      blockingReasons.set(`${command}:${blockingReason.code}`, blockingReason);
    }
  }

  private async getWorkflowValidationReason(
    validator: () => void | Promise<void>,
  ): Promise<QuotationBlockingReason | null> {
    try {
      await validator();
      return null;
    } catch (error) {
      return this.toWorkflowBlockingReason(error);
    }
  }

  private toWorkflowBlockingReason(error: unknown): QuotationBlockingReason {
    const response =
      error &&
      typeof error === 'object' &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object'
        ? ((error as { response?: Record<string, unknown> }).response ?? null)
        : null;

    if (response) {
      return {
        code:
          typeof response.code === 'string'
            ? response.code
            : 'QUOTATION_WORKFLOW_BLOCKED',
        message:
          typeof response.message === 'string'
            ? response.message
            : this.readErrorMessage(error),
        field: typeof response.field === 'string' ? response.field : undefined,
      };
    }

    return {
      code: 'QUOTATION_WORKFLOW_BLOCKED',
      message: this.readErrorMessage(error),
    };
  }

  private canApproveQuotationWorkflow(
    user: Pick<AuthenticatedUser, 'permissions'> | null | undefined,
  ): boolean {
    return QUOTATION_APPROVE_PERMISSIONS.some((permission) =>
      this.hasPermission(user, permission),
    );
  }

  private isDraftWritableForWorkflow(quotation: Quotation): boolean {
    return (
      quotation.status === QuotationStatus.DRAFT &&
      quotation.tira_status === TiraStatus.NOT_SUBMITTED
    );
  }

  private isTerminalQuotationStatusForWorkflow(
    status: QuotationStatus,
  ): boolean {
    return [
      QuotationStatus.COMPLETED,
      QuotationStatus.REJECTED,
      QuotationStatus.FAILED,
      QuotationStatus.CANCELLED,
      QuotationStatus.EXPIRED,
    ].includes(status);
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

  private buildFailedCorrectionAuditState(
    quotation: Quotation,
  ): Record<string, unknown> {
    return {
      quotationId: quotation.id,
      quotationNo: quotation.quotation_no,
      branchId: quotation.branch_id,
      originalCreatorId: quotation.created_by,
      quotationStatus: quotation.status,
      tiraStatus: quotation.tira_status,
      submittedAt: quotation.submitted_at?.toISOString() ?? null,
      authoritativePayload:
        this.payloadMapper.toAuthoritativePayload(quotation),
    };
  }

  private async logFailedTiraCorrectionAudit(params: {
    companyId: string;
    user: AuthenticatedUser;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }): Promise<void> {
    const originalCreatorId =
      typeof params.before.originalCreatorId === 'string'
        ? params.before.originalCreatorId
        : null;

    if (!originalCreatorId || originalCreatorId === params.user.id) {
      return;
    }

    const beforeTiraStatus =
      typeof params.before.tiraStatus === 'string'
        ? params.before.tiraStatus
        : '';
    const beforeSubmittedAt =
      typeof params.before.submittedAt === 'string'
        ? new Date(params.before.submittedAt)
        : null;

    if (
      !this.isTiraFailureSnapshot({
        submitted_at: beforeSubmittedAt,
        tira_status: beforeTiraStatus,
      })
    ) {
      return;
    }

    const quotationId =
      typeof params.before.quotationId === 'string'
        ? params.before.quotationId
        : undefined;
    const branchId =
      typeof params.before.branchId === 'string'
        ? params.before.branchId
        : (params.user.activeBranchId ?? null);
    const changedFieldPaths = this.diffJsonPaths(
      params.before.authoritativePayload,
      params.after.authoritativePayload,
    );

    await this.auditService.logCritical({
      userId: params.user.id,
      companyId: params.companyId,
      companyMembershipId: params.user.companyMembershipId ?? null,
      branchId,
      action: 'quotation.failed_tira.corrected',
      eventCategory: 'quotation',
      resource: 'quotation',
      resourceId: quotationId,
      beforeState: params.before,
      afterState: params.after,
      metadata: {
        quotationNo: params.before.quotationNo ?? params.after.quotationNo,
        originalCreatorId,
        correctedBy: params.user.id,
        changedFieldPaths,
      },
    });
  }

  private diffJsonPaths(
    before: unknown,
    after: unknown,
    prefix = '',
  ): string[] {
    if (Object.is(before, after)) {
      return [];
    }

    if (
      before === null ||
      after === null ||
      typeof before !== 'object' ||
      typeof after !== 'object'
    ) {
      return [prefix || '$'];
    }

    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = new Set([
      ...Object.keys(beforeRecord),
      ...Object.keys(afterRecord),
    ]);
    const paths: string[] = [];

    for (const key of keys) {
      if (paths.length >= 200) {
        break;
      }

      paths.push(
        ...this.diffJsonPaths(
          beforeRecord[key],
          afterRecord[key],
          prefix ? `${prefix}.${key}` : key,
        ).slice(0, 200 - paths.length),
      );
    }

    return paths;
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
      await this.ensureQuotationCreatedCustomerKycActive(
        manager,
        existingByIdNumber,
        userId,
      );
      return existingByIdNumber.id;
    }

    const existingByPhone = await customerRepository.findOne({
      where: { company_id: companyId, phone: normalizedPhone },
    });
    if (existingByPhone) {
      await this.ensureQuotationCreatedCustomerKycActive(
        manager,
        existingByPhone,
        userId,
      );
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
      kyc_status: CustomerKycStatus.VERIFIED,
      kyc_version: 1,
      kyc_verified_by: userId,
      kyc_verified_at: new Date(),
      kyc_rejection_reason: null,
      document_type: null,
      document_no: null,
      document_file_name: null,
      document_file_url: null,
      document_mime_type: null,
      document_verified: true,
      document_verified_by: userId,
      document_verified_at: new Date(),
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

  private async ensureQuotationCreatedCustomerKycActive(
    manager: EntityManager,
    customer: Customer,
    userId: string,
  ): Promise<void> {
    if (
      customer.kyc_status === CustomerKycStatus.VERIFIED ||
      customer.metadata?.source !== 'quotation'
    ) {
      return;
    }

    customer.kyc_status = CustomerKycStatus.VERIFIED;
    customer.kyc_version = Math.max(Number(customer.kyc_version ?? 0), 1);
    customer.kyc_verified_by = userId;
    customer.kyc_verified_at = new Date();
    customer.kyc_rejection_reason = null;
    customer.document_verified = true;
    customer.document_verified_by = userId;
    customer.document_verified_at = new Date();
    customer.updated_by = userId;

    await manager.getRepository(Customer).save(customer);
  }

  private mergeLifecycleState(
    quotation: Quotation,
    paymentMode: number,
    approvalRequired = quotation.requires_approval,
  ) {
    const requiresPayment = paymentMode != null;
    const requiresApproval = approvalRequired;

    return {
      requires_approval: requiresApproval,
      requires_payment: requiresPayment,
      // Newly required approval starts unsubmitted; an existing approval
      // flow keeps its status.
      approval_status: requiresApproval
        ? quotation.requires_approval
          ? quotation.approval_status
          : ApprovalStatus.NOT_SUBMITTED
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
      .innerJoinAndSelect('assignment.company_user', 'companyUser')
      .innerJoinAndSelect('companyUser.user', 'user')
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

    const officer = this.resolveOfficerDetails(
      assignment.company_user?.user ?? null,
    );

    return this.withResolvedOfficerDetails(
      {
        ...payload,
        internal_quotation: {
          ...payload.internal_quotation,
          branch_id: branch.id,
        },
        cover_note_dtl: {
          ...payload.cover_note_dtl,
          sale_point_code: payload.cover_note_dtl.fleet_hdr
            ? undefined
            : salePoint.salePointCode.trim().toUpperCase(),
          fleet_hdr: payload.cover_note_dtl.fleet_hdr
            ? {
                ...payload.cover_note_dtl.fleet_hdr,
                sale_point_code: salePoint.salePointCode.trim().toUpperCase(),
              }
            : undefined,
        },
      },
      officer,
    );
  }

  private async resolveExistingQuotationContext(
    companyId: string,
    payload: CreateQuotationDto,
    existing: Quotation,
    userId: string,
  ): Promise<CreateQuotationDto> {
    const salePointCode = existing.cover_note?.sale_point_code;
    if (!existing.branch_id || !salePointCode?.trim()) {
      throw new BadRequestException(
        'The quotation branch or sales point code is not configured. Please update the branch configuration before saving this quotation.',
      );
    }

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    const officer = this.resolveOfficerDetails(user);

    return this.withResolvedOfficerDetails(
      {
        ...payload,
        internal_quotation: {
          ...payload.internal_quotation,
          branch_id: existing.branch_id,
        },
        cover_note_dtl: {
          ...payload.cover_note_dtl,
          sale_point_code: payload.cover_note_dtl.fleet_hdr
            ? undefined
            : salePointCode,
          fleet_hdr: payload.cover_note_dtl.fleet_hdr
            ? {
                ...payload.cover_note_dtl.fleet_hdr,
                sale_point_code: salePointCode,
              }
            : undefined,
        },
      },
      officer,
    );
  }

  private resolveOfficerDetails(user: User | null): {
    officer_name: string;
    officer_title: string;
  } {
    const officerName =
      [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
      user?.email?.trim() ||
      'Portal Officer';
    const officerTitle = user?.officer_title?.trim() || 'Underwriter';

    return {
      officer_name: officerName,
      officer_title: officerTitle,
    };
  }

  private withResolvedOfficerDetails(
    payload: CreateQuotationDto,
    officer: { officer_name: string; officer_title: string },
  ): CreateQuotationDto {
    const {
      officer_name: _incomingOfficerName,
      officer_title: _incomingOfficerTitle,
      ...coverNoteDetail
    } = payload.cover_note_dtl;
    const fleetHeader = coverNoteDetail.fleet_hdr;

    return {
      ...payload,
      cover_note_dtl: {
        ...coverNoteDetail,
        ...(fleetHeader
          ? {}
          : {
              officer_name: officer.officer_name,
              officer_title: officer.officer_title,
            }),
        fleet_hdr: fleetHeader
          ? {
              ...fleetHeader,
              officer_name: officer.officer_name,
              officer_title: officer.officer_title,
            }
          : undefined,
      },
    };
  }

  /** True when any requested discount needs approval (pricing controls). */
  private payloadRequiresApproval(payload: CreateQuotationDto): boolean {
    const visit = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(visit);
      if (!value || typeof value !== 'object') return false;
      const record = value as Record<string, unknown>;
      if (
        Array.isArray(record['discounts_offered']) &&
        (record['discounts_offered'] as Array<Record<string, unknown>>).some(
          (discount) => discount?.['approval_required'] === true,
        )
      ) {
        return true;
      }
      return Object.values(record).some(visit);
    };
    return visit(payload);
  }

  private async persistRoot(
    manager: EntityManager,
    companyId: string,
    quotationNumber: string,
    payload: CreateQuotationDto,
    userId: string,
    customerId: string | null,
    current: Quotation | null,
    productDefinition?: ProductDefinitionSnapshot,
  ): Promise<Quotation> {
    const internal = payload.internal_quotation;
    const repository = manager.getRepository(Quotation);
    const quotation = current ?? repository.create();
    const header = this.resolveHeader(payload);
    // A discount beyond the pricing control's approval threshold makes the
    // whole quotation subject to approval before payment / TIRA submission.
    const approvalRequired = this.payloadRequiresApproval(payload);
    const lifecycleState = current
      ? this.mergeLifecycleState(current, header.payment_mode, approvalRequired)
      : this.quotationLifecycleService.initializeForCreation({
          paymentMode: header.payment_mode,
          existingApprovalRequired: approvalRequired,
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
      ...(productDefinition
        ? {
            product_version_id: productDefinition.productVersionId,
            product_definition_hash: productDefinition.definitionHash,
            product_definition_snapshot: productDefinition,
          }
        : null),
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
    this.correctPayloadCoverPeriod(payload);
    const header = this.resolveHeader(payload);
    const fleetHeader = payload.cover_note_dtl.fleet_hdr;
    // Fleet references are system-assigned per company. A reference that is
    // already set (edits, endorsements) is kept so TIRA sees a stable fleet.
    if (fleetHeader && !fleetHeader.fleet_id?.trim()) {
      fleetHeader.fleet_id = await this.businessReferenceService.next({
        companyId: quotation.company_id,
        documentType: 'MOTOR_FLEET',
        prefix: `FLT-${new Date().getFullYear()}-`,
        manager,
      });
    }
    const coverNoteRepository = manager.getRepository(QuotationCoverNote);
    const productDefinition = quotation.product_definition_snapshot;
    const persistedExchangeRateSnapshot = exchangeRateSnapshot
      ? (JSON.parse(JSON.stringify(exchangeRateSnapshot)) as Record<
          string,
          unknown
        >)
      : null;

    const coverNote = await coverNoteRepository.save(
      coverNoteRepository.create({
        quotation_id: quotation.id,
        cover_note_type: resolveQuotationCoverNoteType({
          productCoverNoteType: productDefinition?.coverNoteType,
          payloadCoverNoteType: payload.cover_note_hdr.cover_note_type,
          draftPayload: quotation.draft_payload,
        }),
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
        product_code:
          productDefinition?.tiramisProductCode ??
          header.product_code.trim().toUpperCase(),
        fleet_id: fleetHeader?.fleet_id?.trim().toUpperCase() ?? null,
        is_policy_transaction: Boolean(quotation.source_policy_transaction_id),
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
    await this.persistCustomerSnapshot(
      manager,
      quotation,
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
          cover_note_desc: productDefinition
            ? this.resolveCoverText({
                supplied: input.cover_note_desc,
                approvedDefault: productDefinition.coverNoteDescription,
                overrideAllowed: productDefinition.allowsCoverTextOverride,
                fieldName: 'cover_note_desc',
              })
            : input.cover_note_desc.trim(),
          operative_clause: productDefinition
            ? this.resolveCoverText({
                supplied: input.operative_clause,
                approvedDefault: productDefinition.operativeClause,
                overrideAllowed: productDefinition.allowsCoverTextOverride,
                fieldName: 'operative_clause',
              })
            : input.operative_clause.trim(),
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
        productDefinition,
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
    const currentCustomerVersion = customerId
      ? await manager.getRepository(CustomerVersion).findOne({
          where: {
            customer_id: customerId,
            is_current_version: true,
          },
          order: { version_number: 'DESC' },
        })
      : null;
    const entities = holders.map((holder, index) =>
      repository.create({
        quotation_id: quotationId,
        customer_id: index === 0 ? customerId : null,
        customer_version_id:
          index === 0 ? (currentCustomerVersion?.id ?? null) : null,
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

  private async persistCustomerSnapshot(
    manager: EntityManager,
    quotation: Quotation,
    holders: PolicyHolderDto[],
    customerId: string | null,
  ) {
    const primaryHolder = holders[0] ?? null;
    const customer = customerId
      ? await manager.getRepository(Customer).findOne({
          where: { id: customerId, company_id: quotation.company_id },
        })
      : null;
    const snapshot = {
      quotationId: quotation.id,
      customerId,
      customerNumber: customer?.customer_no ?? null,
      kycStatus: customer?.kyc_status ?? null,
      kycVersion: Number(customer?.kyc_version ?? 0),
      policyHolder: primaryHolder
        ? {
            name: primaryHolder.policy_holder_name.trim(),
            birthDate: primaryHolder.policy_holder_birth_date,
            type: primaryHolder.policy_holder_type,
            idType: primaryHolder.policy_holder_id_type,
            idNumber: primaryHolder.policy_holder_id_number
              .trim()
              .toUpperCase(),
            phone: primaryHolder.policy_holder_phone_number.trim(),
            email: primaryHolder.email_address?.trim().toLowerCase() ?? null,
          }
        : null,
    };

    quotation.customer_snapshot = snapshot;
    quotation.customer_snapshot_hash =
      this.productDefinitionHashService.hashDefinition(snapshot);
    quotation.customer_kyc_version = Number(customer?.kyc_version ?? 0);
    quotation.customer_snapshot_at = new Date();

    await manager.getRepository(Quotation).update(
      { id: quotation.id },
      {
        customer_snapshot: quotation.customer_snapshot as any,
        customer_snapshot_hash: quotation.customer_snapshot_hash,
        customer_kyc_version: quotation.customer_kyc_version,
        customer_snapshot_at: quotation.customer_snapshot_at,
      },
    );
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
    productDefinition?: ProductDefinitionSnapshot | null,
  ): Promise<void> {
    if (input.motor_dtl && customerId) {
      await this.persistMotorVehicle(
        manager,
        quotation,
        customerId,
        input.motor_dtl,
        userId,
        currencyCode,
      );
    } else if (customerId) {
      for (const subject of input.subject_matters_covered) {
        await this.resolveOrCreateVerifiedSubjectInsuredAsset(
          manager,
          quotation,
          customerId,
          subject,
          userId,
          currencyCode,
        );
      }
    }

    await this.persistEntryRisks(
      manager,
      entry,
      input,
      riskByCode,
      userId,
      quotation,
      customerId,
    );
    await this.persistSubjectMatters(manager, entry, input);

    if (productDefinition) {
      this.validateSelectedAddons(productDefinition, input.cover_note_addons);
    }

    await this.persistAddons(manager, entry, input);

    if (input.motor_dtl) {
      const motorRepository = manager.getRepository(QuotationMotorDetail);
      const motorVehicleVersionId = customerId
        ? await this.resolveCurrentMotorVehicleVersionId(
            manager,
            quotation.company_id,
            customerId,
            input.motor_dtl,
          )
        : null;

      await motorRepository.save(
        motorRepository.create({
          entry_id: entry.id,
          motor_vehicle_version_id: motorVehicleVersionId,
          ...this.mapMotorForPersistence(input.motor_dtl),
        }),
      );
    }
  }

  private async resolveCurrentMotorVehicleVersionId(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    motor: MotorDetailDto,
  ): Promise<string | null> {
    const registrationNumber =
      normalizeMotorTextValue(motor.registration_number) ?? '';
    const chassisNumber = normalizeMotorTextValue(motor.chassis_number) ?? '';
    const engineNumber = normalizeMotorTextValue(motor.engine_number) ?? '';
    const vehicle = await manager
      .getRepository(MotorVehicle)
      .createQueryBuilder('vehicle')
      .where('vehicle.company_id = :companyId', { companyId })
      .andWhere('vehicle.customer_id = :customerId', { customerId })
      .andWhere('vehicle.deleted_at IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'UPPER(TRIM(vehicle.registration_no)) = :registrationNumber',
            { registrationNumber },
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

    if (!vehicle) return null;

    const version = await manager.getRepository(MotorVehicleVersion).findOne({
      where: { motor_vehicle_id: vehicle.id, is_current_version: true },
      order: { version_number: 'DESC' },
    });

    return version?.id ?? null;
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
    const registrationNumber =
      normalizeMotorTextValue(motor.registration_number) ?? '';
    const chassisNumber = normalizeMotorTextValue(motor.chassis_number) ?? '';
    const engineNumber = normalizeMotorTextValue(motor.engine_number) ?? '';
    const make = normalizeMotorTextValue(motor.make) ?? '';
    const model = normalizeMotorTextValue(motor.model) ?? '';
    const modelNumber = normalizeMotorTextValue(motor.model_number);

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
    const insuredAsset = await this.resolveOrCreateVerifiedMotorInsuredAsset(
      manager,
      quotation,
      customerId,
      motor,
      existingVehicle?.insured_asset_id ?? null,
      userId,
      currencyCode,
    );

    Object.assign(vehicle, {
      company_id: quotation.company_id,
      customer_id: customerId,
      insured_asset_id: insuredAsset.id,
      registration_no: registrationNumber,
      chassis_no: chassisNumber,
      engine_no: engineNumber,
      make,
      model,
      body_type: motor.body_type.trim(),
      color: motor.color.trim(),
      manufacture_year: motor.year_of_manufacture,
      usage_type: motorUsageTypeLabel(motor.motor_usage),
      seating_capacity: motor.sitting_capacity,
      cubic_capacity: Number.isFinite(Number(motor.engine_capacity))
        ? Number(motor.engine_capacity)
        : null,
      fuel_type: motor.fuel_used.trim(),
      model_no: modelNumber,
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

  private async resolveOrCreateVerifiedMotorInsuredAsset(
    manager: EntityManager,
    quotation: Quotation,
    customerId: string,
    motor: MotorDetailDto,
    existingAssetId: string | null,
    userId: string,
    currencyCode: string,
  ): Promise<InsuredAsset> {
    const repository = manager.getRepository(InsuredAsset);
    const registrationNumber =
      normalizeMotorTextValue(motor.registration_number) ?? '';
    const chassisNumber = normalizeMotorTextValue(motor.chassis_number) ?? '';
    const engineNumber = normalizeMotorTextValue(motor.engine_number) ?? '';
    const make = normalizeMotorTextValue(motor.make) ?? '';
    const model = normalizeMotorTextValue(motor.model) ?? '';
    const displayName = [registrationNumber, make, model]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' ');
    const asset =
      (existingAssetId
        ? await repository.findOne({ where: { id: existingAssetId } })
        : null) ?? repository.create();

    const assetNumber =
      asset.asset_number ||
      `QA-${quotation.quotation_no}-${registrationNumber || chassisNumber}`;
    const snapshot = {
      assetNumber,
      assetType: 'MOTOR_VEHICLE',
      registrationNumber,
      chassisNumber,
      engineNumber,
      make,
      model,
      bodyType: motor.body_type.trim(),
      color: motor.color.trim(),
      manufactureYear: motor.year_of_manufacture,
      motorCategory: motor.motor_category,
      motorType: motor.motor_type,
      motorUsage: motor.motor_usage,
      ownerName: motor.owner_name.trim(),
      ownerCategory: motor.owner_category,
      ownerAddress: motor.owner_address.trim(),
      sourceQuotationId: quotation.id,
      sourceQuotationNo: quotation.quotation_no,
    };

    Object.assign(asset, {
      company_id: quotation.company_id,
      asset_number: assetNumber,
      asset_type: 'MOTOR_VEHICLE',
      customer_id: customerId,
      owner_customer_id: customerId,
      display_name: displayName || assetNumber,
      ownership_type: 'OWNED',
      declared_value: '0',
      currency_code: currencyCode.trim().toUpperCase(),
      status: 'ACTIVE',
      data_source: 'QUOTATION',
      verification_status: 'VERIFIED',
      verification_reference: quotation.quotation_no,
      snapshot_version: Math.max(Number(asset.snapshot_version ?? 0), 1),
      current_snapshot: snapshot,
      current_snapshot_hash:
        this.productDefinitionHashService.hashDefinition(snapshot),
      created_by: asset.created_by ?? userId,
      updated_by: userId,
    });

    return repository.save(asset);
  }

  /**
   * Non-motor mirror of resolveOrCreateVerifiedMotorInsuredAsset: motor
   * quotations self-certify their vehicle as a VERIFIED insured asset from
   * the submitted quotation data (no external registry backs it either).
   * Without this, non-motor subject-matter assets are created NOT_VERIFIED
   * with no endpoint able to change that, permanently blocking TIRAMIS
   * submission for every non-motor quotation.
   */
  private async resolveOrCreateVerifiedSubjectInsuredAsset(
    manager: EntityManager,
    quotation: Quotation,
    customerId: string,
    subject: SubjectMatterCoveredDto,
    userId: string,
    currencyCode: string,
  ): Promise<void> {
    const reference = subject.subject_matter_reference.trim().toUpperCase();

    if (!reference) {
      return;
    }

    const description = subject.subject_matter_desc.trim();
    const subjectRepository = manager.getRepository(SubjectMatter);
    const assetRepository = manager.getRepository(InsuredAsset);

    const existingSubject = await subjectRepository
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.insured_asset', 'asset')
      .where('subject.company_id = :companyId', {
        companyId: quotation.company_id,
      })
      .andWhere('UPPER(TRIM(subject.subject_code)) = :reference', {
        reference,
      })
      .getOne();

    const asset = existingSubject?.insured_asset ?? assetRepository.create();
    const assetNumber =
      asset.asset_number || `QA-${quotation.quotation_no}-${reference}`;
    const snapshot = {
      assetNumber,
      assetType: 'NON_MOTOR_SUBJECT',
      subjectReference: reference,
      subjectDescription: description,
      sourceQuotationId: quotation.id,
      sourceQuotationNo: quotation.quotation_no,
    };

    Object.assign(asset, {
      company_id: quotation.company_id,
      asset_number: assetNumber,
      asset_type: 'NON_MOTOR_SUBJECT',
      customer_id: customerId,
      owner_customer_id: customerId,
      display_name: description || reference,
      ownership_type: asset.ownership_type || 'OWNED',
      declared_value: asset.declared_value ?? '0',
      currency_code: currencyCode.trim().toUpperCase(),
      status: 'ACTIVE',
      data_source: 'QUOTATION',
      verification_status: 'VERIFIED',
      verification_reference: quotation.quotation_no,
      snapshot_version: Math.max(Number(asset.snapshot_version ?? 0), 1),
      current_snapshot: snapshot,
      current_snapshot_hash:
        this.productDefinitionHashService.hashDefinition(snapshot),
      created_by: asset.created_by ?? userId,
      updated_by: userId,
    });

    const savedAsset = await assetRepository.save(asset);

    const subjectEntity = existingSubject ?? subjectRepository.create();

    Object.assign(subjectEntity, {
      company_id: quotation.company_id,
      customer_id: customerId,
      owner_customer_id: subjectEntity.owner_customer_id ?? customerId,
      insured_asset_id: savedAsset.id,
      subject_code: reference,
      description,
      status: subjectEntity.status || 'ACTIVE',
      currency: currencyCode.trim().toUpperCase(),
      snapshot_version: Math.max(
        Number(subjectEntity.snapshot_version ?? 0),
        1,
      ),
      created_by: subjectEntity.created_by ?? userId,
      updated_by: userId,
    });

    await subjectRepository.save(subjectEntity);
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

  /**
   * Re-verifies a risk's attached pricing quote immediately before it is
   * written to quotation_entry_risks, so a stale, expired, rebased, or
   * tampered pricing result can never be persisted onto a quotation. This
   * is additional to (and independent of) the broader authoritative-pricing
   * checks performed on the payload in assertAuthoritativePricing.
   */
  private async resolvePricingAttachmentForRisk(
    manager: EntityManager,
    companyId: string,
    productVersionId: string | null,
    pricingQuoteId: string | null,
  ): Promise<{
    pricing_quote_id: string | null;
    pricing_result_hash: string | null;
    pricing_snapshot: Record<string, unknown> | null;
  }> {
    if (!pricingQuoteId) {
      return {
        pricing_quote_id: null,
        pricing_result_hash: null,
        pricing_snapshot: null,
      };
    }

    const pricingQuote = await manager.getRepository(PricingQuote).findOne({
      where: {
        company_id: companyId,
        pricing_quote_id: pricingQuoteId,
      },
    });

    if (!pricingQuote) {
      throw new NotFoundException('Pricing quote was not found.');
    }

    if (pricingQuote.expires_at.getTime() < Date.now()) {
      throw new ConflictException({
        code: 'PRICING_QUOTE_EXPIRED',
        message: 'The pricing quote has expired and must be recalculated.',
      });
    }

    if (
      productVersionId &&
      pricingQuote.product_version_id &&
      pricingQuote.product_version_id !== productVersionId
    ) {
      throw new ConflictException(
        'The pricing quote belongs to another product version.',
      );
    }

    if (pricingQuote.pricing_result_snapshot && pricingQuote.result_hash) {
      const computedResultHash =
        this.productDefinitionHashService.hashDefinition({
          ...pricingQuote.pricing_result_snapshot,
          resultHash: undefined,
        });

      if (computedResultHash !== pricingQuote.result_hash) {
        throw new ConflictException({
          code: 'PRICING_RESULT_INTEGRITY_FAILURE',
          message: 'The pricing result failed its integrity check.',
        });
      }
    }

    return {
      pricing_quote_id: pricingQuoteId,
      pricing_result_hash: pricingQuote.result_hash,
      pricing_snapshot: pricingQuote.pricing_result_snapshot,
    };
  }

  private async resolveVerifiedAssetForEntryRisk(
    manager: EntityManager,
    quotation: Quotation,
    customerId: string,
    input: ResolvedEntry,
    riskIndex: number,
  ): Promise<InsuredAsset | null> {
    if (input.motor_dtl) {
      return this.resolveVerifiedMotorAsset(
        manager,
        quotation.company_id,
        customerId,
        input.motor_dtl,
      );
    }

    const subject =
      input.subject_matters_covered[riskIndex] ??
      input.subject_matters_covered[0] ??
      null;

    if (!subject) {
      return null;
    }

    return this.resolveVerifiedSubjectAsset(
      manager,
      quotation.company_id,
      customerId,
      subject,
    );
  }

  private async resolveVerifiedMotorAsset(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    motor: MotorDetailDto,
  ): Promise<InsuredAsset | null> {
    const registrationNumber =
      normalizeMotorTextValue(motor.registration_number) ?? '';
    const chassisNumber = normalizeMotorTextValue(motor.chassis_number) ?? '';
    const engineNumber = normalizeMotorTextValue(motor.engine_number) ?? '';
    const vehicle = await manager
      .getRepository(MotorVehicle)
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.insured_asset', 'asset')
      .where('vehicle.company_id = :companyId', { companyId })
      .andWhere('vehicle.customer_id = :customerId', { customerId })
      .andWhere('vehicle.insured_asset_id IS NOT NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'UPPER(TRIM(vehicle.registration_no)) = :registrationNumber',
            { registrationNumber },
          )
            .orWhere('UPPER(TRIM(vehicle.chassis_no)) = :chassisNumber', {
              chassisNumber,
            })
            .orWhere('UPPER(TRIM(vehicle.engine_no)) = :engineNumber', {
              engineNumber,
            });
        }),
      )
      .getOne();

    return this.isVerifiedInsuredAsset(vehicle?.insured_asset)
      ? vehicle.insured_asset
      : null;
  }

  private async resolveVerifiedSubjectAsset(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    subject: SubjectMatterCoveredDto,
  ): Promise<InsuredAsset | null> {
    const reference = subject.subject_matter_reference.trim().toUpperCase();
    const persisted = await manager
      .getRepository(SubjectMatter)
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.insured_asset', 'asset')
      .where('subject.company_id = :companyId', { companyId })
      .andWhere('subject.customer_id = :customerId', { customerId })
      .andWhere('subject.insured_asset_id IS NOT NULL')
      .andWhere('UPPER(TRIM(subject.subject_code)) = :reference', {
        reference,
      })
      .getOne();

    return this.isVerifiedInsuredAsset(persisted?.insured_asset)
      ? persisted.insured_asset
      : null;
  }

  private isVerifiedInsuredAsset(
    asset: InsuredAsset | null | undefined,
  ): asset is InsuredAsset {
    return (
      !!asset &&
      asset.status === 'ACTIVE' &&
      asset.verification_status === 'VERIFIED' &&
      !!asset.current_snapshot_hash?.trim()
    );
  }

  private buildInsuredAssetSnapshot(asset: InsuredAsset) {
    return {
      id: asset.id,
      assetNumber: asset.asset_number,
      assetType: asset.asset_type,
      customerId: asset.customer_id,
      ownerCustomerId: asset.owner_customer_id,
      displayName: asset.display_name,
      ownershipType: asset.ownership_type,
      declaredValue: asset.declared_value,
      currencyCode: asset.currency_code,
      verificationStatus: asset.verification_status,
      verificationReference: asset.verification_reference,
      snapshotVersion: asset.snapshot_version,
    };
  }

  private async persistEntryRisks(
    manager: EntityManager,
    entry: QuotationCoverNoteEntry,
    input: ResolvedEntry,
    riskByCode: Map<string, InsuranceRisk>,
    userId: string,
    quotation: Quotation,
    customerId: string | null,
  ): Promise<void> {
    const riskRepository = manager.getRepository(QuotationEntryRisk);
    const discountRepository = manager.getRepository(QuotationRiskDiscount);
    const taxRepository = manager.getRepository(QuotationRiskTax);
    const assetRepository = manager.getRepository(QuotationRiskAsset);

    for (
      let riskIndex = 0;
      riskIndex < input.risks_covered.length;
      riskIndex += 1
    ) {
      const inputRisk = input.risks_covered[riskIndex];
      const normalizedRiskCode = this.normalizeUppercase(inputRisk.risk_code);
      const configuredRisk = riskByCode.get(normalizedRiskCode);
      const pricingAttachment = await this.resolvePricingAttachmentForRisk(
        manager,
        quotation.company_id,
        quotation.product_version_id,
        inputRisk.pricing_quote_id?.trim() ?? null,
      );

      const risk = await riskRepository.save(
        riskRepository.create({
          entry_id: entry.id,
          insurance_risk_id: configuredRisk?.id ?? null,
          sequence_no: riskIndex + 1,
          risk_code: normalizedRiskCode,
          pricing_quote_id: pricingAttachment.pricing_quote_id,
          pricing_result_hash: pricingAttachment.pricing_result_hash,
          pricing_snapshot: pricingAttachment.pricing_snapshot,
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

      const verifiedAsset = customerId
        ? await this.resolveVerifiedAssetForEntryRisk(
            manager,
            quotation,
            customerId,
            input,
            riskIndex,
          )
        : null;

      if (verifiedAsset) {
        const assetSnapshot =
          verifiedAsset.current_snapshot ??
          this.buildInsuredAssetSnapshot(verifiedAsset);
        await assetRepository.save(
          assetRepository.create({
            quotation_id: quotation.id,
            quotation_risk_id: risk.id,
            insured_asset_id: verifiedAsset.id,
            asset_type: verifiedAsset.asset_type,
            asset_snapshot: assetSnapshot,
            asset_snapshot_hash:
              verifiedAsset.current_snapshot_hash ??
              this.productDefinitionHashService.hashDefinition(assetSnapshot),
            asset_snapshot_version: verifiedAsset.snapshot_version,
          }),
        );
      }

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
      registration_number:
        normalizeMotorTextValue(motor.registration_number) ?? '',
      chassis_number: normalizeMotorTextValue(motor.chassis_number) ?? '',
      make: normalizeMotorTextValue(motor.make) ?? '',
      model: normalizeMotorTextValue(motor.model) ?? '',
      model_number: normalizeMotorTextValue(motor.model_number),
      body_type: motor.body_type.trim(),
      color: motor.color.trim(),
      engine_number: normalizeMotorTextValue(motor.engine_number) ?? '',
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

  private correctPayloadCoverPeriod(payload: CreateQuotationDto): void {
    const header = this.resolveHeader(payload);
    const period = normalizeQuotationCoverPeriod(
      header.cover_note_start_date,
      header.cover_note_end_date,
    );

    if (
      payload.internal_quotation.quotation_flow === QuotationFlow.MOTOR_FLEET
    ) {
      payload.cover_note_dtl.fleet_hdr!.cover_note_start_date =
        period.startDateTime;
      payload.cover_note_dtl.fleet_hdr!.cover_note_end_date =
        period.endDateTime;
      return;
    }

    payload.cover_note_dtl.cover_note_start_date = period.startDateTime;
    payload.cover_note_dtl.cover_note_end_date = period.endDateTime;
  }

  private async correctPersistedQuotationCoverPeriod(
    quotation: Quotation,
  ): Promise<void> {
    const coverNote = quotation.cover_note;

    if (!coverNote) {
      throw new BadRequestException(
        'Quotation cover-note information was not found',
      );
    }

    const period = normalizeQuotationCoverPeriod(
      coverNote.cover_note_start_date,
      coverNote.cover_note_end_date,
    );

    if (!period.adjusted) {
      return;
    }

    await this.dataSource
      .getRepository(QuotationCoverNote)
      .update(coverNote.id, {
        cover_note_start_date: period.startDate,
        cover_note_end_date: period.endDate,
      });

    coverNote.cover_note_start_date = period.startDate;
    coverNote.cover_note_end_date = period.endDate;
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
    options: ReplaceQuotationOptions = {},
  ): Promise<CreateQuotationDto | UpdateQuotationDto> {
    const prepared = JSON.parse(JSON.stringify(payload)) as
      | CreateQuotationDto
      | UpdateQuotationDto;

    const flow = prepared.internal_quotation.quotation_flow;
    const shouldReuseExistingIdentifiers =
      options.reuseExistingIdentifiers ?? true;
    const existingEntries = shouldReuseExistingIdentifiers
      ? (currentQuotation?.cover_note?.entries ?? [])
      : [];

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

  private async findAggregateInTransaction(
    manager: EntityManager,
    companyId: string,
    id: string,
  ): Promise<Quotation> {
    const quotation = await manager
      .getRepository(Quotation)
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.cover_note', 'coverNote')
      .leftJoinAndSelect('coverNote.entries', 'entry')
      .leftJoinAndSelect('entry.risks', 'risk')
      .leftJoinAndSelect('entry.subject_matters', 'subjectMatter')
      .leftJoinAndSelect('entry.addons', 'addon')
      .leftJoinAndSelect('entry.motor_detail', 'motorDetail')
      .leftJoinAndSelect('quotation.policy_holders', 'policyHolder')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL')
      .orderBy('entry.entry_number', 'ASC')
      .addOrderBy('policyHolder.sequence_no', 'ASC')
      .getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!quotation.cover_note) {
      throw new NotFoundException(
        'Quotation cover-note information was not found',
      );
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
      previousStatus: QuotationStatus | null;
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
    if (quotation.submitted_at && !this.isTiraFailureQuotation(quotation)) {
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

  private isCashPaymentMode(quotation: Quotation): boolean {
    return Number(quotation.cover_note?.payment_mode) === DEFAULT_PAYMENT_MODE;
  }

  private async ensureCashInvoiceSettledForSubmission(
    companyId: string,
    quotation: Quotation,
    submitOptions: SubmitQuotationDto,
    userId: string,
  ): Promise<void> {
    if (
      !quotation.requires_payment ||
      !this.isCashPaymentMode(quotation) ||
      quotation.payment_status === PaymentStatus.PAID ||
      (!!submitOptions.return_existing &&
        quotation.tira_status !== TiraStatus.NOT_SUBMITTED)
    ) {
      return;
    }

    const approvalSatisfied =
      !quotation.requires_approval ||
      quotation.approval_status === ApprovalStatus.APPROVED;
    if (!approvalSatisfied) {
      return;
    }

    const invoice = await this.createOrReuseQuotationPaymentInvoice(
      companyId,
      quotation,
      userId,
      'Cash quotation invoice generated and settled during TIRAMIS submission',
    );

    await this.settleCashQuotationInvoice(invoice, userId);

    await this.quotationLifecycleService.markPaymentPaid(
      companyId,
      quotation.id,
      {
        changedBy: userId,
        changedByType: 'USER',
        source: 'USER',
        reason: `Cash payment settled against invoice ${invoice.invoice_no}`,
        requestId: invoice.id,
      },
    );

    quotation.payment_status = PaymentStatus.PAID;
    quotation.payment_completed_at = new Date();
    quotation.payment_failure_reason = null;
    quotation.status = QuotationStatus.READY_FOR_SUBMISSION;
  }

  private async createOrReuseQuotationPaymentInvoice(
    companyId: string,
    quotation: Quotation,
    userId: string,
    instructions: string,
  ): Promise<Invoice> {
    if (!quotation.customer_id) {
      throw new ConflictException(
        'A linked customer is required before generating a payment invoice',
      );
    }

    const latestInvoice = await this.findLatestInvoice(companyId, quotation.id);
    if (
      latestInvoice &&
      !['VOID', 'VOIDED', 'CANCELLED'].includes(
        String(latestInvoice.status).toUpperCase(),
      )
    ) {
      return latestInvoice;
    }

    return this.quotationInvoiceService.createOrReuseQuotationInvoice(
      this.dataSource.manager,
      {
        companyId,
        quotationId: quotation.id,
        quotationNumber: quotation.quotation_no,
        workflowRevision: Number(quotation.workflow_revision ?? 1),
        insurerCompanyId: quotation.insurer_company_id,
        intermediaryCompanyId: quotation.intermediary_company_id ?? null,
        customerId: quotation.customer_id,
        branchId: quotation.branch_id ?? null,
        currencyCode:
          quotation.cover_note?.currency_code?.trim().toUpperCase() ?? 'TZS',
        amount: this.numeric(
          quotation.cover_note?.total_premium_including_tax ?? 0,
          4,
        ),
        pricingResultHash: this.resolveQuotationPricingResultHash(quotation),
        finalizationHash:
          quotation.finalization_hash ??
          this.productDefinitionHashService.hashDefinition(
            quotation.finalization_snapshot ?? {},
          ),
        sourceSnapshot:
          quotation.finalization_snapshot ??
          (quotation as unknown as Record<string, unknown>),
        createdBy: userId,
        instructions,
      },
    );
  }

  private resolveQuotationPricingResultHash(
    quotation: Quotation,
  ): string | null {
    const snapshot = (quotation.cover_note?.entries ?? [])
      .flatMap((entry) => entry.risks ?? [])
      .find((risk) => !!risk.pricing_snapshot)?.pricing_snapshot as
      | { resultHash?: string | null }
      | undefined;

    return snapshot?.resultHash ?? null;
  }

  private async settleCashQuotationInvoice(
    invoice: Invoice,
    userId: string,
  ): Promise<void> {
    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.OVERPAID
    ) {
      return;
    }

    if (
      invoice.status === InvoiceStatus.VOIDED ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      throw new ConflictException('Cash payment invoice is not active.');
    }

    const totalAmount = this.numeric(invoice.total_amount ?? 0, 2);
    const now = new Date();

    invoice.status = InvoiceStatus.PAID;
    invoice.paid_amount = totalAmount;
    invoice.allocated_amount = this.numeric(totalAmount, 4);
    invoice.balance_amount = this.numeric(0, 2);
    invoice.issued_by = invoice.issued_by ?? userId;
    invoice.issued_at = invoice.issued_at ?? now;
    invoice.posted_by = invoice.posted_by ?? userId;
    invoice.posted_at = invoice.posted_at ?? now;
    invoice.updated_by = userId;
    invoice.balance_revision = Number(invoice.balance_revision ?? 0) + 1;
    invoice.state_version = Number(invoice.state_version ?? 0) + 1;

    await this.dataSource.manager.getRepository(Invoice).save(invoice);
  }

  private async assertPaymentReady(quotation: Quotation): Promise<void> {
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
        'Quotation payment is not settled. Generate and settle an invoice before submitting to TIRA.',
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
    const policyTransactionId =
      quotation.source_policy_transaction_id?.trim() || null;

    const trackings = await trackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.source_company_id = :companyId', { companyId })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            new Brackets((moduleQb) => {
              moduleQb
                .where('tracking.source_module = :module', {
                  module: 'quotations',
                })
                .orWhere('tracking.source_module ILIKE :fleetModule', {
                  fleetModule: '%quotation%',
                });
            }),
          );

          if (policyTransactionId) {
            qb.orWhere(
              new Brackets((transactionQb) => {
                transactionQb
                  .where('tracking.source_module = :transactionModule', {
                    transactionModule: 'policy-transactions',
                  })
                  .andWhere(
                    'tracking.source_record_id = :policyTransactionId',
                    {
                      policyTransactionId,
                    },
                  );
              }),
            );
          }
        }),
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('tracking.source_record_id IN (:...references)', {
            references: businessReferences,
          }).orWhere('tracking.business_reference IN (:...references)', {
            references: businessReferences,
          });

          if (policyTransactionId) {
            qb.orWhere('tracking.source_record_id = :policyTransactionId', {
              policyTransactionId,
            });
          }
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
        // Only the quotation line-item indexes (UQ_q*_sequence), not e.g.
        // UQ_identifier_sequences_scope, which is about numbering.
        if (/^UQ_q[a-z]+_[a-z_]+_sequence$/.test(constraint)) {
          throw new ConflictException(
            'Duplicate line-item sequence detected while saving the quotation. Refresh the quotation and try again.',
          );
        }

        throw new ConflictException('A unique quotation value already exists');
      }

      if (code === '23503') {
        throw new BadRequestException({
          code: 'QUOTATION_INVALID_REFERENCE',
          message: 'Quotation contains an invalid relationship reference',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code === '23502') {
        throw new BadRequestException({
          code: 'QUOTATION_REQUIRED_FIELD_MISSING',
          message: driverError?.column
            ? `Quotation is missing required field "${driverError.column}"`
            : 'Quotation is missing a required field',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code === '23514') {
        throw new BadRequestException({
          code: 'QUOTATION_VALIDATION_CONSTRAINT_FAILED',
          message: 'Quotation violates a database validation constraint',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code === '22P02') {
        throw new BadRequestException({
          code: 'QUOTATION_INVALID_VALUE',
          message: 'Quotation contains an invalid identifier or enum value',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code === '22001') {
        throw new BadRequestException({
          code: 'QUOTATION_VALUE_TOO_LONG',
          message: driverError?.column
            ? `Quotation field "${driverError.column}" is too long`
            : 'Quotation contains a text value that is too long',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code === '22003') {
        throw new BadRequestException({
          code: 'QUOTATION_NUMERIC_VALUE_OUT_OF_RANGE',
          message:
            'Quotation contains a numeric value outside the supported range',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code === '22007' || code === '22008') {
        throw new BadRequestException({
          code: 'QUOTATION_INVALID_DATE',
          message: 'Quotation contains an invalid date or time value',
          details: this.databaseErrorDetails(driverError),
        });
      }

      if (code) {
        throw new BadRequestException({
          code: 'QUOTATION_DATABASE_SAVE_FAILED',
          message:
            'Quotation could not be saved because the database rejected one of the supplied values',
          details: this.databaseErrorDetails(driverError),
        });
      }
    }

    throw error;
  }

  private databaseErrorDetails(
    driverError: PostgreSqlDriverError | undefined,
  ): Record<string, unknown> {
    return {
      ...(driverError?.code ? { postgresCode: driverError.code } : {}),
      ...(driverError?.table ? { table: driverError.table } : {}),
      ...(driverError?.column ? { column: driverError.column } : {}),
      ...(driverError?.constraint
        ? { constraint: driverError.constraint }
        : {}),
      ...(driverError?.detail ? { detail: driverError.detail } : {}),
    };
  }
}
