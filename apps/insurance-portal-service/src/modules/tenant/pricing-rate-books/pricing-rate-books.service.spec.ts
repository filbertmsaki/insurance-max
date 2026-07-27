import { ConflictException } from '@nestjs/common';
import { PricingRateBooksService } from './pricing-rate-books.service';
import { PricingRateBookStatus } from './enums/pricing-rate-book-status.enum';

const COMPANY_ID = 'company-1';

function createServiceFixture(options?: {
  productActive?: boolean;
  count?: number;
  overlappingPublished?: Array<Record<string, unknown>>;
}) {
  const overlapQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(options?.overlappingPublished ?? []),
  };
  const rateBookRepository = {
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockImplementation(async (value) => ({
      id: (value as Record<string, unknown>).id ?? 'rate-book-1',
      ...value,
    })),
    find: jest.fn().mockResolvedValue(options?.overlappingPublished ?? []),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(options?.count ?? 1),
    createQueryBuilder: jest.fn().mockReturnValue(overlapQueryBuilder),
    manager: {
      transaction: jest.fn(),
    },
  };
  const productRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'product-1',
      company_id: COMPANY_ID,
      is_active: options?.productActive ?? true,
    }),
  };
  const ruleRepository = {
    count: jest.fn().mockResolvedValue(options?.count ?? 1),
  };
  const conditionRepository = {};
  const pricingRuntimeCacheService = {
    invalidateRateConfiguration: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PricingRateBooksService(
    rateBookRepository as any,
    productRepository as any,
    ruleRepository as any,
    conditionRepository as any,
    pricingRuntimeCacheService as any,
  );

  return {
    service,
    rateBookRepository,
    productRepository,
    ruleRepository,
    pricingRuntimeCacheService,
  };
}

describe('PricingRateBooksService', () => {
  it('creates a draft rate book for an active product', async () => {
    const { service, rateBookRepository } = createServiceFixture();

    await service.create(
      COMPANY_ID,
      {
        product_id: 'product-1',
        code: 'motor-standard',
        version: '2026.1',
        effective_from: '2026-07-27',
      },
      'user-1',
    );

    expect(rateBookRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: COMPANY_ID,
        product_id: 'product-1',
        code: 'MOTOR-STANDARD',
        version: '2026.1',
        status: PricingRateBookStatus.DRAFT,
      }),
    );
  });

  it('refuses to edit a published rate book directly', async () => {
    const { service, rateBookRepository } = createServiceFixture();
    rateBookRepository.findOne.mockResolvedValue({
      id: 'rate-book-1',
      company_id: COMPANY_ID,
      product_id: 'product-1',
      code: 'MOTOR-STANDARD',
      version: '2026.1',
      status: PricingRateBookStatus.PUBLISHED,
      effective_from: '2026-07-27',
      effective_to: null,
    });

    await expect(
      service.update(
        COMPANY_ID,
        'rate-book-1',
        { name: 'Should fail' },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('retires overlapping published books when publishing a new approved version', async () => {
    const { service, rateBookRepository } = createServiceFixture({
      overlappingPublished: [
        {
          id: 'rate-book-old',
          company_id: COMPANY_ID,
          product_id: 'product-1',
          currency_code: null,
          status: PricingRateBookStatus.PUBLISHED,
          effective_from: '2026-01-01',
          effective_to: null,
        },
      ],
    });
    rateBookRepository.findOne.mockResolvedValue({
      id: 'rate-book-new',
      company_id: COMPANY_ID,
      product_id: 'product-1',
      currency_code: null,
      status: PricingRateBookStatus.APPROVED,
      effective_from: '2026-07-27',
      effective_to: null,
    });

    const result = await service.publish(COMPANY_ID, 'rate-book-new', 'user-1');

    expect(rateBookRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rate-book-old',
        status: PricingRateBookStatus.RETIRED,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: PricingRateBookStatus.PUBLISHED,
      }),
    );
  });

  it('carries discount/loading governance fields over when cloning a rate book', async () => {
    const { service, rateBookRepository } = createServiceFixture();

    const sourceRule = {
      id: 'source-rule-1',
      risk_id: 'risk-1',
      rule_name: 'Base Rate',
      rate_type: 'PERCENTAGE',
      percentage_rate: 0.035,
      fixed_amount: null,
      per_unit_amount: null,
      per_unit_factor_code: null,
      minimum_amount: 250000,
      max_discount_rate: 0.1,
      max_discount_amount: 50000,
      discount_approval_threshold_rate: 0.05,
      discount_approval_threshold_amount: 20000,
      max_loading_rate: 0.2,
      max_loading_amount: 100000,
      loading_approval_threshold_rate: 0.1,
      loading_approval_threshold_amount: 40000,
      adjustment_effective_from: '2026-01-01',
      adjustment_effective_to: '2026-12-31',
      formula: null,
      priority: 1,
      is_active: true,
      rule_version: 1,
      conditions: [],
    };

    rateBookRepository.findOne.mockResolvedValue({
      id: 'source-book-1',
      company_id: COMPANY_ID,
      product_id: 'product-1',
      code: 'MOTOR-STANDARD',
      currency_code: null,
      effective_from: '2026-01-01',
      effective_to: null,
      rules: [sourceRule],
    });

    const ruleRepoMock = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest
        .fn()
        .mockImplementation(async (value) => ({ id: 'cloned-rule-1', ...value })),
    };
    const conditionRepoMock = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const finalRateBookRepoMock = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'draft-1', rules: [{ id: 'cloned-rule-1' }] }),
    };

    (rateBookRepository.manager.transaction as jest.Mock).mockImplementation(
      async (callback) =>
        callback({
          getRepository: jest
            .fn()
            .mockReturnValueOnce(ruleRepoMock)
            .mockReturnValueOnce(conditionRepoMock)
            .mockReturnValueOnce(finalRateBookRepoMock),
        }),
    );

    await service.clone(
      COMPANY_ID,
      { source_rate_book_id: 'source-book-1', version: '2026.2' },
      'user-1',
    );

    expect(ruleRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_discount_rate: 0.1,
        max_discount_amount: 50000,
        discount_approval_threshold_rate: 0.05,
        discount_approval_threshold_amount: 20000,
        max_loading_rate: 0.2,
        max_loading_amount: 100000,
        loading_approval_threshold_rate: 0.1,
        loading_approval_threshold_amount: 40000,
        adjustment_effective_from: '2026-01-01',
        adjustment_effective_to: '2026-12-31',
      }),
    );
  });
});
