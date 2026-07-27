import { PricingQuoteService } from './pricing-quote.service';

const COMPANY_ID = 'company-1';

describe('PricingQuoteService', () => {
  it('persists a single-risk pricing quote snapshot and returns quote metadata', async () => {
    const exchangeRateGovernanceService = {
      resolveSnapshot: jest.fn().mockResolvedValue({
        quotation_currency_code: 'TZS',
        base_currency_code: 'TZS',
        exchange_rate: 1,
        exchange_rate_source: 'PARITY',
        exchange_rate_date: '2026-07-27',
        exchange_rate_precision: 10,
        approval_required: false,
        approval_granted: true,
        approved_by_user_id: null,
        approved_at: null,
        conversion_direction: 'QUOTE_TO_BASE_MULTIPLY',
        rounding_method: 'ROUND_HALF_UP',
      }),
    };
    const pricingEngineService = {
      calculateSingleRisk: jest.fn().mockResolvedValue({
        risk_id: 'risk-1',
        risk_code: 'RISK-001',
        risk_name: 'Comprehensive',
        rate_book_id: 'rate-book-1',
        rate_book_code: 'MOTOR-STANDARD',
        rate_book_version: '2026.1',
        rule_id: 'rule-1',
        rule_name: 'Base rate',
        rule_version: 1,
        sum_insured: 1000000,
        rate_type: 'PERCENTAGE',
        percentage_rate: 0.035,
        base_premium: 35000,
        per_unit_factor_code: null,
        per_unit_value: 0,
        per_unit_amount: 0,
        per_unit_premium: 0,
        fixed_amount: 0,
        minimum_amount: 250000,
        gross_premium: 35000,
        final_premium: 250000,
        minimum_applied: true,
        factors: { vehicle_type: 'PRIVATE' },
        validation_errors: [],
        validation_warnings: [],
      }),
    };
    const quotationRecalculationService = {
      createInputSignature: jest.fn().mockReturnValue('hash-123'),
    };
    const identifierGeneratorService = {
      generatePricingQuoteId: jest.fn().mockResolvedValue({
        pricingQuoteId: 'PQ-2026-00000001',
        sequenceNo: 1,
      }),
    };
    const pricingQuoteRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
    };
    const riskRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'risk-1',
          company_id: COMPANY_ID,
          product_id: 'product-1',
        },
      ]),
    };

    const service = new PricingQuoteService(
      pricingEngineService as any,
      quotationRecalculationService as any,
      identifierGeneratorService as any,
      exchangeRateGovernanceService as any,
      pricingQuoteRepository as any,
      riskRepository as any,
    );

    const result = await service.calculateSingleRiskQuote(
      COMPANY_ID,
      {
        risk_id: 'risk-1',
        sum_insured: 1000000,
        factors: { vehicle_type: 'PRIVATE' },
        quotation_type: 'NEW_BUSINESS',
        currency_code: 'TZS',
      },
      'user-1',
    );

    expect(result.pricing_quote_id).toBe('PQ-2026-00000001');
    expect(result.pricing_status).toBe('CALCULATED');
    expect(result.input_signature).toBe('hash-123');
    expect(result.premium_breakdown).toEqual(
      expect.objectContaining({
        pricing_quote_id: 'PQ-2026-00000001',
        status: 'CALCULATED',
        currency: 'TZS',
        rate_book: {
          code: 'MOTOR-STANDARD',
          version: '2026.1',
        },
        totals: expect.objectContaining({
          payable_premium: 250000,
        }),
      }),
    );
    expect(pricingQuoteRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing_quote_id: 'PQ-2026-00000001',
        company_id: COMPANY_ID,
        product_id: 'product-1',
        risk_id: 'risk-1',
        quotation_type: 'NEW_BUSINESS',
        currency_code: 'TZS',
      }),
    );
  });

  it('returns a stored immutable pricing quote snapshot by pricing quote id', async () => {
    const service = new PricingQuoteService(
      { calculateSingleRisk: jest.fn(), calculateMultiRisk: jest.fn() } as any,
      { createInputSignature: jest.fn() } as any,
      { generatePricingQuoteId: jest.fn() } as any,
      { resolveSnapshot: jest.fn() } as any,
      {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn().mockResolvedValue({
          pricing_quote_id: 'PQ-2026-00000042',
          calculation_status: 'CALCULATED',
          quote_scope: 'SINGLE_RISK',
          calculated_at: new Date('2026-07-27T09:00:00.000Z'),
          expires_at: new Date('2026-07-28T09:00:00.000Z'),
          input_signature: 'hash-456',
          quotation_type: 'NEW_BUSINESS',
          currency_code: 'TZS',
          product_id: 'product-1',
          risk_id: 'risk-1',
          rate_book_id: 'rate-book-1',
          rate_book_version: '2026.1',
          matched_rule_id: 'rule-1',
          matched_rule_version: 1,
          base_premium: '35000',
          minimum_premium_adjustment: '215000',
          gross_premium: '35000',
          final_premium: '250000',
          input_payload: { risk_id: 'risk-1' },
          factor_payload: { vehicle_type: 'PRIVATE' },
          result_payload: { final_premium: 250000 },
          warning_messages: [],
          context_payload: { quote_scope: 'SINGLE_RISK' },
        }),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.findStoredQuote(
      COMPANY_ID,
      'PQ-2026-00000042',
    );

    expect(result.pricing_quote_id).toBe('PQ-2026-00000042');
    expect(result.final_premium).toBe(250000);
    expect(result.input_payload).toEqual({ risk_id: 'risk-1' });
  });

  it('persists a multi-risk pricing quote snapshot with successful and failed rows', async () => {
    const exchangeRateGovernanceService = {
      resolveSnapshot: jest.fn().mockResolvedValue({
        quotation_currency_code: 'TZS',
        base_currency_code: 'TZS',
        exchange_rate: 1,
        exchange_rate_source: 'PARITY',
        exchange_rate_date: '2026-07-27',
        exchange_rate_precision: 10,
        approval_required: false,
        approval_granted: true,
        approved_by_user_id: null,
        approved_at: null,
        conversion_direction: 'QUOTE_TO_BASE_MULTIPLY',
        rounding_method: 'ROUND_HALF_UP',
      }),
    };
    const pricingEngineService = {
      calculateMultiRisk: jest.fn().mockResolvedValue({
        risks: [
          {
            client_reference: 'VEHICLE-001',
            risk_id: 'risk-1',
            risk_code: 'RISK-001',
            risk_name: 'Comprehensive',
            rate_book_id: 'rate-book-1',
            rate_book_code: 'MOTOR-STANDARD',
            rate_book_version: '2026.1',
            rule_id: 'rule-1',
            rule_name: 'Base rate',
            rule_version: 1,
            sum_insured: 1000000,
            rate_type: 'PERCENTAGE',
            percentage_rate: 0.035,
            base_premium: 35000,
            per_unit_factor_code: null,
            per_unit_value: 0,
            per_unit_amount: 0,
            per_unit_premium: 0,
            fixed_amount: 0,
            minimum_amount: 250000,
            gross_premium: 35000,
            final_premium: 250000,
            minimum_applied: true,
            discount_control: null,
            loading_control: null,
            factors: { vehicle_type: 'PRIVATE' },
            validation_errors: [],
            validation_warnings: [],
          },
        ],
        failed_risks: [
          {
            client_reference: 'VEHICLE-002',
            risk_id: 'risk-2',
            status: 'INCOMPLETE',
            message: 'Pricing factor validation failed',
            validation_errors: ['Required factor "seat_capacity" is missing'],
            validation_warnings: [],
            details: {
              status: 'INCOMPLETE',
            },
          },
        ],
        grand_total: 250000,
        successful_risk_count: 1,
        failed_risk_count: 1,
      }),
    };
    const quotationRecalculationService = {
      createInputSignature: jest.fn().mockReturnValue('hash-789'),
    };
    const identifierGeneratorService = {
      generatePricingQuoteId: jest.fn().mockResolvedValue({
        pricingQuoteId: 'PQ-2026-00000003',
        sequenceNo: 3,
      }),
    };
    const pricingQuoteRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
    };
    const riskRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'risk-1',
          company_id: COMPANY_ID,
          product_id: 'product-1',
        },
      ]),
    };

    const service = new PricingQuoteService(
      pricingEngineService as any,
      quotationRecalculationService as any,
      identifierGeneratorService as any,
      exchangeRateGovernanceService as any,
      pricingQuoteRepository as any,
      riskRepository as any,
    );

    const result = await service.calculateMultiRiskQuote(
      COMPANY_ID,
      {
        risks: [
          {
            client_reference: 'VEHICLE-001',
            risk_id: 'risk-1',
            sum_insured: 1000000,
            factors: { vehicle_type: 'PRIVATE' },
          },
          {
            client_reference: 'VEHICLE-002',
            risk_id: 'risk-2',
            sum_insured: 2000000,
            factors: {},
          },
        ],
        quotation_type: 'MOTOR',
        currency_code: 'TZS',
      },
      'user-1',
    );

    expect(result.pricing_quote_id).toBe('PQ-2026-00000003');
    expect(result.successful_risk_count).toBe(1);
    expect(result.failed_risk_count).toBe(1);
    expect(result.premium_breakdown).toEqual(
      expect.objectContaining({
        pricing_quote_id: 'PQ-2026-00000003',
        status: 'PARTIAL',
        currency: 'TZS',
        totals: expect.objectContaining({
          payable_premium: 250000,
        }),
        errors: [
          expect.objectContaining({
            client_reference: 'VEHICLE-002',
            risk_id: 'risk-2',
            message: 'Required factor "seat_capacity" is missing',
          }),
        ],
      }),
    );
    expect(pricingQuoteRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing_quote_id: 'PQ-2026-00000003',
        final_premium: 250000,
        warning_messages: [],
        context_payload: expect.objectContaining({
          risk_ids: ['risk-1'],
        }),
      }),
    );
  });
});
