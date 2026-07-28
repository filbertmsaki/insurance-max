import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

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
import { QuotationsService } from './quotations.service';
import { createMotorSingleQuotationPayload } from './testing/quotation-payload.fixture';
import { AuditService } from '../../shared/audit/audit.service';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { PricingChargeService } from '../pricing/application/pricing-charge.service';

describe('QuotationsService', () => {
  function createServiceFixture(
    overrides?: Partial<Record<string, unknown>> & {
      pricingQuote?: Partial<Record<string, unknown>>;
    },
  ) {
    const authoritativePayload = createMotorSingleQuotationPayload();
    const {
      pricingQuote: pricingQuoteOverrides,
      ...quotationOverrides
    } = overrides ?? {};
    const pricingQuote = {
      pricing_quote_id:
        authoritativePayload.cover_note_dtl.risks_covered?.[0]
          ?.pricing_quote_id ?? 'PQ-2026-00000001',
      quote_scope: 'SINGLE_RISK',
      calculation_status: 'CALCULATED',
      calculated_at: new Date('2026-07-27T08:00:00.000Z'),
      expires_at: new Date('2026-07-30T08:00:00.000Z'),
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
    const quotation = {
      id: 'quotation-1',
      quotation_no: 'QTN-MTR-2026-000001',
      product_id: 'product-1',
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
      company_id: 'company-1',
      cover_note: {
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

        return {
          find: jest.fn().mockResolvedValue([]),
        };
      }),
      query: jest.fn().mockResolvedValue([]),
      transaction: jest.fn().mockImplementation(async (callback) =>
        callback(transactionManager as any),
      ),
    } as unknown as DataSource;

    const quotationsRepository = {
      findOneAggregate: jest.fn().mockResolvedValue(quotation),
    } as unknown as QuotationsRepository;

    const payloadMapper = {
      toAuthoritativePayload: jest.fn().mockReturnValue(authoritativePayload),
      businessReference: jest.fn().mockReturnValue('AICL-MTR-2026-000001'),
      toResponse: jest.fn().mockImplementation((value: any) => value),
    } as unknown as QuotationPayloadMapper;

    const previewMapper = {
      toResponse: jest.fn().mockReturnValue({
        overview: {
          quotation_flow: authoritativePayload.internal_quotation.quotation_flow,
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
          authoritativePayload.cover_note_dtl.risks_covered?.[0]?.premium_rate ??
          0.02,
        premium_before_discount:
          Number(pricingQuote.final_premium) ||
          authoritativePayload.cover_note_dtl.risks_covered?.[0]
            ?.premium_before_discount ||
          100000,
      }),
    };

    const service = new QuotationsService(
      dataSource,
      quotationsRepository,
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
      service,
    };
  }

  it('submits the final outbound payload to TIRAMIS using camelCase fields', async () => {
    const fixture = createServiceFixture();

    await fixture.service.submit('company-1', fixture.quotation.id, undefined, {
      id: 'user-1',
    } as any);

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

  it('exposes a current pricing integration summary on quotation detail responses', async () => {
    const fixture = createServiceFixture();

    const result = await fixture.service.findOne(
      'company-1',
      fixture.quotation.id,
      {
        permissions: ['pricing.view_breakdown'],
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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
    ).rejects.toThrow('You do not have permission to request quotation discounts');
    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
  });

  describe('authoritative pricing validation on create (real validateAuthoritativePricing, not mocked)', () => {
    const pricingUser = {
      id: 'user-1',
      permissions: ['pricing.request_discount'],
    } as any;

    function stubNonPricingConcerns(fixture: ReturnType<typeof createServiceFixture>) {
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
        { pricing_quote_id: 'PQ-2026-00000001', quotation_id: 'other-quotation' },
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
    const discount = payload.cover_note_dtl.risks_covered?.[0]?.discounts_offered?.[0];

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
    const discount = payload.cover_note_dtl.risks_covered?.[0]?.discounts_offered?.[0];

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
      {
        id: 'user-1',
      } as any,
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
      fixture.service.submit('company-1', fixture.quotation.id, undefined, {
        id: 'user-1',
      } as any),
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
      fixture.service.submit('company-1', fixture.quotation.id, undefined, {
        id: 'user-1',
      } as any),
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
      fixture.service.submit('company-1', fixture.quotation.id, undefined, {
        id: 'user-1',
      } as any),
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
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes quotation taxes from backend charge rules before submission', async () => {
    const fixture = createServiceFixture();
    fixture.authoritativePayload.cover_note_dtl.risks_covered![0].taxes_charged[0].tax_amount =
      1;
    fixture.authoritativePayload.cover_note_dtl.risks_covered![0].premium_including_tax =
      100001;

    await fixture.service.submit('company-1', fixture.quotation.id, undefined, {
      id: 'user-1',
    } as any);

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
    expect(fixture.quotationEntryRiskRepositoryMock.update).toHaveBeenCalledWith(
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
