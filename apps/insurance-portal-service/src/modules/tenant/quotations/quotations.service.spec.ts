import { BadRequestException } from '@nestjs/common';
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
                risk_code:
                  authoritativePayload.cover_note_dtl.risks_covered?.[0]
                    ?.risk_code ?? 'SP005001000001',
                insurance_risk_id: 'risk-1',
                pricing_quote_id: pricingQuote.pricing_quote_id,
              },
            ],
          },
        ],
      },
      ...quotationOverrides,
    } as any;

    const dataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (
          typeof entity === 'function' &&
          'name' in entity &&
          entity.name === 'PricingQuote'
        ) {
          return {
            find: jest.fn().mockResolvedValue([pricingQuote]),
          };
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
    } as unknown as DataSource;

    const quotationsRepository = {
      findOneAggregate: jest.fn().mockResolvedValue(quotation),
    } as unknown as QuotationsRepository;

    const payloadMapper = {
      toAuthoritativePayload: jest.fn().mockReturnValue(authoritativePayload),
      businessReference: jest.fn().mockReturnValue('AICL-MTR-2026-000001'),
      toResponse: jest.fn().mockImplementation((value: any) => value),
    } as unknown as QuotationPayloadMapper;

    const previewMapper = {} as QuotationPreviewMapper;

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
    const identifierGeneratorService = {} as IdentifierGeneratorService;
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
    );

    return {
      authoritativePayload,
      auditService,
      quotation,
      payloadMapper,
      pricingChargeService,
      quotationLifecycleService,
      tiramisBusinessSubmitService,
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

    const result = await fixture.service.findOne('company-1', fixture.quotation.id);

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
});
