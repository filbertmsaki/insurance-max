import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { ProductDefinitionService } from '../insurance-products/product-definition.service';
import { ApprovalStatus } from './enums/approval-status.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from './enums/quotation-status-transition-action.enum';
import { TiraStatus } from './enums/tira-status.enum';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationPreviewMapper } from './mappers/quotation-preview.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationLifecycleService } from './services/quotation-lifecycle.service';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { QuotationRiskAsset } from './entities/structured/quotation-risk-asset.entity';
import { QuotationsService } from './quotations.service';
import {
  createMotorSingleQuotationPayload,
  createMotorFleetQuotationPayload,
} from './testing/quotation-payload.fixture';
import { AuditService } from '../../shared/audit/audit.service';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { PricingChargeService } from '../pricing/application/pricing-charge.service';

describe('QuotationsService', () => {
  const productDefinitionHashService = new ProductDefinitionHashService();
  const submitTiramisUser = {
    id: 'user-1',
    permissions: ['quotations:submit-tiramis'],
  } as any;
  const rejectApprovalUser = {
    id: 'user-1',
    permissions: ['quotations:reject'],
  } as any;

  function buildProductDefinitionSnapshot(
    overrides: Record<string, unknown> = {},
  ) {
    const snapshot = {
      productId: 'product-1',
      productVersionId: 'version-1',
      versionNumber: 1,
      categoryId: '11111111-1111-4111-8111-111111111111',
      categoryCode: 'MOTOR',
      categoryName: 'Motor',
      productCode: 'MOTOR-COMP',
      productName: 'Motor Comprehensive',
      description: null,
      businessLine: 'MOTOR',
      lifecycleStatus: 'ACTIVE',
      versionStatus: 'PUBLISHED',
      reviewStatus: 'APPROVED',
      tiramisProductCode: 'SP005001000000',
      supportsFleet: true,
      coverNoteType: 1,
      defaultCoverDurationDays: 365,
      currencyCode: 'TZS',
      coverNoteDescription: 'Private motor comprehensive cover',
      operativeClause: 'Motor Comprehensive',
      policyOperativeClause: 'Motor Comprehensive',
      specialConditions: '',
      exclusions: '',
      allowsCoverTextOverride: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      definitionItems: [],
      addons: [],
      documentRequirements: [],
      subClasses: [],
      definitionHash: '',
      publishedAt: null,
      ...overrides,
    };

    const definitionHash = productDefinitionHashService.hashDefinition({
      ...snapshot,
      definitionHash: '',
      publishedAt: null,
    });

    return { ...snapshot, definitionHash };
  }

  function createServiceFixture(
    overrides?: Partial<Record<string, unknown>> & {
      pricingQuote?: Partial<Record<string, unknown>>;
      verifiedRiskAssets?: Array<Record<string, unknown>>;
    },
  ) {
    const createQueryBuilderStub = <T>(value: T) => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(value),
      getCount: jest
        .fn()
        .mockResolvedValue(
          typeof value === 'number'
            ? value
            : Array.isArray(value)
              ? value.length
              : value
                ? 1
                : 0,
        ),
      getMany: jest
        .fn()
        .mockResolvedValue(Array.isArray(value) ? value : value ? [value] : []),
    });

    const authoritativePayload = createMotorSingleQuotationPayload();
    const {
      pricingQuote: pricingQuoteOverrides,
      verifiedRiskAssets: verifiedRiskAssetOverrides,
      ...quotationOverrides
    } = overrides ?? {};
    const verifiedRiskAssets = verifiedRiskAssetOverrides ?? [
      {
        id: 'quotation-risk-asset-1',
        quotation_id: 'quotation-1',
        quotation_risk_id: 'quotation-risk-1',
        insured_asset_id: 'asset-1',
        asset_snapshot_hash: 'asset-snapshot-hash',
      },
    ];
    const pricingQuote = {
      pricing_quote_id:
        authoritativePayload.cover_note_dtl.risks_covered?.[0]
          ?.pricing_quote_id ?? 'PQ-2026-00000001',
      quote_scope: 'SINGLE_RISK',
      calculation_status: 'CALCULATED',
      calculated_at: new Date('2026-07-27T08:00:00.000Z'),
      expires_at: new Date(Date.now() + 86400000),
      product_id: 'product-1',
      risk_id: 'risk-1',
      quotation_type: authoritativePayload.internal_quotation.quotation_type,
      currency_code: authoritativePayload.cover_note_dtl.currency_code,
      final_premium: '100000',
      result_payload: {
        sum_insured:
          authoritativePayload.cover_note_dtl.risks_covered?.[0]?.sum_insured,
        percentage_rate:
          authoritativePayload.cover_note_dtl.risks_covered?.[0]?.premium_rate,
      },
      input_payload: {
        sum_insured:
          authoritativePayload.cover_note_dtl.risks_covered?.[0]?.sum_insured,
      },
      rate_book_id: 'rate-book-1',
      rate_book_version: '2026.1',
      ...pricingQuoteOverrides,
    };
    const rateBook = {
      id: 'rate-book-1',
      company_id: 'company-1',
      code: 'RB-MTR',
      version: '2026.1',
      status: 'PUBLISHED',
      effective_from: '2026-01-01',
      effective_to: null,
    };
    const productDefinitionSnapshot = buildProductDefinitionSnapshot();

    const quotation = {
      id: 'quotation-1',
      quotation_no: 'QTN-MTR-2026-000001',
      product_id: 'product-1',
      product_version_id: productDefinitionSnapshot.productVersionId,
      product_definition_hash: productDefinitionSnapshot.definitionHash,
      product_definition_snapshot: productDefinitionSnapshot,
      quotation_flow: authoritativePayload.internal_quotation.quotation_flow,
      channel_type: authoritativePayload.internal_quotation.channel_type,
      status: QuotationStatus.READY_FOR_SUBMISSION,
      approval_status: ApprovalStatus.NOT_REQUIRED,
      payment_status: PaymentStatus.NOT_REQUIRED,
      tira_status: TiraStatus.NOT_SUBMITTED,
      requires_approval: false,
      requires_payment: false,
      submitted_at: null,
      submitted_by: null,
      branch_id: null,
      customer_id: 'customer-1',
      customer: {
        id: 'customer-1',
        customer_no: 'CUS-2026-000001',
        kyc_status: 'VERIFIED',
        kyc_version: 3,
      },
      branch: {
        id: 'branch-1',
        company_id: 'company-1',
        code: 'BR207',
        status: 'active',
        deleted_at: null,
      },
      company_id: 'company-1',
      cover_note: {
        id: 'cover-note-1',
        cover_note_start_date: new Date(
          authoritativePayload.cover_note_dtl.cover_note_start_date!,
        ),
        cover_note_end_date: new Date(
          authoritativePayload.cover_note_dtl.cover_note_end_date!,
        ),
        sale_point_code:
          authoritativePayload.cover_note_dtl.sale_point_code ?? 'SP502',
        payment_mode: 1,
        entries: [
          {
            risks: [
              {
                id: 'quotation-risk-1',
                risk_code:
                  authoritativePayload.cover_note_dtl.risks_covered?.[0]
                    ?.risk_code ?? 'SP005001000001',
                insurance_risk_id: 'risk-1',
                pricing_quote_id: pricingQuote.pricing_quote_id,
                premium_before_discount: '100000.00',
                premium_after_discount: '95000.00',
                premium_excluding_tax_equivalent: '95000.00',
                premium_including_tax: '112100.00',
                discounts: [],
                taxes: [],
                premium_overrides: [],
              },
            ],
          },
        ],
      },
      ...quotationOverrides,
    } as any;

    const quotationRepositoryMock = {
      findOne: jest.fn().mockResolvedValue(pricingQuote),
      find: jest.fn().mockResolvedValue([pricingQuote]),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(quotation),
      }),
    };
    const premiumOverrideRepositoryMock = {
      create: jest.fn().mockImplementation((value) => ({
        id: 'override-1',
        ...value,
      })),
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'override-1',
        ...value,
      })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const quotationEntryRiskRepositoryMock = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const quotationRiskDiscountRepositoryMock = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const quotationRiskTaxRepositoryMock = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const transactionManager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'Quotation'
        ) {
          return quotationRepositoryMock;
        }
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'QuotationRiskPremiumOverride'
        ) {
          return premiumOverrideRepositoryMock;
        }
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'QuotationEntryRisk'
        ) {
          return quotationEntryRiskRepositoryMock;
        }
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'QuotationRiskDiscount'
        ) {
          return quotationRiskDiscountRepositoryMock;
        }
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'QuotationRiskTax'
        ) {
          return quotationRiskTaxRepositoryMock;
        }

        return {
          update: jest.fn().mockResolvedValue(undefined),
          create: jest.fn().mockImplementation((value) => value),
          save: jest.fn().mockImplementation(async (value) => value),
        };
      }),
    };

    const dataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'Quotation'
        ) {
          return quotationRepositoryMock;
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'PricingQuote'
        ) {
          return quotationRepositoryMock;
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'PricingRateBook'
        ) {
          return {
            find: jest.fn().mockResolvedValue([rateBook]),
          };
        }

        if (entity === QuotationRiskAsset) {
          return {
            find: jest.fn().mockResolvedValue(verifiedRiskAssets),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'InsuranceProductVersion'
        ) {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: productDefinitionSnapshot.productVersionId,
              company_id: 'company-1',
              product_id: 'product-1',
              definition_hash: productDefinitionSnapshot.definitionHash,
              status: 'PUBLISHED',
              review_status: 'APPROVED',
            }),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'Invoice'
        ) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(createQueryBuilderStub(null)),
            count: jest.fn().mockResolvedValue(0),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'Receipt'
        ) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(createQueryBuilderStub(null)),
            count: jest.fn().mockResolvedValue(0),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'CommissionTransaction'
        ) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(createQueryBuilderStub(null)),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'PaymentTransaction'
        ) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(createQueryBuilderStub(null)),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'PortalTiraSubmission'
        ) {
          return {
            count: jest.fn().mockResolvedValue(0),
          };
        }

        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'TiramisSubmissionTrackingEntity'
        ) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(createQueryBuilderStub(null)),
          };
        }

        return {
          find: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue(undefined),
        };
      }),
      query: jest.fn().mockResolvedValue([]),
      transaction: jest
        .fn()
        .mockImplementation(async (callback) =>
          callback(transactionManager as any),
        ),
    } as unknown as DataSource;

    const quotationsRepository = {
      findOneAggregate: jest.fn().mockResolvedValue(quotation),
      findOneAggregateForScope: jest.fn().mockResolvedValue(quotation),
      assertReadable: jest.fn().mockResolvedValue(undefined),
      assertWritable: jest.fn().mockResolvedValue(undefined),
      findAllForScope: jest.fn().mockResolvedValue({
        items: [quotation],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
          has_previous_page: false,
          has_next_page: false,
        },
        extrasByQuotationId: new Map(),
      }),
    } as unknown as QuotationsRepository;
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue({
        userId: 'user-1',
        companyId: 'company-1',
        companyType: 'INSURANCE_COMPANY',
        companyMembershipId: 'membership-1',
        activeBranchId: 'branch-1',
        assignedBranchIds: ['branch-1'],
        allowedBranchIds: ['branch-1'],
        canViewAllBranches: true,
        canViewAssignedBranches: false,
        ownRecordsOnly: false,
        canViewCarrierPortfolio: false,
        canViewIntermediaryPortfolio: false,
        permissions: [],
      }),
    } as unknown as DataAccessScopeService;

    const payloadMapper = {
      toAuthoritativePayload: jest.fn().mockReturnValue(authoritativePayload),
      businessReference: jest.fn().mockReturnValue('AICL-MTR-2026-000001'),
      toResponse: jest.fn().mockImplementation((value: any) => value),
      toListItem: jest.fn().mockImplementation((value: any) => value),
    } as unknown as QuotationPayloadMapper;

    const previewMapper = {
      toResponse: jest.fn().mockReturnValue({
        overview: {
          quotation_flow:
            authoritativePayload.internal_quotation.quotation_flow,
        },
      }),
    } as unknown as QuotationPreviewMapper;

    const payloadValidator = {
      assertValid: jest.fn(),
    } as unknown as QuotationPayloadValidator;

    const tiramisBusinessSubmitService = {
      submitAnyBusinessRecord: jest.fn().mockResolvedValue({
        requestId: 'request-1',
        tracking_id: 'tracking-1',
      }),
    } as unknown as TiramisBusinessSubmitService;

    const quotationLifecycleService = {
      startTiraSubmission: jest.fn().mockResolvedValue(undefined),
      markTiraSubmitted: jest.fn().mockResolvedValue(undefined),
      markTiraFailed: jest.fn().mockResolvedValue(undefined),
      recordWorkflowFinalization: jest.fn().mockResolvedValue(undefined),
      evaluateRequirements: jest.fn().mockResolvedValue(undefined),
      submitForApproval: jest.fn().mockResolvedValue(undefined),
      approveQuotation: jest.fn().mockResolvedValue(undefined),
      requestChanges: jest.fn().mockResolvedValue(undefined),
      rejectApproval: jest.fn().mockResolvedValue(undefined),
      markPaymentRequested: jest.fn().mockResolvedValue(undefined),
      markPaymentProcessing: jest.fn().mockResolvedValue(undefined),
      markPartiallyPaid: jest.fn().mockResolvedValue(undefined),
      markPaymentPaid: jest.fn().mockResolvedValue(undefined),
      markPaymentFailed: jest.fn().mockResolvedValue(undefined),
      markPaymentExpired: jest.fn().mockResolvedValue(undefined),
      markPaymentRefunded: jest.fn().mockResolvedValue(undefined),
      cancelQuotation: jest.fn().mockResolvedValue(undefined),
      expireQuotation: jest.fn().mockResolvedValue(undefined),
      convertQuotation: jest.fn().mockResolvedValue(undefined),
    } as unknown as QuotationLifecycleService;

    const tiramisTrackingRepository = {} as TiramisSubmissionTrackingRepository;
    const identifierGeneratorService = {
      generateQuotationNumber: jest
        .fn()
        .mockResolvedValue('QTN-MTR-2026-000001'),
    } as unknown as IdentifierGeneratorService;
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const pricingChargeService = {
      calculateCharges: jest.fn().mockResolvedValue({
        charges: [
          {
            applied_rule_id: 'charge-rule-1',
            charge_code: 'VAT-MAINLAND',
            charge_name: 'VAT Mainland',
            charge_category: 'TAX',
            charge_scope: 'RISK',
            charge_type: 'PERCENTAGE',
            calculation_base: 'NET_PREMIUM',
            base_amount: 100000,
            rate: 0.18,
            fixed_amount: null,
            minimum_charge_amount: null,
            maximum_charge_amount: null,
            computed_amount: 18000,
            is_taxable: false,
            effective_from: '2026-01-01',
            effective_to: '2026-12-31',
          },
        ],
        total_charge_amount: 18000,
        taxable_charge_amount: 0,
        non_taxable_charge_amount: 18000,
        premium_including_charges: 118000,
      }),
    } as unknown as PricingChargeService;
    const exchangeRateGovernanceService = {
      resolveSnapshot: jest.fn().mockResolvedValue({
        quotation_currency_code: 'TZS',
        base_currency_code: 'TZS',
        exchange_rate: 1,
        exchange_rate_source: 'PARITY',
        exchange_rate_date: '2026-07-13',
        exchange_rate_precision: 10,
        approval_required: false,
        approval_granted: true,
        approved_by_user_id: null,
        approved_at: null,
        conversion_direction: 'QUOTE_TO_BASE_MULTIPLY',
        rounding_method: 'ROUND_HALF_UP',
      }),
    };
    const pricingQuoteService = {
      calculateSingleRiskQuote: jest.fn().mockResolvedValue({
        pricing_quote_id: pricingQuote.pricing_quote_id,
        sum_insured:
          pricingQuote.result_payload.sum_insured ??
          authoritativePayload.cover_note_dtl.risks_covered?.[0]?.sum_insured ??
          5000000,
        sum_insured_equivalent:
          authoritativePayload.cover_note_dtl.risks_covered?.[0]
            ?.sum_insured_equivalent ?? 5000000,
        premium_rate:
          pricingQuote.result_payload.percentage_rate ??
          authoritativePayload.cover_note_dtl.risks_covered?.[0]
            ?.premium_rate ??
          0.02,
        premium_before_discount:
          Number(pricingQuote.final_premium) ||
          authoritativePayload.cover_note_dtl.risks_covered?.[0]
            ?.premium_before_discount ||
          100000,
      }),
    };
    const branchUserRepository = {
      createQueryBuilder: jest.fn(() => ({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          branch: {
            id: 'branch-1',
            company_id: 'company-1',
            code: 'BR207',
            status: 'active',
            deleted_at: null,
          },
        }),
      })),
    } as any;
    const salePointRepository = {
      find: jest.fn().mockResolvedValue([
        {
          companyId: 'company-1',
          branchId: 'branch-1',
          salePointCode: 'SP502',
          isActive: true,
        },
      ]),
    } as any;

    const productDefinitionService = {
      resolvePublishedDefinition: jest
        .fn()
        .mockResolvedValue(productDefinitionSnapshot),
    } as unknown as ProductDefinitionService;
    const quotationInvoiceService = {
      createOrReuseQuotationInvoice: jest.fn(),
    } as any;

    const service = new QuotationsService(
      dataSource,
      quotationsRepository,
      dataAccessScopeService,
      payloadMapper,
      previewMapper,
      new QuotationTiramisPayloadMapper(),
      payloadValidator,
      tiramisBusinessSubmitService,
      tiramisTrackingRepository,
      identifierGeneratorService,
      quotationLifecycleService,
      auditService,
      pricingChargeService,
      exchangeRateGovernanceService as any,
      pricingQuoteService as any,
      productDefinitionService,
      productDefinitionHashService,
      quotationInvoiceService,
      branchUserRepository,
      salePointRepository,
    );

    return {
      authoritativePayload,
      auditService,
      dataSource,
      quotation,
      premiumOverrideRepositoryMock,
      payloadMapper,
      previewMapper,
      pricingChargeService,
      pricingQuoteService,
      quotationLifecycleService,
      quotationEntryRiskRepositoryMock,
      quotationRepositoryMock,
      quotationRiskDiscountRepositoryMock,
      quotationRiskTaxRepositoryMock,
      tiramisBusinessSubmitService,
      transactionManager,
      productDefinitionService,
      productDefinitionSnapshot,
      quotationInvoiceService,
      service,
    };
  }

  it('submits the final outbound payload to TIRAMIS using camelCase fields', async () => {
    const fixture = createServiceFixture();

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      undefined,
      submitTiramisUser,
    );

    expect(
      (
        fixture.tiramisBusinessSubmitService
          .submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).toMatchObject({
      coverNoteNumber: 'AICL-MTR-2026-000001',
      salePointCode: 'SP502',
      productCode: 'SP005001000000',
      risks: [
        {
          riskCode: 'SP005001000001',
          taxes: [
            {
              taxCode: 'VAT-MAINLAND',
            },
          ],
        },
      ],
      policyHolders: [
        {
          policyHolderName: 'Filbert Elisaia Msaki',
          phoneNumber: '255762650393',
        },
      ],
      motorDetail: {
        registrationNumber: 'T123ABC',
        chassisNumber: 'MOCKCHASSIS123456',
      },
      isFleet: false,
    });

    expect(
      (
        fixture.tiramisBusinessSubmitService
          .submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('cover_note_dtl');
    expect(
      (
        fixture.tiramisBusinessSubmitService
          .submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload,
    ).not.toHaveProperty('internal_quotation');

    expect(
      fixture.quotationLifecycleService.startTiraSubmission,
    ).toHaveBeenCalledWith(
      'company-1',
      fixture.quotation.id,
      expect.objectContaining({
        changedBy: 'user-1',
        reason: 'Quotation submitted to TIRAMIS',
      }),
      {
        allowRetryFromFailure: false,
      },
    );

    expect(
      fixture.quotationLifecycleService.markTiraSubmitted,
    ).toHaveBeenCalledWith(
      'company-1',
      fixture.quotation.id,
      expect.objectContaining({
        changedBy: 'user-1',
        tiraRequestId: 'request-1',
      }),
    );

    expect(fixture.auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'quotation.tira_submission.validated',
        metadata: expect.objectContaining({
          correlation_id: fixture.quotation.id,
          reason: 'Quotation passed backend TIRAMIS submission validation',
        }),
      }),
    );
  });

  it('allows deletion of an unsubmitted quotation even when it is no longer in draft status', async () => {
    const fixture = createServiceFixture({
      status: QuotationStatus.READY_FOR_SUBMISSION,
      approval_status: ApprovalStatus.APPROVED,
      payment_status: PaymentStatus.REQUESTED,
      approval_submitted_at: new Date('2026-07-01T08:00:00.000Z'),
      payment_requested_at: new Date('2026-07-02T08:00:00.000Z'),
      status_history: [
        {
          id: 'history-1',
          new_status: QuotationStatus.READY_FOR_SUBMISSION,
        },
      ],
    });

    await expect(
      fixture.service.removeDraftForUser(
        {
          id: 'user-1',
          companyId: 'company-1',
          permissions: ['quotations:delete-draft'],
        } as any,
        fixture.quotation.id,
      ),
    ).resolves.toBeUndefined();

    expect(fixture.quotationRepositoryMock.softDelete).toHaveBeenCalledWith({
      id: fixture.quotation.id,
      company_id: 'company-1',
    });
  });

  it('still blocks deletion when the quotation has already been submitted to TIRA', async () => {
    const fixture = createServiceFixture({
      tira_status: TiraStatus.SUBMITTED,
      submitted_at: new Date('2026-07-03T08:00:00.000Z'),
    });

    await expect(
      fixture.service.removeDraftForUser(
        {
          id: 'user-1',
          companyId: 'company-1',
          permissions: ['quotations:delete-draft'],
        } as any,
        fixture.quotation.id,
      ),
    ).rejects.toThrow('A submitted quotation cannot be deleted');

    expect(fixture.quotationRepositoryMock.softDelete).not.toHaveBeenCalled();
  });

  it('blocks TIRAMIS submission when quotation assets are not verified', async () => {
    const fixture = createServiceFixture({ verifiedRiskAssets: [] });

    await expect(
      fixture.service.submit(
        'company-1',
        fixture.quotation.id,
        undefined,
        submitTiramisUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord,
    ).not.toHaveBeenCalled();
  });

  it('exposes a current pricing integration summary on quotation detail responses', async () => {
    const fixture = createServiceFixture();

    const result = await fixture.service.findOne(
      'company-1',
      fixture.quotation.id,
      {
        permissions: ['pricing.view_breakdown'],
      },
    );

    expect(result.pricing_integration).toEqual(
      expect.objectContaining({
        pricing_status: 'CURRENT',
        is_stale: false,
        current_pricing_quote_id: 'PQ-2026-00000001',
        rate_book_version: '2026.1',
        base_premium: 100000,
        total_discounts: 5000,
        total_taxes: 18000,
        final_payable_premium: 123900,
        override_status: 'NOT_REQUIRED',
        approval_status: ApprovalStatus.NOT_REQUIRED,
      }),
    );
  });

  it('hides pricing integration on quotation detail responses without breakdown permission', async () => {
    const fixture = createServiceFixture();

    const result = await fixture.service.findOne(
      'company-1',
      fixture.quotation.id,
      {
        permissions: [],
      },
    );

    expect(result.pricing_integration).toBeNull();
  });

  it('only includes premium overrides in previews when the caller can view pricing audit data', async () => {
    const fixture = createServiceFixture();
    jest
      .spyOn(fixture.service as any, 'findLatestInvoice')
      .mockResolvedValue(null);
    jest
      .spyOn(fixture.service as any, 'findLatestReceipt')
      .mockResolvedValue(null);
    jest
      .spyOn(fixture.service as any, 'findLatestPaymentTransaction')
      .mockResolvedValue(null);
    jest
      .spyOn(fixture.service as any, 'findLatestPortalSubmission')
      .mockResolvedValue(null);
    jest
      .spyOn(fixture.service as any, 'findLatestTiramisTracking')
      .mockResolvedValue(null);
    jest
      .spyOn(fixture.service as any, 'findTiramisTrackingByEntry')
      .mockResolvedValue(new Map());

    const withAuditResult = await fixture.service.getPreview(
      'company-1',
      fixture.quotation.id,
      {
        permissions: ['pricing.view_audit', 'pricing.view_breakdown'],
      },
    );

    expect(fixture.previewMapper.toResponse).toHaveBeenLastCalledWith(
      fixture.quotation,
      expect.any(Object),
      expect.objectContaining({
        includePremiumOverrides: true,
      }),
    );
    expect(withAuditResult.pricing_integration).toEqual(
      expect.objectContaining({
        pricing_status: 'CURRENT',
      }),
    );

    const withoutAuditResult = await fixture.service.getPreview(
      'company-1',
      fixture.quotation.id,
      {
        permissions: [],
      },
    );

    expect(fixture.previewMapper.toResponse).toHaveBeenLastCalledWith(
      fixture.quotation,
      expect.any(Object),
      expect.objectContaining({
        includePremiumOverrides: false,
      }),
    );
    expect(withoutAuditResult.pricing_integration).toBeNull();
  });

  it('blocks quotation creation when discount requests are submitted without request permission', async () => {
    const fixture = createServiceFixture();
    const payload = createMotorSingleQuotationPayload();

    jest
      .spyOn(fixture.service as any, 'preparePayloadWithGeneratedIdentifiers')
      .mockResolvedValue(payload);
    jest.spyOn(fixture.service as any, 'validateScope').mockResolvedValue({
      product: { id: 'product-1' },
      riskByCode: new Map([['SP005001000001', { id: 'risk-1' }]]),
    });
    jest
      .spyOn(fixture.service as any, 'resolveExchangeRateSnapshot')
      .mockResolvedValue(null);
    jest
      .spyOn(fixture.service as any, 'validateAuthoritativePricing')
      .mockResolvedValue(undefined);

    await expect(
      fixture.service.create('company-1', payload, {
        id: 'user-1',
        permissions: [],
      } as any),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      fixture.service.create('company-1', payload, {
        id: 'user-1',
        permissions: [],
      } as any),
    ).rejects.toThrow(
      'You do not have permission to request quotation discounts',
    );
    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
  });

  describe('authoritative pricing validation on create (real validateAuthoritativePricing, not mocked)', () => {
    const pricingUser = {
      id: 'user-1',
      permissions: ['pricing.request_discount'],
    } as any;

    function stubNonPricingConcerns(
      fixture: ReturnType<typeof createServiceFixture>,
    ) {
      const payload = createMotorSingleQuotationPayload();
      jest
        .spyOn(fixture.service as any, 'preparePayloadWithGeneratedIdentifiers')
        .mockResolvedValue(payload);
      jest.spyOn(fixture.service as any, 'validateScope').mockResolvedValue({
        product: { id: 'product-1' },
        riskByCode: new Map([['SP005001000001', { id: 'risk-1' }]]),
      });
      jest
        .spyOn(fixture.service as any, 'resolveExchangeRateSnapshot')
        .mockResolvedValue(null);
      jest
        .spyOn(fixture.service as any, 'resolveOrCreateCustomerId')
        .mockResolvedValue('customer-1');
      jest.spyOn(fixture.service as any, 'persistRoot').mockResolvedValue({
        id: 'quotation-1',
        quotation_no: 'QTN-MTR-2026-000001',
      });
      jest
        .spyOn(fixture.service as any, 'persistAggregate')
        .mockResolvedValue(undefined);
      jest.spyOn(fixture.service, 'findOne').mockResolvedValue({
        id: 'quotation-1',
        quotation_no: 'QTN-MTR-2026-000001',
      } as any);
      return payload;
    }

    it.each([false, true])(
      'preserves selected VAT and its exemption during save (exempted=%s)',
      async (exempted) => {
        const fixture = createServiceFixture();
        const payload = stubNonPricingConcerns(fixture);
        const risk = payload.cover_note_dtl.risks_covered[0];
        risk.taxes_charged = [
          {
            tax_code: 'VAT-MAINLAND',
            tax_rate: 0.99,
            tax_amount: 99000,
            is_tax_exempted: exempted ? 'Y' : 'N',
            tax_exemption_type: exempted ? '1' : null,
            tax_exemption_reference: exempted ? 'EXEMPT-1' : null,
          },
        ];
        await fixture.service.create('company-1', payload, pricingUser);
        expect(
          fixture.pricingQuoteService.calculateSingleRiskQuote,
        ).toHaveBeenCalledWith(
          'company-1',
          expect.objectContaining({
            tax_codes: exempted ? [] : ['VAT-MAINLAND'],
          }),
          pricingUser.id,
          pricingUser,
        );
        expect(
          fixture.pricingChargeService.calculateCharges,
        ).toHaveBeenCalledWith(
          'company-1',
          expect.objectContaining({ tax_codes: ['VAT-MAINLAND'] }),
        );
        expect(risk.taxes_charged).toEqual([
          expect.objectContaining({
            tax_code: 'VAT-MAINLAND',
            tax_rate: 0.18,
            tax_amount: exempted ? 0 : 18000,
          }),
        ]);
      },
    );

    it('does not re-add taxes when saving an empty selection', async () => {
      const fixture = createServiceFixture();
      const payload = stubNonPricingConcerns(fixture);
      payload.cover_note_dtl.risks_covered[0].taxes_charged = [];
      await fixture.service.create('company-1', payload, pricingUser);
      expect(
        fixture.pricingQuoteService.calculateSingleRiskQuote,
      ).toHaveBeenCalledWith(
        'company-1',
        expect.objectContaining({ tax_codes: [] }),
        pricingUser.id,
        pricingUser,
      );
      expect(payload.cover_note_dtl.risks_covered[0].taxes_charged).toEqual([]);
      expect(
        payload.cover_note_dtl.risks_covered[0].premium_including_tax,
      ).toBe(95000);
    });

    it.each([
      { codes: ['VAT-MAINLAND'] },
      { codes: ['VAT-MAINLAND', 'WITHHOLDING'] },
      { codes: [] },
    ])(
      'preserves the requested tax selection when updating a quotation ($codes)',
      async ({ codes }) => {
        const fixture = createServiceFixture();
        const payload = stubNonPricingConcerns(fixture);
        jest
          .spyOn(fixture.service as any, 'resolveExistingQuotationContext')
          .mockReturnValue(payload);
        const selectedCodes = codes;
        const risk = payload.cover_note_dtl.risks_covered[0];
        risk.taxes_charged = selectedCodes.map((code) => ({
          tax_code: code,
          tax_rate: code === 'VAT-MAINLAND' ? 0.18 : 0.1,
          tax_amount: 0,
          is_tax_exempted: 'N' as const,
          tax_exemption_type: null,
          tax_exemption_reference: null,
        }));
        jest
          .spyOn(fixture.service as any, 'assertUserCanWriteQuotation')
          .mockResolvedValue(undefined);
        jest
          .spyOn(fixture.service as any, 'assertQuotationEditable')
          .mockReturnValue(undefined);
        jest
          .spyOn(fixture.service as any, 'lockQuotationForUpdate')
          .mockResolvedValue(fixture.quotation);
        (fixture.dataSource.transaction as jest.Mock).mockImplementation(
          async (callback) =>
            callback({
              getRepository: () => ({
                delete: jest.fn().mockResolvedValue(undefined),
              }),
            }),
        );
        const cataloguePricing = new PricingChargeService({
          find: jest.fn().mockResolvedValue([
            {
              id: 'vat',
              tax_code: 'VAT-MAINLAND',
              tax_name: 'VAT',
              tax_rate: '0.18',
            },
            {
              id: 'wht',
              tax_code: 'WITHHOLDING',
              tax_name: 'Withholding',
              tax_rate: '0.1',
            },
          ]),
        } as any);
        (
          fixture.pricingChargeService.calculateCharges as jest.Mock
        ).mockImplementation((company, input) =>
          cataloguePricing.calculateCharges(company, input),
        );
        await fixture.service.replace(
          'company-1',
          fixture.quotation.id,
          payload,
          pricingUser,
        );
        expect(
          fixture.pricingQuoteService.calculateSingleRiskQuote,
        ).toHaveBeenCalledWith(
          'company-1',
          expect.objectContaining({ tax_codes: selectedCodes }),
          pricingUser.id,
          pricingUser,
        );
        expect(risk.taxes_charged.map((tax) => tax.tax_code)).toEqual(
          selectedCodes,
        );
        const expectedTax = selectedCodes.reduce(
          (total, code) => total + (code === 'VAT-MAINLAND' ? 17100 : 9500),
          0,
        );
        expect(risk.premium_including_tax).toBe(95000 + expectedTax);
      },
    );

    it('passes each fleet risk?s own selection to save-time pricing', async () => {
      const fixture = createServiceFixture();
      const payload = createMotorFleetQuotationPayload();
      const risks = payload.cover_note_dtl.fleet_dtls.flatMap(
        (entry) => entry.risks_covered,
      );
      risks[0].taxes_charged.push({
        ...risks[0].taxes_charged[0],
        tax_code: 'WITHHOLDING',
        tax_rate: 0.1,
      });
      risks[1].taxes_charged = [];
      await (fixture.service as any).refreshPricingBeforeSave(
        'company-1',
        payload,
        {
          riskByCode: new Map(
            risks.map((risk) => [risk.risk_code, { id: 'risk-1' }]),
          ),
        },
        pricingUser,
      );
      const calls =
        fixture.pricingQuoteService.calculateSingleRiskQuote.mock.calls;
      expect(calls[0][1].tax_codes).toEqual(['VAT-MAINLAND', 'WITHHOLDING']);
      expect(calls[1][1].tax_codes).toEqual([]);
      expect(calls[0][1].factors.policy_holder_type).toBe('Corporate');
      expect(calls[1][1].factors.policy_holder_type).toBe('Corporate');
    });

    it('rejects an expired pricing quote', async () => {
      const fixture = createServiceFixture({
        pricingQuote: { expires_at: new Date('2020-01-01T00:00:00.000Z') },
      });
      stubNonPricingConcerns(fixture);

      await expect(
        fixture.service.create(
          'company-1',
          createMotorSingleQuotationPayload(),
          pricingUser,
        ),
      ).rejects.toThrow('expired');
      expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('recalculates fresh pricing when the submitted sum insured no longer matches the old quote snapshot', async () => {
      const fixture = createServiceFixture({
        pricingQuote: {
          result_payload: { sum_insured: 20000000, percentage_rate: 0.01 },
        },
      });
      stubNonPricingConcerns(fixture);

      await expect(
        fixture.service.create(
          'company-1',
          createMotorSingleQuotationPayload(),
          pricingUser,
        ),
      ).resolves.toBeDefined();
      expect(
        fixture.pricingQuoteService.calculateSingleRiskQuote,
      ).toHaveBeenCalled();
    });

    it('recalculates fresh pricing when the submitted premium no longer matches the old quote snapshot', async () => {
      const fixture = createServiceFixture({
        pricingQuote: { final_premium: '999999999' },
      });
      stubNonPricingConcerns(fixture);

      await expect(
        fixture.service.create(
          'company-1',
          createMotorSingleQuotationPayload(),
          pricingUser,
        ),
      ).resolves.toBeDefined();
      expect(
        fixture.pricingQuoteService.calculateSingleRiskQuote,
      ).toHaveBeenCalled();
    });

    it('recalculates motor pricing on save even when the submitted pricing quote is missing', async () => {
      const fixture = createServiceFixture();
      const payload = stubNonPricingConcerns(fixture);
      payload.cover_note_dtl.risks_covered[0].pricing_quote_id = null;
      payload.cover_note_dtl.risks_covered[0].premium_before_discount = 0;
      payload.cover_note_dtl.risks_covered[0].premium_after_discount = 0;
      payload.cover_note_dtl.risks_covered[0].premium_excluding_tax_equivalent = 0;
      payload.cover_note_dtl.risks_covered[0].premium_including_tax = 0;

      await expect(
        fixture.service.create('company-1', payload, pricingUser),
      ).resolves.toBeDefined();
      expect(
        fixture.pricingQuoteService.calculateSingleRiskQuote,
      ).toHaveBeenCalled();
      expect(fixture.dataSource.transaction).toHaveBeenCalled();
    });

    it('omits zero sum insured when a risk does not require it during save recalculation', async () => {
      const fixture = createServiceFixture();
      const payload = stubNonPricingConcerns(fixture);
      payload.cover_note_dtl.risks_covered[0].sum_insured = 0;
      payload.cover_note_dtl.risks_covered[0].sum_insured_equivalent = 0;
      jest.spyOn(fixture.service as any, 'validateScope').mockResolvedValue({
        product: { id: 'product-1' },
        riskByCode: new Map([
          ['SP005001000001', { id: 'risk-1', required_factors: [] }],
        ]),
      });

      await expect(
        fixture.service.create('company-1', payload, pricingUser),
      ).resolves.toBeDefined();

      expect(
        fixture.pricingQuoteService.calculateSingleRiskQuote,
      ).toHaveBeenCalledWith(
        'company-1',
        expect.objectContaining({
          sum_insured: undefined,
          factors: expect.not.objectContaining({
            sum_insured: expect.anything(),
          }),
        }),
        pricingUser.id,
        pricingUser,
      );
    });

    it('rejects a pricing quote that cannot be found for the current company (cross-company access)', async () => {
      const fixture = createServiceFixture();
      stubNonPricingConcerns(fixture);
      // Simulates a pricing_quote_id that belongs to a different company: the
      // real query is scoped by `company_id: companyId`, so a cross-company
      // id simply never comes back.
      fixture.quotationRepositoryMock.find.mockResolvedValueOnce([]);

      await expect(
        fixture.service.create(
          'company-1',
          createMotorSingleQuotationPayload(),
          pricingUser,
        ),
      ).rejects.toThrow('was not found for the current company');
      expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a pricing quote already attached to a different quotation', async () => {
      const fixture = createServiceFixture();
      stubNonPricingConcerns(fixture);
      (fixture.dataSource.query as jest.Mock).mockResolvedValueOnce([
        {
          pricing_quote_id: 'PQ-2026-00000001',
          quotation_id: 'other-quotation',
        },
      ]);

      await expect(
        fixture.service.create(
          'company-1',
          createMotorSingleQuotationPayload(),
          pricingUser,
        ),
      ).rejects.toThrow('already attached to another quotation');
      expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  it('allows unchanged approved discounts to remain on replacement without approval permission changes', () => {
    const fixture = createServiceFixture();
    const payload = createMotorSingleQuotationPayload();
    const discount =
      payload.cover_note_dtl.risks_covered?.[0]?.discounts_offered?.[0];

    if (!discount) {
      throw new Error('Expected fixture payload to include a discount');
    }

    Object.assign(discount, {
      approval_status: 'APPROVED',
      approved_rate: 0.05,
      approved_amount: 5000,
      approved_by: 'manager-1',
      approval_date: '2026-07-27',
    });
    fixture.quotation.cover_note.entries[0].risks[0].discounts = [
      {
        sequence_no: 1,
        discount_rate: 0.05,
        discount_amount: 5000,
        request_reason_code: 'LOYALTY',
        request_comment: 'Introductory loyalty discount',
        effective_from: null,
        effective_to: null,
        approval_status: 'APPROVED',
        approved_rate: 0.05,
        approved_amount: 5000,
        approved_by: 'manager-1',
        approval_date: '2026-07-27',
        rejection_reason: null,
      },
    ];

    expect(() =>
      (fixture.service as any).assertDiscountPermissions(
        payload,
        {
          permissions: [],
        },
        fixture.quotation,
      ),
    ).not.toThrow();
  });

  it('blocks discount approval decisions when the caller lacks approval permission', () => {
    const fixture = createServiceFixture();
    const payload = createMotorSingleQuotationPayload();
    const discount =
      payload.cover_note_dtl.risks_covered?.[0]?.discounts_offered?.[0];

    if (!discount) {
      throw new Error('Expected fixture payload to include a discount');
    }

    Object.assign(discount, {
      approval_status: 'APPROVED',
      approved_rate: 0.04,
      approved_amount: 4000,
      approved_by: 'manager-1',
      approval_date: '2026-07-27',
    });

    expect(() =>
      (fixture.service as any).assertDiscountPermissions(payload, {
        permissions: ['pricing.request_discount'],
      }),
    ).toThrow('You do not have permission to approve quotation discounts');
  });

  it('reuses the existing submission without re-triggering lifecycle transitions', async () => {
    const fixture = createServiceFixture({
      status: QuotationStatus.SUBMITTED_TO_TIRA,
      tira_status: TiraStatus.SUBMITTED,
      submitted_at: new Date('2026-07-01T08:00:00.000Z'),
    });

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      {
        return_existing: true,
      },
      submitTiramisUser,
    );

    expect(
      fixture.quotationLifecycleService.startTiraSubmission,
    ).not.toHaveBeenCalled();
    expect(
      fixture.quotationLifecycleService.markTiraSubmitted,
    ).not.toHaveBeenCalled();
  });

  it('blocks TIRAMIS submission when approval is still pending', async () => {
    const fixture = createServiceFixture({
      requires_approval: true,
      approval_status: ApprovalStatus.PENDING,
      status: QuotationStatus.PENDING_REQUIREMENTS,
    });

    await expect(
      fixture.service.submit(
        'company-1',
        fixture.quotation.id,
        undefined,
        submitTiramisUser,
      ),
    ).rejects.toThrow(
      'Quotation approval is not complete. Current approval status is PENDING.',
    );
  });

  it('logs pricing expiry, invalidation, and recalculation-required when a quote is expired', async () => {
    const fixture = createServiceFixture({
      pricingQuote: {
        expires_at: new Date('2026-07-26T08:00:00.000Z'),
      },
    });

    await expect(
      fixture.service.submit(
        'company-1',
        fixture.quotation.id,
        undefined,
        submitTiramisUser,
      ),
    ).rejects.toThrow(
      'Pricing quote PQ-2026-00000001 expired on 2026-07-26T08:00:00.000Z. Recalculate the premium and try again.',
    );

    const calls = (fixture.auditService.log as jest.Mock).mock.calls.map(
      ([entry]) => entry,
    );

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'quotation.pricing_expired',
          status: 'failure',
          metadata: expect.objectContaining({
            correlation_id: fixture.quotation.id,
          }),
        }),
        expect.objectContaining({
          action: 'quotation.pricing_invalidation',
          status: 'failure',
          metadata: expect.objectContaining({
            correlation_id: fixture.quotation.id,
          }),
        }),
        expect.objectContaining({
          action: 'quotation.pricing_recalculation.required',
          status: 'failure',
          metadata: expect.objectContaining({
            new_value: {
              recalculation_required: true,
            },
          }),
        }),
        expect.objectContaining({
          action: 'quotation.tira_submission.validated',
          status: 'failure',
        }),
      ]),
    );
  });

  it('blocks TIRAMIS submission when payment is not settled in backend records', async () => {
    const fixture = createServiceFixture({
      requires_payment: true,
      payment_status: PaymentStatus.PAID,
      status: QuotationStatus.READY_FOR_SUBMISSION,
      cover_note: {
        payment_mode: 2,
        entries: [
          {
            risks: [
              {
                risk_code: 'SP005001000001',
                insurance_risk_id: 'risk-1',
                pricing_quote_id: 'PQ-2026-00000001',
              },
            ],
          },
        ],
      },
    });

    await expect(
      fixture.service.submit(
        'company-1',
        fixture.quotation.id,
        undefined,
        submitTiramisUser,
      ),
    ).rejects.toThrow(
      'Quotation payment is not settled. Only direct payment mode can be submitted without a settled invoice.',
    );
  });

  it('requires a reason when rejecting a quotation', async () => {
    const fixture = createServiceFixture();

    await expect(
      fixture.service.transitionStatus(
        'company-1',
        fixture.quotation.id,
        {
          action: QuotationStatusTransitionAction.REJECT_APPROVAL,
        },
        rejectApprovalUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a workflow view with available commands for ready quotations', async () => {
    const fixture = createServiceFixture();

    const workflow = await fixture.service.getWorkflowView(
      'company-1',
      'quotation-1',
      {
        permissions: [
          'quotations:submit-tiramis',
          'quotations:cancel',
          'quotations:update',
        ],
      },
    );

    expect(workflow.quotationId).toBe('quotation-1');
    expect(workflow.quotationStage).toBe('COMPLETED');
    expect(workflow.submission.status).toBe('READY');
    expect(workflow.availableCommands.SUBMIT_TIRAMIS).toBe(true);
    expect(workflow.availableCommands.CANCEL).toBe(true);
    expect(workflow.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'QUOTATION_PRICING_CURRENT',
        }),
      ]),
    );
  });

  it('normalizes quotation taxes from backend charge rules before submission', async () => {
    const fixture = createServiceFixture();
    fixture.authoritativePayload.cover_note_dtl.risks_covered![0].taxes_charged[0].tax_amount = 1;
    fixture.authoritativePayload.cover_note_dtl.risks_covered![0].premium_including_tax = 100001;

    await fixture.service.submit(
      'company-1',
      fixture.quotation.id,
      undefined,
      submitTiramisUser,
    );

    expect(fixture.pricingChargeService.calculateCharges).toHaveBeenCalled();
    expect(
      (
        fixture.tiramisBusinessSubmitService
          .submitAnyBusinessRecord as jest.Mock
      ).mock.calls[0][0].payload.risks[0].taxes[0],
    ).toMatchObject({
      taxCode: 'VAT-MAINLAND',
      taxAmount: 18000,
    });

    expect(fixture.auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'quotation.tax_recalculation',
        metadata: expect.objectContaining({
          quotationId: fixture.quotation.id,
          riskCode: 'SP005001000001',
          new_value: expect.objectContaining({
            premium_including_tax: 118000,
          }),
        }),
      }),
    );
  });

  it('rejects selected taxes missing from the catalogue instead of trusting a submitted rate', async () => {
    const fixture = createServiceFixture();
    (
      fixture.pricingChargeService.calculateCharges as jest.Mock
    ).mockResolvedValueOnce({ charges: [] });
    await expect(
      fixture.service.submit(
        'company-1',
        fixture.quotation.id,
        undefined,
        submitTiramisUser,
      ),
    ).rejects.toThrow('unavailable');
    expect(
      fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord,
    ).not.toHaveBeenCalled();
  });

  it('requires recalculation when selected taxes disagree with the signed pricing total', async () => {
    const fixture = createServiceFixture({
      pricingQuote: {
        result_payload: {
          sum_insured: 10000000,
          percentage_rate: 0.01,
          total_charge_amount: 0,
          premium_including_tax: 100000,
        },
      },
    });
    await expect(
      fixture.service.submit(
        'company-1',
        fixture.quotation.id,
        undefined,
        submitTiramisUser,
      ),
    ).rejects.toThrow('Recalculate the premium');
    expect(
      fixture.tiramisBusinessSubmitService.submitAnyBusinessRecord,
    ).not.toHaveBeenCalled();
  });

  it('prevents a requester from approving their own premium override', async () => {
    const fixture = createServiceFixture();
    fixture.quotation.cover_note.entries[0].risks[0].premium_overrides = [
      {
        id: 'override-1',
        original_calculated_premium: '100000.00',
        proposed_premium: '90000.00',
        override_reason: 'Loyalty retention',
        requested_by: 'user-1',
        approval_status: 'PENDING',
      },
    ];

    await expect(
      fixture.service.approvePremiumOverride(
        'company-1',
        fixture.quotation.id,
        'quotation-risk-1',
        'override-1',
        {},
        {
          id: 'user-1',
        } as any,
      ),
    ).rejects.toThrow(
      new ConflictException(
        'You cannot approve your own premium override request',
      ),
    );
  });

  it('approves a pending premium override and recalculates the stored risk totals', async () => {
    const fixture = createServiceFixture();
    fixture.quotation.cover_note.entries[0].risks[0].discounts = [
      {
        id: 'discount-1',
        discount_rate: '0.05',
        discount_amount: '5000.00',
      },
    ];
    fixture.quotation.cover_note.entries[0].risks[0].taxes = [
      {
        id: 'tax-1',
        tax_rate: '0.18',
        tax_amount: '17100.00',
        is_tax_exempted: 'N',
      },
    ];
    fixture.quotation.cover_note.entries[0].risks[0].premium_overrides = [
      {
        id: 'override-1',
        original_calculated_premium: '100000.00',
        proposed_premium: '80000.00',
        override_reason: 'Commercial retention',
        requested_by: 'underwriter-1',
        approval_status: 'PENDING',
      },
    ];

    const result = await fixture.service.approvePremiumOverride(
      'company-1',
      fixture.quotation.id,
      'quotation-risk-1',
      'override-1',
      {},
      {
        id: 'approver-2',
      } as any,
    );

    expect(result).toEqual({
      id: 'override-1',
      approval_status: 'APPROVED',
    });
    expect(fixture.premiumOverrideRepositoryMock.update).toHaveBeenCalledWith(
      { id: 'override-1', risk_id: 'quotation-risk-1' },
      expect.objectContaining({
        approval_status: 'APPROVED',
        approved_by: 'approver-2',
      }),
    );
    expect(
      fixture.quotationEntryRiskRepositoryMock.update,
    ).toHaveBeenCalledWith(
      { id: 'quotation-risk-1' },
      expect.objectContaining({
        premium_before_discount: '80000.00',
        premium_after_discount: '76000.00',
        premium_excluding_tax_equivalent: '76000.00',
        premium_including_tax: '89680.00',
      }),
    );
    expect(
      fixture.quotationRiskDiscountRepositoryMock.update,
    ).toHaveBeenCalledWith(
      { id: 'discount-1' },
      {
        discount_amount: '4000.00',
      },
    );
    expect(fixture.quotationRiskTaxRepositoryMock.update).toHaveBeenCalledWith(
      { id: 'tax-1' },
      {
        tax_amount: '13680.00',
      },
    );
    expect(fixture.auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'quotation.premium_override.approved',
        metadata: expect.objectContaining({
          premiumOverrideId: 'override-1',
          new_value: {
            proposed_premium: 80000,
          },
        }),
      }),
    );
  });
});
