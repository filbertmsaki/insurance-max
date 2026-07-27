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
});
